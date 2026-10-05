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


def test_cloud_worker_keeps_base_image_entrypoint():
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    assert "dailyco/pipecat-base" in dockerfile
    assert "CMD " not in dockerfile
    assert "uv sync --inexact --no-dev" in dockerfile


def test_onnx_smart_turn_does_not_pull_gpu_runtime():
    project = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert "local-smart-turn" not in project
    assert 'pipecat-ai[daily,groq,runner,silero,soniox]==0.0.105' in project
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert "LocalSmartTurnAnalyzerV3()" in source


def test_development_runner_is_not_imported_by_cloud_worker():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert 'if __name__ == "__main__":\n    from pipecat.runner.run import main' in source


def test_groq_reasoning_effort_uses_supported_settings_extra():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert 'extra={"reasoning_effort": "low"}' in source
    assert '\n            reasoning_effort="low",' not in source
