import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rita_completeness import ends_on_hesitation, looks_complete


class LooksCompleteTests(unittest.TestCase):
    def test_the_failed_real_ipad_utterance_counts_as_complete(self):
        self.assertTrue(looks_complete("Hey, how are you?"))

    def test_complete_questions_and_statements_in_three_languages(self):
        for text in (
            "What does Guten Morgen mean?",
            "شو معنى صباح الخير بالألماني؟",
            "Wie sage ich das auf Deutsch?",
            "I want to practise ordering food.",
            "بدي أتدرب على المحادثة.",
            "Yes?",
        ):
            with self.subTest(text=text):
                self.assertTrue(looks_complete(text))

    def test_unfinished_speech_keeps_the_long_safety_net(self):
        for text in (
            "How are you",  # no terminal punctuation
            "I want to, um",
            "I think that.",  # ends on a connective
            "ich habe eine Frage, aber",
            "بدي أسألك عن...",
            "Well,",
            "Okay.",  # a single word statement
            "and",
            "",
            "   ",
        ):
            with self.subTest(text=text):
                self.assertFalse(looks_complete(text))

    def test_trailing_off_marks_are_never_complete(self):
        for text in ("So what I wanted to say…", "Let me think...", "Because:"):
            with self.subTest(text=text):
                self.assertFalse(looks_complete(text))


class ShortCommandsAndThinkingSoundsTests(unittest.TestCase):
    def test_clear_one_word_commands_and_answers_commit_quickly(self):
        for text in ("خلص.", "وقفي.", "نوب.", "نعم.", "فهمت.", "Stop.", "Nope.", "مش عارف."):
            with self.subTest(text=text):
                self.assertTrue(looks_complete(text))

    def test_thinking_sounds_never_complete_a_turn(self):
        for text in ("أمم.", "يعني.", "Um.", "أمم. يعني.", "I want to, um.", "بدي أسأل، أمم."):
            with self.subTest(text=text):
                self.assertFalse(looks_complete(text))
        self.assertTrue(ends_on_hesitation("بدي أسأل أمم"))
        self.assertFalse(ends_on_hesitation("بدي أسأل عن الدرس"))

    def test_a_bare_acknowledgement_is_still_not_a_finished_turn(self):
        for text in ("آه.", "تمام.", "Okay."):
            with self.subTest(text=text):
                self.assertFalse(looks_complete(text))


if __name__ == "__main__":
    unittest.main()


class UnpunctuatedTurnTests(unittest.TestCase):
    def test_a_finished_looking_turn_without_a_mark(self):
        from rita_completeness import looks_complete_unpunctuated as f

        self.assertTrue(f("كيف بدي أحكي صباح الخير بالألماني"))
        self.assertTrue(f("ich möchte einen Shawarma bitte"))

    def test_unfinished_or_too_short_turns_keep_the_long_wait(self):
        from rita_completeness import looks_complete_unpunctuated as f

        for text in ("شو يعني", "بدي أروح على", "أنا بدي يعني", "كيف بدي أحكي،", "كيف بدي أحكي…", "كيف الحال؟", "أمم"):
            self.assertFalse(f(text), text)

    def test_short_first_turn_greetings_commit_without_punctuation(self):
        from rita_completeness import looks_complete_short_unpunctuated as f

        for text in (
            "ألو مرحبا",
            "كيف حالك",
            "صباح الخير",
            "Hello",
            "How are you",
            "Guten Morgen",
            "Wie gehts",
        ):
            self.assertTrue(f(text), text)

    def test_short_fragments_and_hesitations_do_not_commit_early(self):
        from rita_completeness import looks_complete_short_unpunctuated as f

        for text in ("بدي أروح", "شو يعني", "أنا بدي", "ألو يعني", "أمم", "because I"):
            self.assertFalse(f(text), text)
