import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from rita_study_voice import StudyVoice, study_enabled, study_section  # noqa: E402

BODY = {
    "mode": "study_lesson",
    "study": {
        "lessonId": "00000000-0000-0000-0000-000000000001",
        "title": "Third person -s",
        "sections": [{"id": "s1", "heading": "Spelling rules", "terms": ["-es"]}],
        "objectives": ["Add -s or -es with he, she and it"],
    },
}


def test_only_study_sessions_get_the_section():
    assert study_enabled(BODY)
    assert not study_enabled({"mode": "guided_lesson", "lesson": {"brief": "x"}})
    assert study_section({}, StudyVoice()) == ""
    assert study_section(BODY, None) == ""


def test_st_v06_outline_only_never_the_whole_guide():
    voice = StudyVoice.from_body(BODY)
    text = study_section(BODY, voice)
    assert "INTERACTIVE STUDY" in text
    assert "Spelling rules" in text and "-es" in text
    assert "Never read it aloud" in text
    assert "CURRENT REQUEST" not in text


def test_state_and_focus_do_not_add_a_request():
    voice = StudyVoice.from_body(BODY)
    assert voice.set_state({"state": "practicing"})
    assert voice.quiet
    assert "stay quiet" in voice.section()
    assert not voice.set_state({"state": "dancing"})
    assert voice.set_focus({"section": "s1", "text": "work → works"})
    assert "Part in focus: s1: work → works" in voice.section()
    assert voice.request is None


def test_st_v03_a_new_action_replaces_the_old_one_and_keeps_a_short_history():
    voice = StudyVoice.from_body(BODY)
    first = voice.take_action({"request_id": "a", "action": "explain", "quote": "are", "context": "I am / you are"})
    assert first and voice.state == "acting"
    second = voice.take_action({"request_id": "b", "action": "simplify", "quote": "is", "context": "he is"})
    assert second and voice.request.request_id == "b"
    section = voice.section()
    assert "Selected text: «is»" in section and "Selected text: «are»" not in section
    assert "Earlier requests: explain: are" in section


def test_st_v05_cancel_stops_the_request_and_late_copies_are_ignored():
    voice = StudyVoice.from_body(BODY)
    voice.take_action({"request_id": "a", "action": "explain", "quote": "are", "context": "x"})
    assert voice.cancel({"request_id": "a"})
    assert voice.request is None and voice.state == "reading"
    assert voice.take_action({"request_id": "a", "action": "explain", "quote": "are", "context": "x"}) is None


def test_bad_actions_are_refused_and_text_is_bounded():
    voice = StudyVoice.from_body(BODY)
    assert voice.take_action({"request_id": "a", "action": "hack", "quote": "x"}) is None
    assert voice.take_action({"request_id": "", "action": "explain", "quote": "x"}) is None
    assert voice.take_action({"request_id": "a", "action": "explain", "quote": "", "context": ""}) is None
    request = voice.take_action(
        {"request_id": "z", "action": "explain", "quote": "a\x00b " * 400, "context": "c" * 9000}
    )
    assert request and len(request.quote) <= 600 and len(request.context) <= 2400
    assert "\x00" not in request.quote


def test_user_line_names_the_request_in_arabic():
    voice = StudyVoice.from_body(BODY)
    voice.take_action({"request_id": "a", "action": "explain", "quote": "are", "context": "x"})
    assert voice.user_line() == "[اشرحلي] «are»"


def test_bot_wires_the_study_section_and_messages():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert "{study_section(body, study_voice)}" in source
    for kind in ("rita-study-state", "rita-study-focus", "rita-study-action", "rita-study-cancel", "rita-study-say"):
        assert f'"{kind}"' in source
    # The spoken lesson and the lesson engine are untouched (ST-V07).
    assert "{lesson_engine_section(body, lesson_voice) or lesson_section(body)}" in source
