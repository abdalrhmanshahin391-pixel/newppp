import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipecat.frames.frames import LLMContextFrame, TTSSpeakFrame  # noqa: E402
from pipecat.processors.aggregators.llm_context import LLMContext  # noqa: E402
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame  # noqa: E402
from pipecat.tests.utils import run_test  # noqa: E402

from rita_state import RitaSessionState  # noqa: E402
from rita_turn_router import Action, RitaTurnRouter, RouterMode, decide  # noqa: E402

TWO_OPTIONS = "بدك نكمل ولا نغيّر الموضوع؟"
THREE_OPTIONS = "أي جزء يهمك؟ الأحداث، الشخصيات، ولا الأفكار؟"


def state_after(assistant_text: str) -> RitaSessionState:
    state = RitaSessionState()
    state.observe_assistant_turn(assistant_text)
    return state


class DecisionTests(unittest.TestCase):
    def test_stop_gets_a_short_ack_and_no_model(self):
        decision = decide("خلص، خلص.", state_after("الثورة الفرنسية صارت 1789."), language="ar")
        self.assertEqual(decision.action, Action.STOP)
        self.assertIn(decision.say, ("تمام.", "حاضر.", "ماشي."))

    def test_the_ack_is_silent_when_configured_and_follows_the_language(self):
        self.assertIsNone(decide("stop", RitaSessionState(), language="en", ack=False).say)
        self.assertIn(decide("stop", RitaSessionState(), language="en").say, ("Okay.", "Sure.", "Got it."))
        self.assertIn(decide("stopp", RitaSessionState(), language="de").say, ("Alles klar.", "Okay.", "Gut."))

    def test_repeated_stop_keeps_one_neutral_ack(self):
        state = RitaSessionState()
        seen = set()
        for _ in range(3):
            state.observe_user_turn("خلص")
            seen.add(decide("خلص", state, language="ar").say)
        self.assertEqual(seen, {"تمام."})

    def test_thinking_sounds_are_held(self):
        for text in ("أمم", "يعني...", "استنى", "um"):
            with self.subTest(text=text):
                self.assertEqual(decide(text, RitaSessionState(), language="ar").action, Action.HOLD)

    def test_bare_yes_after_two_options_asks_which_one(self):
        decision = decide("إيه.", state_after(TWO_OPTIONS), language="ar")
        self.assertEqual(decision.action, Action.SPEAK)
        self.assertEqual(decision.say, "أي واحد: نكمل ولا نغيّر الموضوع؟")

    def test_the_session_example_with_three_options(self):
        decision = decide("إيه", state_after(THREE_OPTIONS), language="ar")
        self.assertEqual(decision.action, Action.SPEAK)
        self.assertEqual(decision.say, "أي واحد: الأحداث ولا الشخصيات ولا الأفكار؟")

    def test_it_stops_asking_which_one_after_two_tries(self):
        state = state_after(TWO_OPTIONS)
        state.clarification_count = 2
        self.assertEqual(decide("إيه", state, language="ar").action, Action.PASS)

    def test_yes_to_a_yes_no_question_goes_to_the_model_with_context(self):
        decision = decide("إيه", state_after("جاهز نبدأ؟"), language="ar")
        self.assertEqual(decision.action, Action.PASS)

    def test_ordinary_requests_and_other_short_acts_pass(self):
        for text in ("شو بتعرفي عن الثورة الفرنسية؟", "مش عارف", "لا قصدي الخميس", "كمّل", "فهمت", "Guten Morgen"):
            with self.subTest(text=text):
                self.assertEqual(decide(text, RitaSessionState(), language="ar").action, Action.PASS)


def context_with(user_text: str, assistant_text: str = TWO_OPTIONS) -> LLMContext:
    return LLMContext(
        [
            {"role": "system", "content": "You are Rita."},
            {"role": "assistant", "content": assistant_text},
            {"role": "user", "content": user_text},
        ]
    )


