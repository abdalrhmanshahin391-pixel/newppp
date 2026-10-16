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


def test_the_prompt_teaches_stop_hesitation_choices_and_one_question():
    text = prompt()
    body = section(text, "TURN-TAKING AND SHORT REPLIES")
    for needle in ("خلص", "never mean \"summarize\"", "Thinking sounds", "أي واحد", "مش عارف",
                   "لا قصدي", "at most one question", "Never explain a word"):
        assert needle in body, needle


def test_the_prompt_asks_for_a_human_neutral_tone():
    body = section(prompt(), "HUMAN TONE")
    assert "warm friend" in body
    assert "gender" in body and "خدي" in body
    assert "never start two replies the same way" in body


def test_the_new_sections_stay_short_for_a_low_effort_model():
    text = prompt()
    words = len(section(text, "TURN-TAKING AND SHORT REPLIES").split()) + len(
        section(text, "HUMAN TONE").split()
    )
    assert words <= 330


def test_dialogue_state_is_only_added_when_the_router_is_on():
    state = RitaSessionState()
    state.observe_assistant_turn(TWO_OPTIONS)
    state.observe_user_turn("إيه")
    assert "awaiting=" not in prompt(state, dialogue=False)
    text = prompt(state, dialogue=True)
    assert "awaiting=choice" in text
    assert 'options="نكمل|نغيّر الموضوع"' in text


def test_a_stop_turn_tells_the_model_the_topic_is_paused():
    state = RitaSessionState()
    state.observe_user_turn("شو بتعرفي عن الثورة الفرنسية؟")
    state.observe_user_turn("خلص")
    text = prompt(state, dialogue=True)
    assert "topic_paused=True" in text
    assert "learner_act=stop" in text
    assert 'topic="شو بتعرفي عن الثورة الفرنسية؟"' in text


def test_a_dont_know_turn_carries_the_directive():
    state = RitaSessionState()
    state.observe_assistant_turn("أي جزء يهمك؟ الأحداث، الشخصيات، ولا الأفكار؟")
    state.observe_user_turn("مش عارف")
    assert "pick the simplest option yourself" in prompt(state, dialogue=True)


def test_lesson_prompt_still_carries_the_lesson():
    text = prompt(body={"lesson": {"brief": "Lesson: The verb to be"}})
    assert "CURRICULUM LESSON" in text and "TURN-TAKING AND SHORT REPLIES" in text
