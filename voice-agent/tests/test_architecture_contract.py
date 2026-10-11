from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_approved_provider_contract_is_locked():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert 'STT_MODEL = "stt-rt-v5"' in source
    assert 'LLM_MODEL = "openai/gpt-oss-120b"' in source
    assert 'TTS_MODEL = "sonic-3.6"' in source
    assert 'TTS_PROVIDER = os.getenv("RITA_TTS_PROVIDER", "cartesia")' in source
    assert '"64a941ac-07ac-462c-a81c-008e353dd83e"' in source
    assert 'require_secret("CARTESIA_API_KEY")' in source
    assert "Deepgram" not in source
    assert "OpenAI TTS" not in source


def test_no_provider_fallback_is_hidden_in_worker():
    worker = "\n".join(path.read_text(encoding="utf-8") for path in ROOT.glob("*.py"))
    assert "fallback" not in worker.casefold()


def test_cloud_worker_keeps_base_image_entrypoint():
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    assert "dailyco/pipecat-base" in dockerfile
    assert "CMD " not in dockerfile
    assert "uv sync --inexact --no-dev" in dockerfile


def test_onnx_smart_turn_does_not_pull_gpu_runtime():
    project = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert "local-smart-turn" not in project
    assert "pipecat-ai[cartesia,daily,groq,runner,silero,soniox]==0.0.105" in project
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert "LocalSmartTurnAnalyzerV3()" in source


def test_development_runner_is_not_imported_by_cloud_worker():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert 'if __name__ == "__main__":\n    from pipecat.runner.run import main' in source


def test_groq_reasoning_effort_uses_supported_settings_extra():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert 'extra={"reasoning_effort": "low"}' in source
    assert '\n            reasoning_effort="low",' not in source


def test_modal_worker_is_warm_snapshotted_and_shares_the_bot_entrypoint():
    source = (ROOT / "modal_app.py").read_text(encoding="utf-8")
    assert "min_containers=1" in source
    assert 'region="eu"' in source
    assert "enable_memory_snapshot=True" in source
    assert "@modal.enter(snap=True)" in source
    assert "bot.run_bot(" in source
    assert "pipecat-ai[cartesia,daily,groq,runner,silero,soniox]==0.0.105" in source
    assert "hmac.compare_digest" in source


def test_cartesia_keeps_token_streaming_and_context_cancellation_contract():
    source = (ROOT / "rita_cartesia_tts.py").read_text(encoding="utf-8")
    assert "class RitaCartesiaTTSService(CartesiaTTSService)" in source
    assert "text_aggregation_mode=TextAggregationMode.TOKEN" in source
    assert 'cartesia_version="2026-08-14"' in source
    assert "def set_turn_language" in source
    assert 'message["language"] = self._rita_language' in source
    assert 'message["max_buffer_delay_ms"] = self._rita_max_buffer_delay_ms' in source
    assert "max_buffer_delay_ms: int | None = 0" in source
    assert '"cartesia_context_cancelled"' in source
    assert "LeadingSilenceTrimmer" in source
    assert '"cartesia_trim_cancelled"' in source


def test_cartesia_leading_silence_trim_is_fail_open_and_feature_flagged():
    trimmer = (ROOT / "rita_leading_silence.py").read_text(encoding="utf-8")
    bot = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert "def _open_without_trimming" in trimmer
    assert "def cancel" in trimmer
    assert '"RITA_CARTESIA_TRIM_ENABLED", "false"' in bot
    assert '"RITA_CARTESIA_TRIM_RMS_FLOOR", "32"' in bot
    assert '"RITA_CARTESIA_TRIM_PEAK_FLOOR", "128"' in bot
    assert 'body.get("trimLeadingSilence") is True' in bot


def test_cartesia_audio_measurement_is_not_mislabelled_as_listener_playback():
    source = (ROOT / "rita_latency.py").read_text(encoding="utf-8")
    assert 'self.mark("tts_first_audio_frame", turn=turn)' in source


def test_gemini_sdk_version_is_reproducible_and_private_probe_is_not_public_endpoint():
    project = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    modal_app = (ROOT / "modal_app.py").read_text(encoding="utf-8")
    assert "google-genai[aiohttp]==2.25.0" in project
    assert "async def diagnose_gemini_auth()" in modal_app
    assert "async def diagnose_gemini_latency()" in modal_app
    assert "@app.local_entrypoint()" in modal_app
    assert (
        "fastapi_endpoint"
        not in modal_app.split("async def diagnose_gemini_auth()", 1)[0].split(
            "@app.function(secrets=secrets, min_containers=1, scaledown_window=300)", 1
        )[-1]
    )
    latency_probe_decorator = modal_app.split("async def diagnose_gemini_latency()", 1)[0].rsplit(
        "@app.function", 1
    )[-1]
    assert "fastapi_endpoint" not in latency_probe_decorator
    assert "min_containers" not in latency_probe_decorator
