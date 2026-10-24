"""Modal deployment for the Rita realtime voice worker.

A warm, memory-snapshotted container removes the multi-second cold start of the
Pipecat Cloud worker. The website calls `start_session`; it creates the Daily room,
spawns the bot in the background and returns the room credentials immediately, so the
learner joins the room while Rita is still connecting.

Deploy: `modal deploy voice-agent/modal_app.py` (from the repository root), or let
`.github/workflows/rita-modal-deploy.yml` do it when the code reaches main.
Every module in this folder is shipped automatically (see WORKER_MODULES).
Secret `ritajet-voice` must contain SONIOX_API_KEY, GROQ_API_KEY, CARTESIA_API_KEY,
DAILY_API_KEY and RITA_MODAL_TOKEN (shared with the website as MODAL_START_TOKEN).
"""

from __future__ import annotations

import hmac
import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

import modal

# Every top-level module in this folder ships to Modal, so a new file can never be
# forgotten. Only the deploy script itself stays behind.
_HERE = Path(__file__).resolve().parent
WORKER_MODULES = sorted(
    path.stem
    for path in _HERE.glob("*.py")
    if path.stem != "modal_app" and not path.stem.startswith("_")
)

APP_NAME = "ritajet-voice"
SECRET_NAME = "ritajet-voice"
ROOM_LIFETIME_SECS = 60 * 60
DAILY_API = "https://api.daily.co/v1"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "pipecat-ai[cartesia,daily,groq,runner,silero,soniox]==0.0.105",
        "google-genai[aiohttp]==2.25.0",
        "python-dotenv>=1.1.0,<2",
        "fastapi[standard]",
    )
    # The deploy workflow sets RITA_GIT_SHA; the worker puts it in every turn record, so a
    # conversation can be tied to the exact build that handled it. Set before the local files so
    # the (slow) pip layer stays cached.
    .env({"RITA_GIT_SHA": os.environ.get("RITA_GIT_SHA", "")})
    .add_local_python_source(*WORKER_MODULES)
)

app = modal.App(APP_NAME, image=image)
secrets = [modal.Secret.from_name(SECRET_NAME)]


@app.cls(
    secrets=secrets,
    # The measured warm Cartesia path was ~30 ms faster in EU than US East,
    # and Rita's Soniox endpoint is EU as well. Broad EU keeps the lower 1.15x
    # regional multiplier and a larger capacity pool than a narrow region.
    region="eu",
    min_containers=1,
    scaledown_window=300,
    timeout=ROOM_LIFETIME_SECS + 300,
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=6)
class RitaWorker:
    @modal.enter(snap=True)
    def preload(self) -> None:
        """Runs once before the snapshot: heavy imports and model files, no sockets."""
        from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
        from pipecat.audio.vad.silero import SileroVADAnalyzer

        import bot  # noqa: F401  (imports pipecat, google-genai and every provider module)

        SileroVADAnalyzer()
        LocalSmartTurnAnalyzerV3()

    @modal.method()
    async def run_session(
        self, room_url: str, token: str, session_id: str, body: dict[str, Any]
    ) -> None:
        import bot

        await bot.run_bot(room_url=room_url, token=token, session_id=session_id, body=body)


@app.function(secrets=secrets, min_containers=1, scaledown_window=300)
async def diagnose_gemini_auth() -> dict[str, Any]:
    """Run a bounded, private Gemini credential check from the deployed Modal environment."""

    from rita_gemini_auth import run_gemini_auth_probe

    api_key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if not api_key:
        return {"outcome": "secret_missing"}
    result = await run_gemini_auth_probe(api_key)
    return result.public_dict()


@app.function(secrets=secrets, timeout=90)
async def diagnose_gemini_latency() -> dict[str, Any]:
    """Compare bounded SDK and REST first-audio timing without user content or secrets."""

    from rita_gemini_auth import run_gemini_latency_probe

    api_key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if not api_key:
        return {"outcome": "secret_missing"}
    result = await run_gemini_latency_probe(api_key)
    return result.public_dict()


@app.function(secrets=secrets, timeout=300, region="eu")
async def diagnose_content_probe() -> dict[str, Any]:
    """Ask the production LLM the fixed content corpus using Modal's private secret."""

    from rita_content_probe import run_probe

    return await run_probe()


