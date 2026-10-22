import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipecat.frames.frames import (  # noqa: E402
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
)
from pipecat.tests.utils import run_test  # noqa: E402

from bot import build_prompt  # noqa: E402
from rita_dialect import (  # noqa: E402
    GREETINGS,
    RitaSpeechCleaner,
    SpeechTextFilter,
    asks_how_to_say,
    greeting_for,
    is_greeting,
    scan_dialect,
)
from rita_state import RitaSessionState  # noqa: E402
from rita_turn_router import Action, decide  # noqa: E402


class HowToSayTests(unittest.TestCase):
    def test_questions_about_saying_things(self):
        for text in (
            "كيف أحكي؟ بدي أروح على الحمام بالإنجليزي",
            "كيف احكي بدي ماي بالانجليزي",
            "شو بنقول صباح الخير بالألماني",
            "how do I say thank you",
            "What's the bathroom in German",
            "wie sagt man danke",
        ):
            with self.subTest(text=text):
                self.assertTrue(asks_how_to_say(text))

    def test_ordinary_turns_are_not(self):
        for text in ("كيف حالك", "شو الأخبار", "احكي إنجليزي", "مرحبا ريتا"):
            with self.subTest(text=text):
                self.assertFalse(asks_how_to_say(text))

    def test_asking_how_to_say_in_english_does_not_switch_the_conversation_language(self):
        state = RitaSessionState(active_language="ar")
        state.observe_user_turn("كيف احكي بدي اروح على الحمام بالانجليزي")
        self.assertEqual(state.active_language, "ar")
        self.assertIn("write the explanation in Arabic", state.turn_directive())

    def test_a_real_language_command_still_works(self):
        state = RitaSessionState()
        state.observe_user_turn("احكي انجليزي معي")
        self.assertEqual(state.active_language, "en")


class GreetingTests(unittest.TestCase):
    def test_plain_hellos(self):
        for text in ("مرحبا ريتا.", "أهلين", "hello", "Hallo Rita", "السلام عليكم", "صباح الخير ريتا"):
            with self.subTest(text=text):
                self.assertTrue(is_greeting(text))

    def test_hello_plus_a_request_is_not_a_greeting(self):
        self.assertFalse(is_greeting("مرحبا بدي أتعلم ألماني"))

    def test_first_hello_gets_the_scripted_greeting_once(self):
        state = RitaSessionState()
        state.observe_user_turn("مرحبا ريتا")
        decision = decide("مرحبا ريتا", state, language="ar")
        self.assertEqual(decision.action, Action.UI)
        self.assertIsNone(decision.command)
        self.assertIn(decision.say, GREETINGS["ar"])
        self.assertEqual(decision.say, greeting_for("مرحبا ريتا", "ar"))

    def test_a_later_hello_goes_to_the_model(self):
        state = RitaSessionState()
        state.observe_assistant_turn("أهلين! كيف الحال؟")
        state.observe_user_turn("أهلين")
        self.assertEqual(decide("أهلين", state, language="ar").action, Action.PASS)

    def test_scripted_greetings_use_the_right_words(self):
        for line in GREETINGS["ar"]:
            self.assertNotIn("فيك", line)
            self.assertNotIn("حابب", line)
            self.assertEqual(scan_dialect(line), [])


class PromptTests(unittest.TestCase):
    def test_prompt_teaches_the_dialect_and_the_answer_shape(self):
        prompt = build_prompt({}, RitaSessionState(), dialogue=True)
        self.assertIn("JORDANIAN SPEECH", prompt)
        self.assertIn("هيك (not هكذا)", prompt)
        self.assertIn("REPLY LANGUAGE", prompt)
        self.assertIn("I need to go to the bathroom", prompt)


class WatchTests(unittest.TestCase):
    def test_known_wrong_phrases_are_found(self):
        self.assertTrue(scan_dialect("أهلاً! كيف فيك اليوم؟"))
        self.assertTrue(scan_dialect("تقولها هكذا"))
        self.assertTrue(scan_dialect("شو حابب نتكلم عنه"))
        self.assertEqual(scan_dialect("أهلين! كيف الحال؟ بنقولها هيك."), [])


