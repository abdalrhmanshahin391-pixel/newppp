import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bot
from rita_dialect import asks_how_to_say
from rita_language_commands import detect_language_command
from rita_state import LanguageSource, RitaSessionState, infer_turn_language


def language_of(text, how_to_say=False):
    command = detect_language_command(text, how_to_say=how_to_say)
    return command.language if command else None


class OrdersThatChangeTheReplyLanguage(unittest.TestCase):
    """Sentences the learner really said in the long conversation, and their close variants."""

    def test_a_hamza_in_the_verb_makes_no_difference(self):
        for text in ("أحكي معي بالإنجليزي", "احكي معي بالانجليزي", "أحكي معي باللغة الإنجليزية"):
            with self.subTest(text=text):
                self.assertEqual(language_of(text), "en")

    def test_explain_orders_change_the_explanation_language(self):
        for text, language in (
            ("اشرحلي بالإنجليزي", "en"),
            ("تشرحي لي بالإنجليزي قاعدة الداتيف", "en"),
            ("اشرحلي بالعربي", "ar"),
            ("Explain in Arabic", "ar"),
            ("explain dative in English", "en"),
            ("Can you explain this in German?", "de"),
        ):
            with self.subTest(text=text):
                self.assertEqual(language_of(text), language)

    def test_english_and_german_orders(self):
        for text, language in (
            ("Please speak English", "en"),
            ("speak German", "de"),
            ("Can you speak in English?", "en"),
            ("let's talk Arabic", "ar"),
            ("sprich bitte Deutsch", "de"),
            ("Antworte auf Englisch", "en"),
        ):
            with self.subTest(text=text):
                self.assertEqual(language_of(text), language)

    def test_jordanian_and_standard_arabic_keep_their_dialect(self):
        self.assertEqual(detect_language_command("احكي معي باللهجة الأردنية").dialect, "ar-JO")
        self.assertEqual(detect_language_command("احكي معي بالفصحى").dialect, "standard")
        self.assertEqual(detect_language_command("احكي معي عربي فصيح").dialect, "standard")

    def test_mentioning_a_language_is_not_an_order(self):
        for text in (
            "I speak German at work",
            "I speak Germany",
            "talk about German grammar",
            "سو لما أحكي معك بالإنجليزي",
            "أنا بحكي بالإنجليزي كل يوم",
            "I wasn't talking about P",
            "What is the German word for work?",
        ):
            with self.subTest(text=text):
                self.assertIsNone(detect_language_command(text))

    def test_how_to_say_questions_are_not_orders_to_talk(self):
        for text in ("كيف احكي بالانجليزي", "كيف أحكي بدي أروح على الحمام بالإنجليزي"):
            with self.subTest(text=text):
                self.assertTrue(asks_how_to_say(text))
                self.assertIsNone(detect_language_command(text, how_to_say=True))

    def test_but_an_order_to_explain_inside_a_how_to_say_question_counts(self):
        text = "اشرحلي بالانجليزي كيف اقولها بالالماني"
        self.assertTrue(asks_how_to_say(text))
        self.assertEqual(language_of(text, how_to_say=True), "en")


class WhatShallWeTalkAboutIsNotHowToSay(unittest.TestCase):
    def test_shu_nehki_asks_for_a_topic(self):
        for text in ("مش عارف شو نحكي", "شو نحكي هلق؟", "شو نحكي اليوم"):
            with self.subTest(text=text):
                self.assertFalse(asks_how_to_say(text))

    def test_real_how_to_say_questions_still_count(self):
        for text in (
            "كيف أحكي بدي أروح بالإنجليزي",
            "شو بنقول صباح الخير بالألماني",
            "شو أحكي بالإنجليزي لما أشكر حدا",
            "How do I say I want to order pizza in German?",
            "wie sagt man das",
        ):
            with self.subTest(text=text):
                self.assertTrue(asks_how_to_say(text))


class WhatCountsAsGerman(unittest.TestCase):
    def test_a_thinking_sound_is_not_german(self):
        self.assertEqual(infer_turn_language("Äh. You are so confused. You don't understand."), "en")
        self.assertEqual(infer_turn_language("Ähm, I want to practise ordering food"), "en")

    def test_english_words_that_are_also_german_do_not_count(self):
        self.assertEqual(infer_turn_language("I was there yesterday with my friend"), "en")
        self.assertEqual(infer_turn_language("They will die laughing at this"), "en")

    def test_real_german_is_still_german(self):
        self.assertEqual(infer_turn_language("Ich habe Hunger und möchte essen"), "de")
        self.assertEqual(infer_turn_language("Wie geht es dir heute"), "de")


class ConversationFromThePdf(unittest.TestCase):
    def test_an_english_order_holds_and_the_pizza_question_is_answered_in_english(self):
        state = RitaSessionState()
        state.observe_user_turn("أحكي معي بالإنجليزي")
        self.assertEqual(state.active_language, "en")
        self.assertEqual(state.language_source, LanguageSource.EXPLICIT)
        state.observe_user_turn("How to say I want to order pizza in German?")
        self.assertEqual(state.active_language, "en")
        directive = state.turn_directive()
        self.assertIn("explanation in English", directive)
        self.assertNotIn("learner's own language", directive)

    def test_a_typed_sentence_about_speaking_german_does_not_lock_german(self):
        state = RitaSessionState()
        state.observe_user_turn("I speak Germany a little, I want to practise")
        self.assertNotEqual(state.language_source, LanguageSource.EXPLICIT)
        self.assertEqual(state.active_language, "automatic")

    def test_asking_what_to_talk_about_does_not_trigger_the_how_to_say_note(self):
        state = RitaSessionState()
        state.observe_user_turn("مش عارف شو نحكي")
        self.assertFalse(state.asked_how_to_say)


class ReplyLanguageLine(unittest.TestCase):
    def test_the_line_names_the_language_and_the_examples(self):
        state = RitaSessionState()
        state.observe_user_turn("احكي معي بالإنجليزي")
        line = state.reply_language_line("German")
        self.assertIn("REPLY LANGUAGE: ENGLISH", line)
        self.assertIn("The learner asked for this", line)
        self.assertIn("EXAMPLES AND TARGET PHRASES IN: GERMAN", line)

    def test_before_a_language_is_known_it_follows_the_learner(self):
        self.assertIn("language of the learner's last turn", RitaSessionState().reply_language_line())

    def test_the_prompt_ends_with_the_line_after_the_per_turn_state(self):
        state = RitaSessionState(active_language="en")
        body = {"targetLanguage": {"code": "de", "name": "German", "speechCode": "de"}}
        text = bot.build_prompt(body, state, dialogue=True)
        self.assertTrue(text.rstrip().endswith("do not translate them unless asked."))
        self.assertGreater(text.index("REPLY LANGUAGE: ENGLISH"), text.index("Structured session state:"))
        self.assertNotIn("Never answer fully in English", text)


if __name__ == "__main__":
    unittest.main()
