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
from rita_ui_commands import UiAction, read_ui_command  # noqa: E402


class ReadCommandTests(unittest.TestCase):
    def test_open_the_list(self):
        for text in (
            "افتحي القائمة",
            "افتحي القايمة لو سمحتي",
            "ريتا افتحي قائمة الكلمات",
            "open the list",
            "show me the list",
            "öffne die Liste",
        ):
            with self.subTest(text=text):
                command = read_ui_command(text)
                self.assertIsNotNone(command)
                self.assertEqual(command.action, UiAction.OPEN_LIST)

    def test_convert_to_flashcards_with_and_without_a_subject(self):
        plain = read_ui_command("حوليهم فلاش كارد")
        self.assertEqual((plain.action, plain.target, plain.hint), (UiAction.CONVERT_LIST, "flashcards", ""))
        named = read_ui_command("حوليهم فلاش كاردز في موضوع الأفعال")
        self.assertEqual(named.hint, "الافعال")
        self.assertEqual(read_ui_command("convert them to flashcards").action, UiAction.CONVERT_LIST)

    def test_german_lab_is_the_place_not_the_subject(self):
        command = read_ui_command("turn the words into flashcards in German Lab")
        self.assertEqual((command.target, command.hint), ("german_lab", ""))

    def test_questions_and_single_word_saves_are_not_commands(self):
        for text in (
            "كيف أحول الكلمات لفلاش كارد",
            "احفظي كلمة Haus في فلاش كارد",
            "افتحي الشباك",
            "شو معنى كلمة list",
            "how do I open the list",
            "",
        ):
            with self.subTest(text=text):
                self.assertIsNone(read_ui_command(text))


class DecisionTests(unittest.TestCase):
    def test_open_list_is_a_ui_action_without_the_model(self):
        decision = decide("افتحي القائمة", RitaSessionState(), language="ar")
        self.assertEqual(decision.action, Action.UI)
        self.assertEqual(decision.command.action, UiAction.OPEN_LIST)

    def test_convert_on_a_known_empty_list_says_so_and_sends_nothing(self):
        state = RitaSessionState()
        state.learning_count = 0
        decision = decide("حوليهم فلاش كارد", state, language="ar")
        self.assertEqual(decision.action, Action.UI)
        self.assertIsNone(decision.command)
        self.assertEqual(decision.say, "القائمة لسا فاضية.")

    def test_convert_when_the_count_is_unknown_still_goes_to_the_page(self):
        decision = decide("حوليهم فلاش كارد", RitaSessionState(), language="ar")
        self.assertIsNotNone(decision.command)
        self.assertEqual(decision.say, "اختار الموضوع من الشاشة.")

    def test_a_named_subject_has_its_own_line(self):
        decision = decide("حوليهم فلاش كارد في الأفعال", RitaSessionState(), language="ar")
        self.assertEqual(decision.say, "تمام، شوف الشاشة.")


class PipelineTests(unittest.TestCase):
    def test_the_page_gets_one_message_and_the_model_is_skipped(self):
        async def go():
            state = RitaSessionState()
            context = LLMContext(
                [
                    {"role": "system", "content": "You are Rita."},
                    {"role": "user", "content": "حوليهم فلاش كارد في موضوع الأفعال"},
                ]
            )
            router = RitaTurnRouter(
                state=state,
                prepare_turn=state.observe_user_turn,
                language_of_turn=lambda: "ar",
                mode=RouterMode.ON,
            )
            down, _ = await run_test(router, frames_to_send=[LLMContextFrame(context=context)])
            return down

        down = asyncio.run(go())
        messages = [f for f in down if isinstance(f, RTVIServerMessageFrame)]
        self.assertEqual(len(messages), 1)
        self.assertEqual(
            messages[0].data,
            {"type": "rita-ui", "action": "convert_list", "target": "flashcards", "hint": "الافعال"},
        )
        self.assertTrue(any(isinstance(f, TTSSpeakFrame) for f in down))
        self.assertFalse(any(isinstance(f, LLMContextFrame) for f in down))


if __name__ == "__main__":
    unittest.main()
