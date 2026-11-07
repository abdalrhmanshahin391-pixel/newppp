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


def test_form_reason_request_uses_the_same_voice_lifecycle():
    voice = StudyVoice.from_body(BODY)
    request = voice.take_action({
        "request_id": "why-form-1",
        "action": "why_form",
        "quote": "studies",
        "context": "He studies English. study -> studies",
    })
    assert request is not None and request.action == "why_form"
    assert "He studies English." in voice.section()
    assert "ليش هيك؟" in voice.user_line()
    assert voice.cancel({"request_id": "why-form-1"})
    assert voice.request is None


def test_mistake_prevention_request_preserves_rule_context_and_cancel():
    voice = StudyVoice.from_body(BODY)
    request = voice.take_action({
        "request_id": "mistake-1", "action": "common_mistake",
        "quote": "add -s", "context": "With he, she or it add -s. He works every day.",
    })
    assert request is not None and request.action == "common_mistake"
    assert "He works every day." in voice.section()
    assert "انتبه للغلطة" in voice.user_line()
    assert voice.cancel({"request_id": "mistake-1"})
    assert voice.request is None


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
    assert "handle_study_message(study_voice, message_type" in source
    module = (ROOT / "rita_study_voice.py").read_text(encoding="utf-8")
    for kind in ("rita-study-state", "rita-study-focus", "rita-study-action", "rita-study-cancel", "rita-study-say"):
        assert f'"{kind}"' in module
    # The spoken lesson and the lesson engine are untouched (ST-V07).
    assert "{lesson_engine_section(body, lesson_voice) or lesson_section(body)}" in source


from rita_study_voice import handle_study_message  # noqa: E402


def test_st_v01_other_sessions_ignore_study_messages():
    effects = handle_study_message(None, "rita-study-action", {"request_id": "a", "action": "explain", "quote": "x"})
    assert effects == type(effects)()


def test_st_v02_state_and_focus_never_run_the_model():
    voice = StudyVoice.from_body(BODY)
    for kind, data in (("rita-study-state", {"state": "practicing"}), ("rita-study-focus", {"section": "s1", "text": "x"})):
        effects = handle_study_message(voice, kind, data)
        assert effects.refresh_prompt and not effects.run_model and not effects.interrupt and effects.ack is None


def test_st_v03_an_action_interrupts_answers_and_acks_started():
    voice = StudyVoice.from_body(BODY)
    effects = handle_study_message(
        voice, "rita-study-action", {"request_id": "r1", "action": "explain", "quote": "are", "context": "I am / you are"}
    )
    assert effects.interrupt and effects.refresh_prompt and effects.run_model
    assert effects.user_line == "[اشرحلي] «are»"
    assert effects.ack == {"type": "rita-study-ack", "request_id": "r1", "state": "started"}


def test_a_bad_action_is_acked_failed_without_a_model_call():
    voice = StudyVoice.from_body(BODY)
    effects = handle_study_message(voice, "rita-study-action", {"request_id": "r2", "action": "hack", "quote": "x"})
    assert effects.ack == {"type": "rita-study-ack", "request_id": "r2", "state": "failed"}
    assert not effects.run_model and not effects.interrupt


def test_st_v05_cancel_stops_only_the_current_request_and_always_acks():
    voice = StudyVoice.from_body(BODY)
    handle_study_message(voice, "rita-study-action", {"request_id": "r1", "action": "explain", "quote": "are", "context": "x"})
    other = handle_study_message(voice, "rita-study-cancel", {"request_id": "old"})
    assert not other.interrupt and other.ack["state"] == "cancelled"
    stop = handle_study_message(voice, "rita-study-cancel", {"request_id": "r1"})
    assert stop.interrupt and stop.refresh_prompt and stop.ack["state"] == "cancelled"


def test_say_is_bounded_and_needs_text():
    voice = StudyVoice.from_body(BODY)
    assert handle_study_message(voice, "rita-study-say", {"text": "انحفظت ٥ بطاقات"}).say == "انحفظت ٥ بطاقات"
    assert len(handle_study_message(voice, "rita-study-say", {"text": "a" * 2000}).say) == 300
    assert handle_study_message(voice, "rita-study-say", "not a dict").say == ""


# A part of Rita's own answer the learner did not understand ("explain_reply").
from rita_study_voice import ACTIONS, MAX_CONTEXT, reply_context  # noqa: E402


def test_explain_reply_takes_its_context_from_ritas_own_answer():
    voice = StudyVoice()
    replies = [
        "مرحبا",
        "With he, add -s.\n[[SHEET]]\n| s, sh | add -es | watch → **watches** |",
    ]
    effects = handle_study_message(
        voice,
        "rita-study-action",
        {"request_id": "q1", "action": "explain_reply", "quote": "add -es watch → watches", "context": "page copy"},
        replies,
    )
    assert effects.run_model and effects.interrupt
    assert "[[SHEET]]" in voice.request.context  # her own copy, not the page's
    assert voice.user_line() == "[اشرحلي ببساطة] «add -es watch → watches»"
    section = voice.section()
    assert "YOUR EARLIER ANSWER" in section and "child" in ACTIONS["explain_reply"]


def test_explain_reply_uses_the_page_copy_when_rita_has_none():
    voice = StudyVoice()
    handle_study_message(
        voice,
        "rita-study-action",
        {"request_id": "q2", "action": "explain_reply", "quote": "written earlier", "context": "A reply written earlier"},
        ["something else"],
    )
    assert voice.request.context == "A reply written earlier"


def test_a_long_answer_is_cut_around_the_quote():
    reply = "a " * 3000 + "THE PART " + "b " * 3000
    context = reply_context("the part", [reply], "")
    assert len(context) <= MAX_CONTEXT
    assert "THE PART" in context


def test_no_quote_no_request():
    voice = StudyVoice()
    effects = handle_study_message(
        voice, "rita-study-action", {"request_id": "q3", "action": "explain_reply", "quote": ""}, []
    )
    assert effects.ack["state"] == "failed"
