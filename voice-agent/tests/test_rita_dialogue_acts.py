import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rita_dialogue_acts import (  # noqa: E402
    Act,
    Awaiting,
    classify,
    clarify_choice,
    interrupts_speaking_bot,
    normalize,
    parse_last_question,
)


class NormalizeTests(unittest.TestCase):
    def test_spelling_variants_become_one_form(self):
        self.assertEqual(normalize("خلصصص"), normalize("خلص"))
        self.assertEqual(normalize("أمممم"), normalize("امم"))
        self.assertEqual(normalize("إيه؟"), normalize("ايه"))
        self.assertEqual(normalize("  Okay!!  "), "okay")
        self.assertEqual(normalize("I don't know"), "i don t know")
        self.assertEqual(normalize(""), "")
        self.assertEqual(normalize(None), "")


class StopTests(unittest.TestCase):
    def test_the_words_from_the_real_session(self):
        for text in (
            "خلص، خلص.", "خلص، وقفي.", "خلص", "وقفي", "كفاية", "ستوب", "stop", "enough",
            "لا، لا، خلص اسكتي", "خلص، انسي، مش محتاج", "بلاش", "خلصنا",
        ):
            with self.subTest(text=text):
                self.assertEqual(classify(text).act, Act.STOP)

    def test_stop_with_politeness_or_refusal(self):
        for text in ("طيب خلص", "لو سمحت وقف", "okay stop", "لا خلص", "no stop", "بس خلص", "that's enough"):
            with self.subTest(text=text):
                self.assertEqual(classify(text).act, Act.STOP)

    def test_things_that_only_look_like_stop(self):
        for text in (
            "بس بدي أسأل",  # "but I want to ask"
            "خلصت التمرين",  # "I finished the exercise"
            "خلصنا؟",  # "are we done?"
            "بس هاي مش واضحة",
            "I stop at the station every day",
            "ما خلصنا بعد",
        ):
            with self.subTest(text=text):
                self.assertNotEqual(classify(text).act, Act.STOP)


class HesitationAndWaitTests(unittest.TestCase):
    def test_fillers_are_hesitation(self):
        for text in ("أمم", "اممم...", "يعني...", "um", "äh", "hmm", "أمم يعني"):
            with self.subTest(text=text):
                self.assertEqual(classify(text).act, Act.HESITATION)

    def test_wait_words(self):
        for text in ("استنى", "لحظة", "hold on", "one moment", "ثانية وحدة"):
            with self.subTest(text=text):
                self.assertEqual(classify(text).act, Act.WAIT)

    def test_hesitation_before_a_refusal_is_still_a_refusal(self):
        self.assertEqual(classify("أمم. نوب. بقول نوب.").act, Act.NO)
        self.assertEqual(classify("أمم نوب").act, Act.NO)


class AnswerTests(unittest.TestCase):
    def test_bare_yes_is_an_answer_only_after_a_question(self):
        self.assertEqual(classify("إيه", awaiting=Awaiting.YES_NO).act, Act.YES)
        self.assertEqual(classify("إيه", awaiting=Awaiting.CHOICE).act, Act.YES)
        self.assertEqual(classify("إيه", awaiting=Awaiting.OPEN).act, Act.UNCLEAR)
        self.assertEqual(classify("إيه", awaiting=Awaiting.NONE).act, Act.BACKCHANNEL)
        self.assertEqual(classify("إيه", bot_speaking=True, awaiting=Awaiting.CHOICE).act, Act.BACKCHANNEL)

    def test_strong_yes_and_no(self):
        self.assertEqual(classify("ايوه").act, Act.YES)
        self.assertEqual(classify("نعم").act, Act.YES)
        self.assertEqual(classify("لا").act, Act.NO)
        self.assertEqual(classify("نوب").act, Act.NO)
        self.assertEqual(classify("nope").act, Act.NO)
        self.assertEqual(classify("nein").act, Act.NO)
        self.assertEqual(classify("لا شكراً").act, Act.NO)

    def test_dont_know(self):
        for text in ("مش عارف.", "مش عارفة", "ما بعرف", "I don't know", "keine Ahnung", "والله مش عارف"):
            with self.subTest(text=text):
                self.assertEqual(classify(text).act, Act.DONT_KNOW)

    def test_correction(self):
        for text in (
            "لا قصدي الخميس", "لا أقصد الخميس", "مش هيك", "قصدي الثلاثاء",
            "مش باي", "I meant Tuesday", "i mean Tuesday",
        ):
            with self.subTest(text=text):
                self.assertEqual(classify(text).act, Act.CORRECTION)

    def test_complaint_and_simplify_are_explicit_acts(self):
        for text in ("الصوت مقطع", "الرد مش منطقي", "بتخبصي", "you are not responding"):
            with self.subTest(text=text):
                self.assertEqual(classify(text).act, Act.COMPLAINT)
        for text in ("اشرحي أبسط", "بطريقة أبسط", "يعني لشخص مبتدئ", "make it simpler"):
            with self.subTest(text=text):
                self.assertEqual(classify(text).act, Act.SIMPLIFY)

    def test_continue_repeat_understood(self):
        self.assertEqual(classify("كمّل").act, Act.CONTINUE)
        self.assertEqual(classify("go on").act, Act.CONTINUE)
        self.assertEqual(classify("عيدي").act, Act.REPEAT)
        self.assertEqual(classify("مرة ثانية").act, Act.REPEAT)
        self.assertEqual(classify("شو؟").act, Act.REPEAT)
        self.assertEqual(classify("فهمت").act, Act.UNDERSTOOD)
        self.assertEqual(classify("got it").act, Act.UNDERSTOOD)
        self.assertNotEqual(classify("ما فهمت").act, Act.UNDERSTOOD)
        self.assertNotEqual(classify("I don't get it").act, Act.UNDERSTOOD)

    def test_real_sentences_are_never_an_act(self):
        for text in (
            "شو بتعرفي عن الثورة الفرنسية؟",
            "Guten Morgen",
            "كيف بنحكيها بالإنجليزي؟",
            "بدي أتعلم الألماني",
            "Can you explain the difference between a and an?",
            "",
        ):
            with self.subTest(text=text):
                self.assertEqual(classify(text).act, Act.OTHER)


