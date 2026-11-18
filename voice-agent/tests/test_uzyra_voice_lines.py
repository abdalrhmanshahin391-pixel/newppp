"""The study circle's recorded lines: one pair per circle action, short, and gender-neutral."""

import re

from uzyra_voice_lines import LINES, line_files

ACTIONS = {
    "make_cards", "make_mcq", "explain", "meaning", "word_by_word", "why_form",
    "compare_arabic", "simplify", "common_mistake", "summarize_section", "explain_reply", "report", "translate",
}


def test_every_circle_action_has_two_lines():
    assert set(LINES) == ACTIONS
    assert all(len(texts) == 2 for texts in LINES.values())


def test_lines_are_short_and_never_name_the_learner_by_gender():
    for texts in LINES.values():
        for text in texts:
            assert len(text.split()) <= 7, text
            # No second-person endings or commands that need a masculine or feminine form.
            assert not re.search(r"(لك|لِك|كِ|ي\b.*صحح|انتبه|تفضّل|جرّب|قول)", text), text


def test_file_names_are_stable():
    names = [name for name, _ in line_files()]
    assert len(names) == len(set(names)) == 26
    assert names[0] == "make_cards-1.mp3"


def test_only_records_the_named_actions():
    assert [name for name, _ in line_files("translate")] == ["translate-1.mp3", "translate-2.mp3"]
    try:
        line_files("nope")
    except ValueError:
        pass
    else:
        raise AssertionError("an unknown action must be refused")


def test_board_narration_uses_the_selected_voice_and_language(monkeypatch):
    import asyncio
    import base64
    import aiohttp
    from unittest.mock import AsyncMock, MagicMock
    from uzyra_voice_lines import CARTESIA_VERSION, MODEL, narrate_board_step

    response = MagicMock(status=200, read=AsyncMock(return_value=b"speech bytes"))
    session = MagicMock()
    session.post.return_value.__aenter__.return_value = response
    client = MagicMock()
    client.return_value.__aenter__.return_value = session
    monkeypatch.setattr(aiohttp, "ClientSession", client)
    monkeypatch.setenv("CARTESIA_API_KEY", "fixture")
    monkeypatch.setenv("RITA_CARTESIA_VOICE_ID", "fixture-voice")

    audio = asyncio.run(narrate_board_step("Start here.", "en"))
    assert base64.b64decode(audio) == b"speech bytes"
    args = session.post.call_args.kwargs
    assert args["headers"]["Cartesia-Version"] == CARTESIA_VERSION
    assert args["json"]["model_id"] == MODEL
    assert args["json"]["language"] == "en"
    assert args["json"]["voice"]["id"] == "fixture-voice"
    assert args["json"]["transcript"] == "Start here."

    response.status = 503
    assert asyncio.run(narrate_board_step("Start here.", "en")) is None