@app.function(secrets=secrets, timeout=45)
async def diagnose_cartesia_tts() -> dict[str, Any]:
    """Privately verify Layan produces Arabic and German PCM; never return audio or secrets."""
    import aiohttp

    api_key = os.environ.get("CARTESIA_API_KEY", "").strip()
    if not api_key:
        return {"outcome": "secret_missing"}

    requests = (
        ("ar", "يسعدني أساعدك."),
        ("de", "Guten Morgen, wie geht es dir?"),
    )
    results: list[dict[str, Any]] = []
    headers = {
        "Cartesia-Version": "2026-08-14",
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    }
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as http:
        for language, transcript in requests:
            started_at = time.perf_counter()
            async with http.post(
                "https://api.cartesia.ai/tts/bytes",
                headers=headers,
                json={
                    "model_id": "sonic-3.6",
                    "transcript": transcript,
                    "voice": "64a941ac-07ac-462c-a81c-008e353dd83e",
                    "output_format": {
                        "container": "raw",
                        "encoding": "pcm_s16le",
                        "sample_rate": 24000,
                    },
                    "generation_config": {"speed": 1, "volume": 1},
                    "language": language,
                },
            ) as response:
                audio = await response.read()
                results.append(
                    {
                        "language": language,
                        "http_status": response.status,
                        # This endpoint buffers the entire body. It is deliberately
                        # not labelled TTFA because it cannot measure first audio.
                        "full_response_ms": round(
                            (time.perf_counter() - started_at) * 1000, 2
                        ),
                        "pcm_bytes": len(audio) if response.status < 400 else 0,
                    }
                )
    return {
        "outcome": "ok" if all(item["http_status"] == 200 and item["pcm_bytes"] > 0 for item in results) else "failed",
        "model": "sonic-3.6",
        "voice_id": "64a941ac-07ac-462c-a81c-008e353dd83e",
        "results": results,
    }


async def _run_cartesia_ws_benchmark() -> dict[str, Any]:
    """Run the privacy-safe WebSocket matrix with the existing Modal secret."""

    from rita_cartesia_benchmark import run_cartesia_ws_benchmark

    api_key = os.environ.get("CARTESIA_API_KEY", "").strip()
    if not api_key:
        return {"outcome": "secret_missing"}
    return await run_cartesia_ws_benchmark(api_key)


@app.function(secrets=secrets, timeout=180, region="eu")
async def benchmark_cartesia_eu() -> dict[str, Any]:
    """Measure Cartesia over one warm socket from Modal's broad EU region."""

    return await _run_cartesia_ws_benchmark()


@app.function(secrets=secrets, timeout=180, region="us-east")
async def benchmark_cartesia_us_east() -> dict[str, Any]:
    """Measure Cartesia over one warm socket from Modal US East."""

    return await _run_cartesia_ws_benchmark()


@app.function(secrets=secrets, timeout=300, region="eu")
async def benchmark_cartesia_trim_safety_eu() -> dict[str, Any]:
    """Validate that trimming remains before Cartesia's first phoneme."""

    from rita_cartesia_benchmark import run_cartesia_trim_safety_benchmark

    api_key = os.environ.get("CARTESIA_API_KEY", "").strip()
    if not api_key:
        return {"outcome": "secret_missing"}
    return await run_cartesia_trim_safety_benchmark(api_key)


@app.function(secrets=secrets, timeout=120, region="eu")
async def benchmark_cartesia_trim_safety_batch(
    category: str, repetition: int
) -> dict[str, Any]:
    """Run one isolated safety batch to contain provider context stalls."""

    from rita_cartesia_benchmark import run_cartesia_trim_safety_batch

    api_key = os.environ.get("CARTESIA_API_KEY", "").strip()
    if not api_key:
        return {"outcome": "secret_missing"}
    return await run_cartesia_trim_safety_batch(
        api_key, category=category, repetition=repetition
    )


@app.function(secrets=secrets, timeout=300, region="eu")
async def validate_cartesia_trim_with_soniox(category: str) -> dict[str, Any]:
    """Compare synthetic raw/trimmed speech through Soniox without exposing text."""

    from rita_cartesia_benchmark import run_cartesia_trim_safety_batch

    cartesia_api_key = os.environ.get("CARTESIA_API_KEY", "").strip()
    soniox_api_key = os.environ.get("SONIOX_API_KEY", "").strip()
    if not cartesia_api_key or not soniox_api_key:
        return {"outcome": "secret_missing"}
    result = await run_cartesia_trim_safety_batch(
        cartesia_api_key,
        category=category,
        repetition=0,
        soniox_api_key=soniox_api_key,
    )
    # The per-sample objects are intentionally withheld from CLI output. Only
    # aggregate equivalence and byte-safety counters leave the container.
    return {
        "category": category,
        "successful_samples": result.get("successful_samples"),
        "failed_samples": result.get("failed_samples"),
        "error_types": result.get("error_types", {}),
        "soniox_validation": result.get("soniox_validation", {}),
    }