async def route(mode, user_text, assistant_text=TWO_OPTIONS, ack=True):
    state = state_after(assistant_text)
    prepared = []
    router = RitaTurnRouter(
        state=state,
        prepare_turn=lambda text: (prepared.append(text), state.observe_user_turn(text)),
        language_of_turn=lambda: "ar",
        mode=mode,
        ack=ack,
    )
    frame = LLMContextFrame(context=context_with(user_text, assistant_text))
    down, _ = await run_test(router, frames_to_send=[frame])
    return [type(item).__name__ for item in down], down, prepared, state


class RouterProcessorTests(unittest.TestCase):
    def test_stop_never_reaches_the_model(self):
        names, down, prepared, state = asyncio.run(route(RouterMode.ON, "خلص"))
        self.assertEqual(names, ["RTVIServerMessageFrame", "TTSSpeakFrame"])
        self.assertIsInstance(down[0], RTVIServerMessageFrame)
        self.assertEqual(down[0].data["type"], "rita-spoken-text")
        self.assertIsInstance(down[1], TTSSpeakFrame)
        self.assertTrue(down[1].append_to_context)
        self.assertEqual(prepared, ["خلص"])
        self.assertTrue(state.topic_paused)

    def test_silent_stop_says_nothing(self):
        names, *_ = asyncio.run(route(RouterMode.ON, "خلص", ack=False))
        self.assertEqual(names, [])

    def test_hesitation_is_held(self):
        names, *_ = asyncio.run(route(RouterMode.ON, "أمم"))
        self.assertEqual(names, [])

    def test_bare_yes_asks_which_one_and_counts_it(self):
        names, down, _, state = asyncio.run(route(RouterMode.ON, "إيه"))
        self.assertEqual(names, ["RTVIServerMessageFrame", "TTSSpeakFrame"])
        self.assertEqual(down[1].text, "أي واحد: نكمل ولا نغيّر الموضوع؟")
        self.assertEqual(state.clarification_count, 1)

    def test_a_real_request_passes_through_and_the_state_is_prepared_once(self):
        names, down, prepared, _ = asyncio.run(route(RouterMode.ON, "شو معنى صباح الخير بالألماني؟"))
        self.assertEqual(names, ["LLMContextFrame"])
        self.assertEqual(prepared, ["شو معنى صباح الخير بالألماني؟"])

    def test_shadow_mode_decides_but_changes_nothing(self):
        for text in ("خلص", "أمم", "إيه"):
            with self.subTest(text=text):
                names, _, prepared, _ = asyncio.run(route(RouterMode.SHADOW, text))
                self.assertEqual(names, ["LLMContextFrame"])
                self.assertEqual(prepared, [])  # the old handler still prepares the turn

    def test_off_mode_is_a_plain_pass_through(self):
        names, _, prepared, _ = asyncio.run(route(RouterMode.OFF, "خلص"))
        self.assertEqual(names, ["LLMContextFrame"])
        self.assertEqual(prepared, [])

    def test_a_router_error_lets_the_turn_through(self):
        state = RitaSessionState()

        def boom(text):
            raise RuntimeError("boom")

        router = RitaTurnRouter(
            state=state, prepare_turn=boom, language_of_turn=lambda: "ar", mode=RouterMode.ON
        )
        frame = LLMContextFrame(context=context_with("خلص"))
        down, _ = asyncio.run(run_test(router, frames_to_send=[frame]))
        self.assertEqual([type(item).__name__ for item in down], ["LLMContextFrame"])

    def test_a_context_that_does_not_end_with_a_user_message_passes(self):
        state = RitaSessionState()
        router = RitaTurnRouter(
            state=state, prepare_turn=lambda t: None, language_of_turn=lambda: "ar", mode=RouterMode.ON
        )
        context = LLMContext([{"role": "system", "content": "x"}, {"role": "assistant", "content": "hi"}])
        down, _ = asyncio.run(run_test(router, frames_to_send=[LLMContextFrame(context=context)]))
        self.assertEqual([type(item).__name__ for item in down], ["LLMContextFrame"])


if __name__ == "__main__":
    unittest.main()
