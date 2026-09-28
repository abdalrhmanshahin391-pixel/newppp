from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_approved_provider_contract_is_locked():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert 'STT_MODEL = "stt-rt-v5"' in source
    assert 'LLM_MODEL = "openai/gpt-oss-120b"' in source
    assert 'TTS_MODEL = "gemini-3.8-flash-lite-tts"' in source
    assert '"Achernar"' in source
    assert "Deepgram" not in source
    assert "OpenAI TTS" not in source


def test_no_provider_fallback_is_hidden_in_worker():
    worker = "\n".join(
        path.read_text(encoding="utf-8")
        for path in ROOT.glob("*.py")
    )
    assert "fallback" not in worker.casefold()