@app.function(secrets=secrets, timeout=45)
async def diagnose_cartesia_worker_import() -> dict[str, Any]:
    """Verify the production Pipecat Cartesia adapter can be constructed without a call."""
    from rita_cartesia_tts import RitaCartesiaTTSService

    service = RitaCartesiaTTSService(
        api_key=os.environ.get("CARTESIA_API_KEY", ""),
        voice_id="64a941ac-07ac-462c-a81c-008e353dd83e",
    )
    return {
        "outcome": "ok",
        "service": type(service).__name__,
        "model": service.MODEL,
        "sample_rate": service.SAMPLE_RATE,
        "aggregation": "token",
    }


@app.local_entrypoint()
def latency_probe() -> None:
    """Run one paid, four-request diagnostic and print only its safe timing result."""

    print(json.dumps(diagnose_gemini_latency.remote(), ensure_ascii=False, indent=2))


@app.local_entrypoint()
def content_probe() -> None:
    """Run the content corpus in Modal and fail the command when any case fails."""

    from rita_content_probe import print_result

    failed = print_result(diagnose_content_probe.remote())
    if failed:
        raise SystemExit(min(failed, 125))


@app.local_entrypoint()
def cartesia_probe() -> None:
    """Run two tiny private Cartesia checks and print only their safe summary."""

    print(json.dumps(diagnose_cartesia_tts.remote(), ensure_ascii=False, indent=2))


@app.local_entrypoint()
def cartesia_worker_import_probe() -> None:
    """Print a safe construction check for the production TTS adapter."""

    print(json.dumps(diagnose_cartesia_worker_import.remote(), ensure_ascii=False, indent=2))


@app.local_entrypoint()
def cartesia_ws_benchmark() -> None:
    """Compare the same bounded warm-WebSocket matrix in EU and US East."""

    results = {
        "eu": benchmark_cartesia_eu.remote(),
        "us_east": benchmark_cartesia_us_east.remote(),
    }
    print(json.dumps(results, ensure_ascii=False, indent=2))


