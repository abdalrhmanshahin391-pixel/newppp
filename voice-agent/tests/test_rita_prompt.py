from bot import build_prompt
from rita_state import RitaSessionState


def prompt() -> str:
    body = {"personality": "kind", "language": "automatic", "dialect": "ar-JO", "mode": "free_conversation"}
    return build_prompt(body, RitaSessionState(active_language="automatic", active_dialect="ar-JO"))


def test_prompt_forbids_markdown_emphasis_and_lists():
    text = prompt()
    assert "Never use asterisks, bullets, or numbered points" in text


def test_prompt_has_a_gentle_correction_pattern_and_no_flat_refusal():
    text = prompt()
    assert "TEACHING RHYTHM" in text
    assert "ask the learner to try it" in text
    assert "Never answer with a flat refusal" in text


def test_prompt_never_claims_live_news_and_confirms_unclear_hearing():
    text = prompt()
    assert "You have no live data" in text
    assert 'ask one short confirmation ("Did you say ...?")' in text