class InterruptionTests(unittest.TestCase):
    def interrupts(self, text):
        return interrupts_speaking_bot(text)[0]

    def test_commands_interrupt_even_as_one_word(self):
        for text in ("خلص", "وقفي", "كفاية", "stop", "wait", "لحظة", "لا", "بس", "عيدي", "فهمت"):
            with self.subTest(text=text):
                self.assertTrue(self.interrupts(text))

    def test_listening_noises_do_not_interrupt(self):
        for text in ("آه", "مم", "أها", "تمام", "ايه", "mhm", "yeah", "okay", "أمم", "نعم", "كمل", "صح تمام"):
            with self.subTest(text=text):
                self.assertFalse(self.interrupts(text))

    def test_a_real_sentence_interrupts(self):
        self.assertTrue(self.interrupts("شو يعني هاي الكلمة"))
        self.assertTrue(self.interrupts("ليش"))
        self.assertFalse(self.interrupts("هاي"))  # one unknown word


class QuestionTests(unittest.TestCase):
    def test_the_two_option_question_from_the_session(self):
        q = parse_last_question("طيب، أي جزء من الثورة الفرنسية يهمك أكثر؟ الأحداث، الشخصيات، ولا الأفكار؟")
        self.assertEqual(q.awaiting, Awaiting.CHOICE)
        self.assertEqual(q.options, ("الأحداث", "الشخصيات", "الأفكار"))

    def test_continue_or_change_topic(self):
        q = parse_last_question("بدك نكمل ولا نغيّر الموضوع؟")
        self.assertEqual((q.awaiting, q.options), (Awaiting.CHOICE, ("نكمل", "نغيّر الموضوع")))
        self.assertEqual(clarify_choice(q, "ar"), "أي واحد: نكمل ولا نغيّر الموضوع؟")

    def test_compound_question_joined_by_or_is_one_choice(self):
        q = parse_last_question("يعني حابب نكمل الثورة؟ أو في شي تاني حابب تحكي عنه؟ خبرني.")
        self.assertEqual(q.awaiting, Awaiting.CHOICE)
        self.assertEqual(len(q.options), 2)

    def test_open_yes_no_none(self):
        self.assertEqual(parse_last_question("شو بتحب تاكل، بيتزا؟").awaiting, Awaiting.OPEN)
        self.assertEqual(parse_last_question("What did you do today?").awaiting, Awaiting.OPEN)
        self.assertEqual(parse_last_question("Are you ready?").awaiting, Awaiting.YES_NO)
        self.assertEqual(parse_last_question("تمام، خلصنا هون.").awaiting, Awaiting.NONE)
        self.assertEqual(parse_last_question("").awaiting, Awaiting.NONE)

    def test_question_marks_and_or_words_inside_quotes_do_not_create_fake_options(self):
        q = parse_last_question('هل العبارة "So I have to go to the bathroom?" صحيحة؟')
        self.assertEqual(q.awaiting, Awaiting.YES_NO)
        self.assertEqual(q.options, ())
        q = parse_last_question('هل تقول "Excuse me?" أو تشرح المعنى؟')
        self.assertNotEqual(q.options, ('"Excuse me', '"'))

    def test_clarification_follows_the_language(self):
        q = parse_last_question("Tea or coffee?")
        self.assertEqual(clarify_choice(q, "en"), "Which one: Tea or coffee?")
        self.assertEqual(clarify_choice(parse_last_question("Tee oder Kaffee?"), "de"), "Welches: Tee oder Kaffee?")


if __name__ == "__main__":
    unittest.main()