@app.local_entrypoint()
def cartesia_trim_safety_benchmark() -> None:
    """Run the bounded private onset-safety corpus in Modal EU."""

    from concurrent.futures import ThreadPoolExecutor

    from rita_cartesia_benchmark import summarize_trim_safety

    jobs = [
        (category, repetition)
        for repetition in range(2)
        for category in ("ar", "de", "en", "mixed")
    ]
    # Keep provider load conservative. The four-way run produced intermittent
    # context errors that were unrelated to the trim detector.
    with ThreadPoolExecutor(max_workers=1) as executor:
        batches = list(
            executor.map(
                lambda job: benchmark_cartesia_trim_safety_batch.remote(*job),
                jobs,
            )
        )
    samples = [sample for batch in batches for sample in batch.get("samples", [])]
    successful = [sample for sample in samples if "error_type" not in sample]
    summary = summarize_trim_safety(successful)
    if len(successful) != len(samples):
        # A passing subset must never authorize production trimming when any
        # requested language could not be validated.
        summary["safe_to_enable"] = False
        summary["selected_preroll_ms"] = None
    result = {
        "outcome": "ok" if len(successful) == len(samples) else "partial",
        "successful_samples": len(successful),
        "failed_samples": len(samples) - len(successful),
        "summary": summary,
        "batches": [
            {
                "category": batch.get("category"),
                "repetition": batch.get("repetition"),
                "successful_samples": batch.get("successful_samples"),
                "failed_samples": batch.get("failed_samples"),
                "error_types": batch.get("error_types", {}),
            }
            for batch in batches
        ],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


@app.local_entrypoint()
def cartesia_trim_batch_probe(category: str = "ar", repetition: int = 0) -> None:
    """Print one language batch while diagnosing a provider capability gap."""

    batch = benchmark_cartesia_trim_safety_batch.remote(category, repetition)
    public = {
        "category": batch.get("category"),
        "repetition": batch.get("repetition"),
        "successful_samples": batch.get("successful_samples"),
        "failed_samples": batch.get("failed_samples"),
        "error_types": batch.get("error_types", {}),
    }
    print(json.dumps(public, ensure_ascii=False, indent=2))


@app.local_entrypoint()
def cartesia_trim_soniox_validation() -> None:
    """Validate the shortlisted detector against Soniox in four languages."""

    results = {
        category: validate_cartesia_trim_with_soniox.remote(category)
        for category in ("ar", "de", "en", "mixed")
    }
    totals = {
        "samples": sum(
            item.get("soniox_validation", {}).get("samples", 0)
            for item in results.values()
        ),
        "raw_has_text": sum(
            item.get("soniox_validation", {}).get("raw_has_text", 0)
            for item in results.values()
        ),
        "trimmed_has_text": sum(
            item.get("soniox_validation", {}).get("trimmed_has_text", 0)
            for item in results.values()
        ),
        "first_token_equal": sum(
            item.get("soniox_validation", {}).get("first_token_equal", 0)
            for item in results.values()
        ),
        "full_text_equal": sum(
            item.get("soniox_validation", {}).get("full_text_equal", 0)
            for item in results.values()
        ),
        "exact_suffix": sum(
            item.get("soniox_validation", {}).get("exact_suffix", 0)
            for item in results.values()
        ),
    }
    totals["safe_to_canary"] = bool(totals["samples"]) and all(
        totals[key] == totals["samples"]
        for key in ("raw_has_text", "trimmed_has_text", "first_token_equal", "exact_suffix")
    )
    print(json.dumps({"totals": totals, "categories": results}, ensure_ascii=False, indent=2))


async def _daily_post(session, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ["DAILY_API_KEY"].strip()
    async with session.post(
        f"{DAILY_API}{path}",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
    ) as response:
        data = await response.json()
        if response.status >= 400:
            raise RuntimeError(f"Daily {path} failed with HTTP {response.status}")
        return data


async def _create_session(body: dict[str, Any]) -> dict[str, Any]:
    """Create one production-equivalent Daily room and start the deployed worker."""
    import aiohttp

    session_id = str(body.get("appSessionId") or uuid.uuid4())
    trace_id = str(body.get("traceId") or "")[:64]
    expires = int(time.time()) + ROOM_LIFETIME_SECS
    started_at = time.perf_counter()

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as http:
        room_started_at = time.perf_counter()
        room = await _daily_post(
            http,
            "/rooms",
            {
                "privacy": "private",
                "properties": {"exp": expires, "eject_at_room_exp": True, "max_participants": 2},
            },
        )
        room_ms = round((time.perf_counter() - room_started_at) * 1000, 2)
        learner_started_at = time.perf_counter()
        learner = await _daily_post(
            http,
            "/meeting-tokens",
            {"properties": {"room_name": room["name"], "exp": expires, "is_owner": False}},
        )
        learner_token_ms = round((time.perf_counter() - learner_started_at) * 1000, 2)
        bot_started_at = time.perf_counter()
        bot_token = await _daily_post(
            http,
            "/meeting-tokens",
            {"properties": {"room_name": room["name"], "exp": expires, "is_owner": True}},
        )
        bot_token_ms = round((time.perf_counter() - bot_started_at) * 1000, 2)

    spawn_started_at = time.perf_counter()
    call = await RitaWorker().run_session.spawn.aio(
        room["url"], bot_token["token"], session_id, body
    )
    spawn_ms = round((time.perf_counter() - spawn_started_at) * 1000, 2)
    return {
        "dailyRoom": room["url"],
        "dailyToken": learner["token"],
        "sessionId": call.object_id,
        "diagnostics": {
            "traceId": trace_id or None,
            "dailyRoomMs": room_ms,
            "dailyLearnerTokenMs": learner_token_ms,
            "dailyBotTokenMs": bot_token_ms,
            "workerSpawnRequestMs": spawn_ms,
            "modalTotalMs": round((time.perf_counter() - started_at) * 1000, 2),
        },
    }


@app.function(secrets=secrets, timeout=30)
async def prepare_voice_probe() -> dict[str, Any]:
    """Start the fixed synthetic canary through authenticated Modal RPC."""
    return await _create_session(
        {
            "appSessionId": str(uuid.uuid4()),
            "traceId": str(uuid.uuid4()),
            "language": "automatic",
            "dialect": "ar-JO",
            "mode": "free_conversation",
            "personality": "kind",
            "trimLeadingSilence": True,
        }
    )


@app.function(secrets=secrets, min_containers=1, scaledown_window=300)
@modal.fastapi_endpoint(method="POST", docs=False)
async def start_session(payload: dict[str, Any]):
    """Create a Daily room, start Rita in the background and return the learner's token."""
    from fastapi import HTTPException

    expected = os.environ.get("RITA_MODAL_TOKEN", "").strip()
    supplied = str(payload.get("token") or "").strip()
    if not expected or not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="unauthorized")

    body = payload.get("body") if isinstance(payload.get("body"), dict) else {}
    return await _create_session(body)


@app.function(secrets=secrets, timeout=240, region="eu")
@modal.fastapi_endpoint(method="POST", docs=False)
async def replay_turns(payload: dict[str, Any]):
    """Answer past learner turns with the current build (used to test a fix). Text only, no audio."""
    from fastapi import HTTPException

    expected = os.environ.get("RITA_MODAL_TOKEN", "").strip()
    supplied = str(payload.get("token") or "").strip()
    if not expected or not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="unauthorized")

    from rita_replay import run_replay

    return await run_replay(payload)