class FilterTests(unittest.TestCase):
    def feed(self, *parts):
        f = SpeechTextFilter()
        return "".join(f.feed(part) for part in parts)

    def test_markdown_marks_are_dropped_however_the_text_is_sliced(self):
        self.assertEqual(self.feed("هو **Guten Morgen**."), "هو Guten Morgen.")
        self.assertEqual(self.feed("هو *", "*Guten", " Morgen*", "*."), "هو Guten Morgen.")

    def test_a_stop_after_a_closing_quote_is_dropped(self):
        self.assertEqual(self.feed('You can say “I need to go.”', "."), "You can say “I need to go.”")
        self.assertEqual(self.feed("“Hi.”", ".", " Next"), "“Hi.” Next")

    def test_repeated_marks_collapse_but_ellipsis_stays(self):
        self.assertEqual(self.feed("Great!!"), "Great!")
        self.assertEqual(self.feed("Well..."), "Well...")

    def test_ordinary_text_is_untouched(self):
        text = "Use “need” for a polite request. Wie geht's? شو الأخبار؟"
        self.assertEqual(self.feed(text), text)


class LeakedNoteTests(unittest.TestCase):
    """Seen in a real call: "ممتاز!User wants continue.إذا ..." was spoken and shown."""

    def feed(self, *parts):
        f = SpeechTextFilter()
        return "".join(f.feed(part) for part in parts) + f.pending

    def test_the_leaked_sentence_is_dropped_and_the_rest_kept(self):
        self.assertEqual(self.feed("ممتاز!User wants continue.إذا حبيتي"), "ممتاز!إذا حبيتي")
        self.assertEqual(self.feed("تمام. User wants continue. جربي مرة ثانية."), "تمام. جربي مرة ثانية.")

    def test_result_does_not_depend_on_how_the_stream_is_cut(self):
        text = "ممتاز!User wants continue.إذا قصدك “Ich muss **auf** die Toilette.”. We should respond in Arabic. تمام؟؟"
        expected = self.feed(text)
        self.assertNotIn("User", expected)
        self.assertNotIn("We should", expected)
        self.assertNotIn("**", expected)
        for step in (1, 2, 3, 5, 7):
            cuts = [text[i : i + step] for i in range(0, len(text), step)]
            with self.subTest(step=step):
                self.assertEqual(self.feed(*cuts), expected)

    def test_ordinary_english_and_german_sentences_pass(self):
        for text in (
            "Use “need” for a polite request.",
            "The bathroom is called Toilette.",
            "We should practise this again, okay?",
            "Guten Morgen means good morning.",
            "I need to go to the bathroom.",
            "User interface is a noun.",
        ):
            with self.subTest(text=text):
                self.assertEqual(self.feed(text), text)

    def test_text_held_while_it_might_be_a_note_is_released_at_the_end(self):
        f = SpeechTextFilter()
        self.assertEqual(f.feed("The"), "")
        self.assertEqual(f.pending, "The")

    def test_only_a_few_characters_are_ever_held(self):
        f = SpeechTextFilter()
        self.assertEqual(f.feed("Hello there"), "Hello there")

    def test_watch_flags_the_leak(self):
        self.assertTrue(scan_dialect("ممتاز! User wants continue."))


class CleanerInAPipelineTests(unittest.TestCase):
    def test_text_frames_reach_the_voice_cleaned_and_only_once(self):
        async def go():
            frames = [
                LLMFullResponseStartFrame(),
                LLMTextFrame("هو “**Guten "),
                LLMTextFrame("Morgen**.”"),
                LLMTextFrame("."),
                LLMFullResponseEndFrame(),
            ]
            down, _ = await run_test(RitaSpeechCleaner(), frames_to_send=frames)
            return "".join(f.text for f in down if isinstance(f, LLMTextFrame))

        self.assertEqual(asyncio.run(go()), "هو “Guten Morgen.”")

    def test_a_leaked_note_never_reaches_the_voice(self):
        async def go():
            frames = [
                LLMFullResponseStartFrame(),
                LLMTextFrame("ممتاز!"),
                LLMTextFrame("User wa"),
                LLMTextFrame("nts continue."),
                LLMTextFrame("جربي مرة ثانية."),
                LLMFullResponseEndFrame(),
            ]
            down, _ = await run_test(RitaSpeechCleaner(), frames_to_send=frames)
            return "".join(f.text for f in down if isinstance(f, LLMTextFrame))

        self.assertEqual(asyncio.run(go()), "ممتاز!جربي مرة ثانية.")


if __name__ == "__main__":
    unittest.main()
