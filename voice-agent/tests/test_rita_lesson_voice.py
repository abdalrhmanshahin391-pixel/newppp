"""Lessons with exercises: how Rita reads a learner turn against the website's current step."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rita_lesson_voice import (  # noqa: E402
    LessonVoice,
    clean_say,
    lesson_engine_enabled,
    lesson_engine_section,
)


def voice(phase, *, paused=False, options=("am", "is", "are"), revision=3):
    lesson = LessonVoice()
    step = {"revision": revision, "phase": phase, "paused": paused}
    if phase in {"guided", "practice", "remediation"}:
        step["item"] = {"id": "p1", "prompt": "She ___ a teacher.", "options": list(options)}
        step["item_number"] = 2
        step["item_count"] = 5
    if phase == "explain":
        step["explain"] = {
            "rule_ar": "مع I نقول am",
            "table": [{"left": "I", "right": "am"}],
            "examples": [{"text": "I am a student."}],
        }
        step["section"] = {"index": 0, "count": 2, "title": "I am", "title_ar": "الإثبات"}
    assert lesson.set_step(step)
    return lesson


def signal(lesson, text):
    route = lesson.route(text)
    return None if route is None else (route.signal, route.value, route.to_model)


def test_ready_words_start_and_no_question_moves_to_practice():
    assert signal(voice("intro"), "يلا") == ("ready", "", False)
    assert signal(voice("intro"), "ok let's go") == ("ready", "", False)
    assert signal(voice("intro"), "يلا يلا تمام") == ("ready", "", False)
    assert signal(voice("explain"), "لا") == ("no_question", "", False)
    assert signal(voice("explain"), "يب فهمت") == ("no_question", "", False)
    assert signal(voice("explain"), "ما عندي سؤال") == ("no_question", "", False)
    assert signal(voice("section_result"), "تمام") == ("ready", "", False)


def test_not_understood_during_the_explanation_asks_for_another_explanation():
    assert signal(voice("explain"), "لا مش فاهم") == ("repeat", "", True)
    assert signal(voice("explain"), "ما فهمت") == ("repeat", "", True)


def test_a_question_during_the_explanation_goes_to_the_model():
    assert signal(voice("explain"), "ليش بنقول is مع it؟") == ("question", "", True)
    assert signal(voice("explain"), "why is it is") == ("question", "", True)
    assert signal(voice("explain"), "شو الفرق بين الجماد والمفرد") == ("question", "", True)


def test_an_answer_to_the_open_question_goes_to_the_website_not_the_model():
    lesson = voice("practice")
    assert signal(lesson, "is") == ("answer", "is", False)
    assert signal(lesson, "it is is") == ("answer", "it is is", False)
    assert signal(lesson, "الثاني") == ("answer", "الثاني", False)
    assert signal(lesson, "his") == ("answer", "his", False)  # the website marks it unclear


def test_a_question_in_the_middle_of_an_exercise_is_not_taken_as_an_answer():
    lesson = voice("practice")
    assert signal(lesson, "ليش is؟") == ("question", "", True)
    assert signal(lesson, "مش فاهم") == ("question", "", True)
    assert signal(lesson, "عندي سؤال") == ("question", "", True)


def test_exercise_commands():
    lesson = voice("practice")
    assert signal(lesson, "تلميح") == ("hint", "", False)
    assert signal(lesson, "ما بعرف") == ("hint", "", False)
    assert signal(lesson, "عيدي السؤال") == ("repeat", "", False)
    assert signal(lesson, "وقف") == ("pause", "", False)
    assert signal(lesson, "تمام") == ("ack", "", False)


def test_an_option_that_looks_like_a_command_is_still_an_answer():
    lesson = voice("practice", options=("ok", "no", "help"))
    assert signal(lesson, "help") == ("answer", "help", False)


def test_paused_resume_or_question():
    lesson = voice("practice", paused=True)
    assert signal(lesson, "كمل") == ("resume", "", False)
    assert signal(lesson, "يعني مع they دايما are؟") == ("question", "", True)


def test_fillers_and_finished_lessons_are_left_to_the_normal_router():
    assert voice("practice").route("امم") is None
    assert voice("done").route("يلا") is None
    assert LessonVoice().route("is") is None


def test_an_older_step_never_replaces_a_newer_one():
    lesson = voice("practice", revision=5)
    assert not lesson.set_step({"revision": 4, "phase": "explain"})
    assert lesson.phase == "practice"
    assert lesson.set_step({"revision": 6, "phase": "section_result"})
    assert not lesson.set_step("not a dict")


def test_the_step_block_tells_rita_what_to_do_without_any_answer():
    text = voice("practice").step_text()
    assert "Open question 2 of 5" in text
    assert "never «صح» or «غلط»" in text
    explain = voice("explain").step_text()
    assert "Rule to teach: مع I نقول am" in explain
    assert "عندك سؤال قبل ما نتمرن؟" in explain
    assert "I → am" in explain


def test_the_engine_section_only_for_engine_lessons():
    lesson = voice("intro")
    assert lesson_engine_enabled({"lesson": {"engine": True}})
    assert not lesson_engine_enabled({"lesson": {"brief": "x"}})
    assert lesson_engine_section({"lesson": {"brief": "x"}}, lesson) == ""
    section = lesson_engine_section({"lesson": {"engine": True, "title": "to be"}}, lesson)
    assert "LESSON MODE" in section and "CURRICULUM LESSON: to be" in section
    assert "never say that an answer is right or wrong" in section


def test_clean_say_is_one_bounded_line():
    assert clean_say("  صح!\n\n He مفرد  ") == "صح! He مفرد"
    assert len(clean_say("a" * 2000)) == 600
    assert clean_say(None) == ""
