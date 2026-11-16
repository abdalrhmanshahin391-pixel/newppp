import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bot  # noqa: E402
from rita_state import RitaSessionState  # noqa: E402

TWO_OPTIONS = "بدك نكمل ولا نغيّر الموضوع؟"


def prompt(state=None, *, dialogue=False, body=None):
    return bot.build_prompt(body or {}, state or RitaSessionState(), dialogue=dialogue)


def section(text: str, heading: str) -> str:
    start = text.index(heading)
    rest = text[start + len(heading):]
    stops = [rest.find(marker) for marker in ("\n\n", "\nCURRICULUM LESSON")]
    stops = [position for position in stops if position >= 0]
    return rest[: min(stops)] if stops else rest


def test_the_prompt_keeps_stop_words_thinking_sounds_and_one_question():
    text = prompt()
    for needle in ("خلص", "mean stop talking", "Thinking sounds", "At most one question",
                   "Ending without a question is fine"):
        assert needle in text, needle


def test_the_prompt_asks_for_short_replies_that_answer_what_was_meant():
    text = prompt()
    assert "One or two short sentences (about 20 words)" in text
    assert "what the learner MEANT" in text
    assert "Start with the answer" in text


def test_the_prompt_asks_for_a_human_neutral_tone():
    body = section(prompt(), "HOW YOU TALK")
    assert "without gender" in body and "إنتِ" in body and "خدي" in body
    assert "spoken Jordanian" in body


def test_misheard_speech_gets_the_likely_meaning_or_one_short_question():
    body = section(prompt(), "HOW YOU TALK")
    assert "Speech recognition" in body and "makes mistakes" in body
    assert "most likely meaning" in body and "one short question" in body
    assert "Never answer the garbled words literally" in body


def test_a_phrase_to_learn_is_offered_only_when_it_helps():
    text = prompt(body={"mode": "free_conversation"})
    assert "only when it helps" in text
    assert "Not in every reply" in text and "Not every turn" in text


def test_prompt_forbids_text_only_pronunciation_judgments():
    text = prompt()
    assert "transcript, not audio" in text


def test_the_raw_session_state_is_no_longer_sent():
    state = RitaSessionState()
    state.observe_assistant_turn(TWO_OPTIONS)
    state.observe_user_turn("إيه")
    for dialogue in (False, True):
        text = prompt(state, dialogue=dialogue)
        for field in ("awaiting=", "last_question=", "options=", "topic=", "last_feedback=", "response_type="):
            assert field not in text, field


def test_a_stop_turn_does_not_echo_the_old_topic():
    state = RitaSessionState()
    state.observe_user_turn("شو بتعرفي عن الثورة الفرنسية؟")
    state.observe_user_turn("خلص")
    text = prompt(state, dialogue=True)
    assert "الثورة الفرنسية" not in text.split("SESSION STATE", 1)[1]


def test_a_dont_know_turn_carries_the_directive():
    state = RitaSessionState()
    state.observe_assistant_turn("أي جزء يهمك؟ الأحداث، الشخصيات، ولا الأفكار؟")
    state.observe_user_turn("مش عارف")
    assert "pick the simplest option yourself" in prompt(state, dialogue=True)


def test_arabic_only_holds_for_the_rest_of_the_call():
    state = RitaSessionState(active_language="ar")
    state.observe_user_turn("احكي معي عربي، ليش بتخلطي؟")
    assert "ARABIC ONLY" in prompt(state, dialogue=True)
    state.observe_user_turn("طيب شو رأيك نحكي عن الشغل")
    assert "ARABIC ONLY" in prompt(state, dialogue=True)
    fresh = RitaSessionState(active_language="ar")
    fresh.observe_user_turn("بدي أتعلم كلمات عن السفر")
    assert "ARABIC ONLY" not in prompt(fresh, dialogue=True)


def test_lesson_prompt_still_carries_the_lesson():
    text = prompt(body={"lesson": {"brief": "Lesson: The verb to be"}})
    assert "CURRICULUM LESSON" in text and "HOW YOU TALK" in text
