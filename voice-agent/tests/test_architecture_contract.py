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
    bot = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert "class RitaCartesiaTTSService(CartesiaTTSService)" in source
    assert "text_aggregation_mode=TextAggregationMode.TOKEN" in source
    assert 'cartesia_version="2026-08-14"' in source
    assert "def set_turn_language" in source
    assert 'message["language"] = self._rita_language' in source
    assert 'message["max_buffer_delay_ms"] = self._rita_max_buffer_delay_ms' in source
    assert "max_buffer_delay_ms: int | None = 50" in source
    assert 'os.getenv("RITA_CARTESIA_MAX_BUFFER_DELAY_MS", "50")' in bot
    assert "max(50, configured)" in bot
    assert '"cartesia_context_cancelled"' in source
    assert "LeadingSilenceTrimmer" in source
    assert '"cartesia_trim_cancelled"' in source


def test_cartesia_leading_silence_trim_is_fail_open_and_feature_flagged():
    trimmer = (ROOT / "rita_leading_silence.py").read_text(encoding="utf-8")
    bot = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert "def _open_without_trimming" in trimmer
    assert "def cancel" in trimmer
    assert '"RITA_CARTESIA_TRIM_ENABLED", "true"' in bot
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


def test_content_probe_uses_the_private_modal_secret_and_has_no_public_endpoint():
    modal_app = (ROOT / "modal_app.py").read_text(encoding="utf-8")
    workflow = (ROOT.parent / ".github" / "workflows" / "rita-content-probe.yml").read_text(
        encoding="utf-8"
    )
    assert "async def diagnose_content_probe()" in modal_app
    decorator = modal_app.split("async def diagnose_content_probe()", 1)[0].rsplit(
        "@app.function", 1
    )[-1]
    assert "secrets=secrets" in decorator
    assert "fastapi_endpoint" not in decorator
    assert "modal run modal_app.py::content_probe" in workflow
    assert "secrets.GROQ_API_KEY" not in workflow


def test_voice_probe_uses_authenticated_modal_rpc_instead_of_a_shared_start_token():
    modal_app = (ROOT / "modal_app.py").read_text(encoding="utf-8")
    probe = (ROOT / "voice_probe.py").read_text(encoding="utf-8")
    workflow = (ROOT.parent / ".github" / "workflows" / "rita-v3-voice-probe.yml").read_text(
        encoding="utf-8"
    )
    assert "async def prepare_voice_probe()" in modal_app
    decorator = modal_app.split("async def prepare_voice_probe()", 1)[0].rsplit(
        "@app.function", 1
    )[-1]
    assert "secrets=secrets" in decorator
    assert "fastapi_endpoint" not in decorator
    assert 'Function.from_name("ritajet-voice", "prepare_voice_probe").remote()' in probe
    assert 'RITA_PROBE_USE_MODAL_RPC: "1"' in workflow
    assert "secrets.RITA_PROBE_START_TOKEN" not in workflow
    assert "secrets.RITA_PROBE_START_URL" not in workflow


def test_every_local_worker_module_is_shipped_to_modal():
    import modal_app

    local = {path.stem for path in ROOT.glob("*.py")} - {"modal_app"}
    shipped = set(modal_app.WORKER_MODULES)
    assert local <= shipped, f"modal_app.py does not ship: {sorted(local - shipped)}"
    # The worker's own imports must be among them.
    assert {"bot", "rita_word_joiner", "rita_turn_router", "rita_turn_policy"} <= shipped


def test_bounded_end_of_turn_commit_is_wired_and_cancellable():
    bot_source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert "RitaBoundedTurnStopStrategy(" in bot_source
    assert "LocalSmartTurnAnalyzerV3()" in bot_source
    policy = (ROOT / "rita_turn_policy.py").read_text(encoding="utf-8")
    assert "_handle_vad_user_started_speaking" in policy  # new speech must cancel a pending commit
    assert "MAX_BOUNDED_COMMIT_SECS" in policy


def test_a_committed_interruption_is_retried_only_when_it_missed_the_router():
    bot = (ROOT / "bot.py").read_text(encoding="utf-8")
    router = (ROOT / "rita_turn_router.py").read_text(encoding="utf-8")
    assert "last_routed_context_size" in router
    assert "committed_context_size = len(context.get_messages())" in bot
    assert "await asyncio.sleep(0.15)" in bot
    assert "router.last_routed_context_size >= committed_context_size" in bot
    assert "asyncio.create_task(recover_if_still_unrouted())" in bot
    assert "await aggregator.push_context_frame()" in bot


def test_every_turn_is_recorded_without_work_on_the_audio_path():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert "TurnLedger(" in source and "send_server_message(record)" in source
    # The record goes out from a background task, never awaited inside a frame handler's hot path.
    assert "asyncio.create_task(send_ledger(record))" in source
    assert "asyncio.create_task(finish_ledger(" in source
    # The old hard-coded claim that no reply was ever interrupted is gone.
    assert "interrupted=False" not in source


def test_the_deployed_commit_reaches_the_worker():
    modal_source = (ROOT / "modal_app.py").read_text(encoding="utf-8")
    workflow = (ROOT.parent / ".github" / "workflows" / "rita-modal-deploy.yml").read_text(encoding="utf-8")
    assert '.env({"RITA_GIT_SHA"' in modal_source
    assert "RITA_GIT_SHA: ${{ github.sha }}" in workflow
