"""Offline checks of the lesson-page probe: its rules catch the mistakes found with the real model,
and its prompts are the ones the worker builds on the lesson page. No network."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rita_lesson_probe import CASES, case_messages, check_reply, print_result, split_reply
from rita_study_voice import STUDY_TURN_NOTE, StudyVoice, study_turn_note


def case(case_id):
    return next(item for item in CASES if item.id == case_id)


def test_cases_have_unique_ids_and_a_reason():
    ids = [item.id for item in CASES]
    assert len(ids) == len(set(ids))
    assert all(item.what for item in CASES)
    assert all(bool(item.action) != bool(item.text) for item in CASES)


def test_the_reply_is_split_at_the_sheet():
    assert split_reply("جملة. [[SHEET]]\n# عنوان\n- نقطة") == ("جملة.", "# عنوان\n- نقطة")
    assert split_reply("جملة بس.") == ("جملة بس.", "")


def test_a_sheet_after_thanks_and_a_pointer_without_a_sheet_are_caught():
    thanks = case("voice-thanks")
    assert check_reply(thanks, "تمام، التفاصيل تحت. [[SHEET]]\n# شكر\n- Danke")
    assert check_reply(thanks, "تمام، بالتوفيق.") == []
    confused = case("voice-did-not-understand")
    assert "points below, but there is no sheet" in check_reply(
        confused, "عادي. مثلاً \"Ich habe gegessen\" يعني أكلت. التفاصيل تحت."
    )


def test_gendered_commands_are_caught_in_speech_and_in_the_sheet():
    explain = case("explain-ar")
    assert check_reply(explain, "شوف، الجملة بالماضي. [[SHEET]]\n# مثال\n= Ich **habe** gespielt.")
    assert check_reply(explain, "الجملة بالماضي. [[SHEET]]\n# مثال\n! لا تنسى haben.")
    assert check_reply(explain, "الجملة بتحكي عن شي صار مبارح. [[SHEET]]\n# مثال\n= Ich **habe** gespielt.") == []
    # An adjective in the sheet describes a word, not the learner.
    assert check_reply(explain, "الجملة بالماضي. [[SHEET]]\n# مثال\n- نضيف gespielt: الجملة جاهزة") == []


def test_claiming_a_save_and_inventing_off_topic_details_are_caught():
    save = case("voice-save-word")
    assert check_reply(save, "تمام، حفظتها بالبطاقات.")
    assert check_reply(save, "ما بقدر أحفظها بالصوت، بس بتحديدها واختيار «بطاقات» من الدائرة بتصير بطاقة.") == []
    off = case("voice-off-topic")
    assert check_reply(off, "في مطاعم كتير حلوة بعمان.")
    assert check_reply(off, "هاي بتختلف حسب الذوق، خلّينا نرجع للدرس.") == []


def test_the_probe_builds_the_lesson_page_prompt():
    prompt, messages, _options, _bot = case_messages(case("explain-ar"))
    assert "INTERACTIVE STUDY" in prompt and "CURRENT REQUEST" in prompt
    assert messages == [{"role": "user", "content": "[اشرحلي] «Ich habe gestern Fußball gespielt.»"}]
    prompt, messages, _options, _bot = case_messages(case("voice-off-topic"))
    assert STUDY_TURN_NOTE in prompt
    assert prompt.index(STUDY_TURN_NOTE) > prompt.index("SESSION STATE")
    assert messages[0]["content"] == case("voice-off-topic").text


def test_the_lesson_note_stays_away_while_the_learner_is_busy():
    voice = StudyVoice()
    assert study_turn_note(None) == ""
    assert study_turn_note(voice).startswith("LESSON PAGE NOTE")
    voice.set_state({"state": "practicing"})
    assert study_turn_note(voice) == ""


def test_a_missing_key_fails_every_run_without_calling_the_model(capsys):
    result = {"outcome": "secret_missing", "passed": 0, "failed": 3, "cases": []}
    assert print_result(result) == 3
    assert "GROQ_API_KEY" in capsys.readouterr().err
