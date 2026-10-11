"""Private, bounded Gemini TTS authentication diagnostics for Rita."""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import time
import base64
import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass
from typing import Any

from google import genai

GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_AUTH_PROBE_TEXT = "Hi."
GEMINI_LATENCY_PROBE_TEXT = "فهمت عليك. Guten Morgen يعني صباح الخير."
DEFAULT_TTS_STYLE = (
    "Natural close-mic conversation. Warm, quick and emotionally present, never theatrical. "
    "Use a friendly Jordanian accent for Arabic, natural native pronunciation for German and "
    "English words, and preserve seamless code-switching."
)


@dataclass(frozen=True)
class GeminiProbeAttempt:
    """Safe summary of one attempt; it contains no credential or provider response body."""

    transport: str
    accepted: bool
    status_code: int | None
    category: str


@dataclass(frozen=True)
class GeminiAuthProbeResult:
    """Safe result of comparing SDK and documented REST authentication."""

    outcome: str
    key_marker: str
    sdk_version: str
    sdk: GeminiProbeAttempt
    rest: GeminiProbeAttempt | None = None

    def public_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class GeminiLatencySample:
    """One safe latency sample; request/response text and credentials are never retained."""

    transport: str
    sequence: int
    accepted: bool
    status_code: int | None
    category: str
    client_init_ms: float | None = None
    stream_ready_ms: float | None = None
    first_event_ms: float | None = None
    first_audio_ms: float | None = None
    events_before_audio: int = 0
    first_audio_bytes: int = 0
    content_type: str | None = None
    service_tier: str | None = None
    quota_metric: str | None = None
    quota_id: str | None = None
    quota_dimensions: dict[str, str] | None = None
    retry_delay: str | None = None


@dataclass(frozen=True)
class GeminiLatencyProbeResult:
    """Bounded SDK-versus-REST TTS latency comparison from one runtime."""

    model: str
    voice: str
    sample_rate: int
    sdk_version: str
    key_marker: str
    samples: list[GeminiLatencySample]

    def public_dict(self) -> dict[str, Any]:
        return asdict(self)


def gemini_interaction_payload(
    *, text: str, model: str, voice: str, style: str, sample_rate: int
) -> dict[str, Any]:
    """Build the documented Interactions request shared by TTS and the auth probe."""

    return {
        "model": model,
        "input": [
            {
                "type": "user_input",
                "content": [
                    {
                        "type": "text",
                        "text": text,
                        "annotations": [{"type": "speech_metadata", "style": style}],
                    }
                ],
            }
        ],
        "response_format": {
            "type": "audio",
            "mime_type": "audio/l16",
            "sample_rate": sample_rate,
        },
        "generation_config": {"speech_config": [{"voice": voice}]},
    }


def _status_code(error: object) -> int | None:
    """Read common SDK/HTTP status fields without serializing the provider error."""

    for name in ("status_code", "code", "status"):
        value = getattr(error, name, None)
        if callable(value):
            value = value()
        if isinstance(value, int):
            return value
    response = getattr(error, "response", None)
    value = getattr(response, "status", None) or getattr(response, "status_code", None)
    return value if isinstance(value, int) else None


def gemini_error_category(error: object) -> tuple[str, int | None]:
    """Return a stable, non-sensitive category for user-visible and metrics errors."""

    status = _status_code(error)
    text = str(error).casefold()
    if status == 401 or "access_token_type_unsupported" in text or "unauthenticated" in text:
        return "authentication", status or 401
    if status == 403 or "permission_denied" in text:
        return "permission", status or 403
    if status == 429 or "resource_exhausted" in text:
        return "rate_limited", status or 429
    if "timeout" in text or "connect" in text:
        return "network", status
    return "provider", status


def _key_marker(api_key: str) -> str:
    """Short one-way marker proving a container sees a changed secret, never the secret itself."""

    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:12]


def _elapsed_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000, 2)


def _event_audio_bytes(event: Any) -> bytes:
    """Read an audio delta from either an SDK event or decoded REST SSE object."""

    if isinstance(event, dict):
        event_type = event.get("event_type") or event.get("eventType")
        delta = event.get("delta")
        if not isinstance(delta, dict):
            return b""
        delta_type = delta.get("type")
        data = delta.get("data")
    else:
        event_type = getattr(event, "event_type", None)
        delta = getattr(event, "delta", None)
        delta_type = getattr(delta, "type", None)
        data = getattr(delta, "data", None)
    if event_type != "step.delta" or delta_type != "audio":
        return b""
    if isinstance(data, bytes):
        return data
    if isinstance(data, str) and data:
        try:
            return base64.b64decode(data, validate=True)
        except (ValueError, TypeError):
            return b""
    return b""


def _decode_sse_json(line: bytes) -> dict[str, Any] | None:
    """Decode a complete Interactions SSE data line without retaining provider text."""

    value = line.strip()
    if not value or value.startswith(b":"):
        return None
    if value.startswith(b"data:"):
        value = value[5:].strip()
    if value in {b"", b"[DONE]"}:
        return None
    try:
        event = json.loads(value)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    return event if isinstance(event, dict) else None


def _safe_quota_details(payload: object) -> dict[str, Any]:
    """Extract only non-sensitive quota identifiers from a Google error payload."""

    if not isinstance(payload, dict):
        return {}
    error = payload.get("error")
    if not isinstance(error, dict):
        return {}
    result: dict[str, Any] = {}
    details = error.get("details")
    if not isinstance(details, list):
        return result
    for detail in details:
        if not isinstance(detail, dict):
            continue
        detail_type = str(detail.get("@type") or "")
        if detail_type.endswith("QuotaFailure"):
            violations = detail.get("violations")
            if not isinstance(violations, list) or not violations:
                continue
            violation = violations[0]
            if not isinstance(violation, dict):
                continue
            metric = violation.get("quotaMetric")
            quota_id = violation.get("quotaId")
            dimensions = violation.get("quotaDimensions")
            if isinstance(metric, str):
                result["quota_metric"] = metric[:200]
            if isinstance(quota_id, str):
                result["quota_id"] = quota_id[:200]
            if isinstance(dimensions, dict):
                result["quota_dimensions"] = {
                    str(key)[:80]: str(value)[:120]
                    for key, value in dimensions.items()
                    if isinstance(key, str) and isinstance(value, (str, int, float))
                }
        elif detail_type.endswith("RetryInfo"):
            retry_delay = detail.get("retryDelay")
            if isinstance(retry_delay, str):
                result["retry_delay"] = retry_delay[:40]
    return result


async def _sdk_auth_probe(
    api_key: str, *, model: str, voice: str, style: str, sample_rate: int
) -> GeminiProbeAttempt:
    client = genai.Client(api_key=api_key)
    try:
        stream = await client.aio.interactions.create(
            **gemini_interaction_payload(
                text=GEMINI_AUTH_PROBE_TEXT,
                model=model,
                voice=voice,
                style=style,
                sample_rate=sample_rate,
            ),
            stream=True,
        )
        # Authentication is accepted when the stream is created. Consume only one event so this
        # stays a tiny diagnostic instead of becoming a second conversation.
        async for _ in stream:
            break
        return GeminiProbeAttempt("sdk", True, 200, "ok")
    except Exception as error:  # noqa: BLE001 - provider SDK exposes several exception types.
        category, status = gemini_error_category(error)
        return GeminiProbeAttempt("sdk", False, status, category)
    finally:
        await client.aio.aclose()


async def _rest_auth_probe(
    api_key: str, *, model: str, voice: str, style: str, sample_rate: int
) -> GeminiProbeAttempt:
    """Use Google's documented REST authentication only after an SDK 401."""

    import aiohttp

    try:
        timeout = aiohttp.ClientTimeout(total=12)
        async with aiohttp.ClientSession(timeout=timeout) as session, session.post(
            GEMINI_INTERACTIONS_URL,
            headers={"x-goog-api-key": api_key},
            json=gemini_interaction_payload(
                text=GEMINI_AUTH_PROBE_TEXT,
                model=model,
                voice=voice,
                style=style,
                sample_rate=sample_rate,
            ),
        ) as response:
            if 200 <= response.status < 300:
                return GeminiProbeAttempt("rest", True, response.status, "ok")
            category, status = gemini_error_category(response)
            return GeminiProbeAttempt("rest", False, status or response.status, category)
    except Exception as error:  # noqa: BLE001 - classify transport failures without body text.
        category, status = gemini_error_category(error)
        return GeminiProbeAttempt("rest", False, status, category)


async def run_gemini_auth_probe(
    api_key: str,
    *,
    model: str = "gemini-3.8-flash-lite-tts",
    voice: str = "Achernar",
    style: str | None = None,
    sample_rate: int = 24_000,
    sdk_probe: Callable[..., Awaitable[GeminiProbeAttempt]] = _sdk_auth_probe,
    rest_probe: Callable[..., Awaitable[GeminiProbeAttempt]] = _rest_auth_probe,
) -> GeminiAuthProbeResult:
    """Diagnose Gemini authentication with no user speech and at most two tiny TTS requests."""

    sdk = await sdk_probe(
        api_key,
        model=model,
        voice=voice,
        style=style or DEFAULT_TTS_STYLE,
        sample_rate=sample_rate,
    )
    rest: GeminiProbeAttempt | None = None
    if sdk.accepted:
        outcome = "sdk_authenticated"
    elif sdk.status_code == 401:
        rest = await rest_probe(
            api_key,
            model=model,
            voice=voice,
            style=style or DEFAULT_TTS_STYLE,
            sample_rate=sample_rate,
        )
        outcome = "sdk_transport_mismatch" if rest.accepted else "credential_rejected"
    else:
        outcome = "sdk_request_rejected"
    return GeminiAuthProbeResult(
        outcome=outcome,
        key_marker=_key_marker(api_key),
        sdk_version=importlib.metadata.version("google-genai"),
        sdk=sdk,
        rest=rest,
    )


async def _sdk_latency_sample(
    client: Any,
    *,
    sequence: int,
    model: str,
    voice: str,
    style: str,
    sample_rate: int,
    client_init_ms: float | None,
) -> GeminiLatencySample:
    started_at = time.perf_counter()
    stream_ready_ms: float | None = None
    first_event_ms: float | None = None
    event_count = 0
    try:
        stream = await client.aio.interactions.create(
            **gemini_interaction_payload(
                text=GEMINI_LATENCY_PROBE_TEXT,
                model=model,
                voice=voice,
                style=style,
                sample_rate=sample_rate,
            ),
            stream=True,
        )
        stream_ready_ms = _elapsed_ms(started_at)
        async for event in stream:
            event_count += 1
            if first_event_ms is None:
                first_event_ms = _elapsed_ms(started_at)
            audio = _event_audio_bytes(event)
            if audio:
                return GeminiLatencySample(
                    transport="sdk",
                    sequence=sequence,
                    accepted=True,
                    status_code=200,
                    category="ok",
                    client_init_ms=client_init_ms,
                    stream_ready_ms=stream_ready_ms,
                    first_event_ms=first_event_ms,
                    first_audio_ms=_elapsed_ms(started_at),
                    events_before_audio=event_count - 1,
                    first_audio_bytes=len(audio),
                )
        return GeminiLatencySample(
            transport="sdk",
            sequence=sequence,
            accepted=False,
            status_code=200,
            category="no_audio",
            client_init_ms=client_init_ms,
            stream_ready_ms=stream_ready_ms,
            first_event_ms=first_event_ms,
            events_before_audio=event_count,
        )
    except Exception as error:  # noqa: BLE001 - provider SDK has several exception families.
        category, status = gemini_error_category(error)
        return GeminiLatencySample(
            transport="sdk",
            sequence=sequence,
            accepted=False,
            status_code=status,
            category=category,
            client_init_ms=client_init_ms,
            stream_ready_ms=stream_ready_ms,
            first_event_ms=first_event_ms,
            events_before_audio=event_count,
        )


async def _rest_latency_sample(
    session: Any,
    api_key: str,
    *,
    sequence: int,
    model: str,
    voice: str,
    style: str,
    sample_rate: int,
    client_init_ms: float | None,
) -> GeminiLatencySample:
    started_at = time.perf_counter()
    first_event_ms: float | None = None
    event_count = 0
    body = gemini_interaction_payload(
        text=GEMINI_LATENCY_PROBE_TEXT,
        model=model,
        voice=voice,
        style=style,
        sample_rate=sample_rate,
    )
    body["stream"] = True
    try:
        async with session.post(
            GEMINI_INTERACTIONS_URL,
            headers={"x-goog-api-key": api_key, "Accept": "text/event-stream"},
            json=body,
        ) as response:
            stream_ready_ms = _elapsed_ms(started_at)
            content_type = response.headers.get("content-type")
            service_tier = response.headers.get("x-gemini-service-tier")
            if response.status < 200 or response.status >= 300:
                category, status = gemini_error_category(response)
                quota = {}
                if response.status == 429:
                    try:
                        quota = _safe_quota_details(await response.json())
                    except (ValueError, TypeError):
                        quota = {}
                return GeminiLatencySample(
                    transport="rest",
                    sequence=sequence,
                    accepted=False,
                    status_code=status or response.status,
                    category=category,
                    client_init_ms=client_init_ms,
                    stream_ready_ms=stream_ready_ms,
                    content_type=content_type,
                    service_tier=service_tier,
                    quota_metric=quota.get("quota_metric"),
                    quota_id=quota.get("quota_id"),
                    quota_dimensions=quota.get("quota_dimensions"),
                    retry_delay=quota.get("retry_delay"),
                )
            async for line in response.content:
                event = _decode_sse_json(line)
                if event is None:
                    continue
                event_count += 1
                if first_event_ms is None:
                    first_event_ms = _elapsed_ms(started_at)
                audio = _event_audio_bytes(event)
                if audio:
                    return GeminiLatencySample(
                        transport="rest",
                        sequence=sequence,
                        accepted=True,
                        status_code=response.status,
                        category="ok",
                        client_init_ms=client_init_ms,
                        stream_ready_ms=stream_ready_ms,
                        first_event_ms=first_event_ms,
                        first_audio_ms=_elapsed_ms(started_at),
                        events_before_audio=event_count - 1,
                        first_audio_bytes=len(audio),
                        content_type=content_type,
                        service_tier=service_tier,
                    )
            return GeminiLatencySample(
                transport="rest",
                sequence=sequence,
                accepted=False,
                status_code=response.status,
                category="no_audio",
                client_init_ms=client_init_ms,
                stream_ready_ms=stream_ready_ms,
                first_event_ms=first_event_ms,
                events_before_audio=event_count,
                content_type=content_type,
                service_tier=service_tier,
            )
    except Exception as error:  # noqa: BLE001 - classify without retaining provider response text.
        category, status = gemini_error_category(error)
        return GeminiLatencySample(
            transport="rest",
            sequence=sequence,
            accepted=False,
            status_code=status,
            category=category,
            client_init_ms=client_init_ms,
            first_event_ms=first_event_ms,
            events_before_audio=event_count,
        )


async def run_gemini_latency_probe(
    api_key: str,
    *,
    model: str = "gemini-3.8-flash-lite-tts",
    voice: str = "Achernar",
    style: str | None = None,
    sample_rate: int = 24_000,
    attempts_per_transport: int = 2,
) -> GeminiLatencyProbeResult:
    """Measure SDK and documented REST streaming with two bounded, identical trials each."""

    import aiohttp

    attempts = max(1, min(attempts_per_transport, 2))
    sdk_init_started = time.perf_counter()
    client = genai.Client(api_key=api_key)
    sdk_init_ms = _elapsed_ms(sdk_init_started)
    rest_init_started = time.perf_counter()
    timeout = aiohttp.ClientTimeout(total=20, sock_connect=8, sock_read=15)
    session = aiohttp.ClientSession(timeout=timeout)
    rest_init_ms = _elapsed_ms(rest_init_started)
    samples: list[GeminiLatencySample] = []
    sdk_timed_out = False
    try:
        # REST runs first so a cancellation-resistant SDK call cannot hide all diagnostic evidence.
        for sequence in range(1, attempts + 1):
            try:
                rest_sample = await asyncio.wait_for(
                    _rest_latency_sample(
                        session,
                        api_key,
                        sequence=sequence,
                        model=model,
                        voice=voice,
                        style=style or DEFAULT_TTS_STYLE,
                        sample_rate=sample_rate,
                        client_init_ms=rest_init_ms if sequence == 1 else None,
                    ),
                    timeout=15,
                )
            except TimeoutError:
                rest_sample = GeminiLatencySample(
                    transport="rest",
                    sequence=sequence,
                    accepted=False,
                    status_code=None,
                    category="timeout",
                    client_init_ms=rest_init_ms if sequence == 1 else None,
                )
            samples.append(rest_sample)
            if rest_sample.category == "rate_limited":
                break
            sdk_task = asyncio.create_task(
                _sdk_latency_sample(
                    client,
                    sequence=sequence,
                    model=model,
                    voice=voice,
                    style=style or DEFAULT_TTS_STYLE,
                    sample_rate=sample_rate,
                    client_init_ms=sdk_init_ms if sequence == 1 else None,
                )
            )
            done, _ = await asyncio.wait({sdk_task}, timeout=15)
            if sdk_task in done:
                sdk_sample = sdk_task.result()
            else:
                sdk_task.cancel()
                sdk_timed_out = True
                sdk_sample = GeminiLatencySample(
                    transport="sdk",
                    sequence=sequence,
                    accepted=False,
                    status_code=None,
                    category="timeout",
                    client_init_ms=sdk_init_ms if sequence == 1 else None,
                )
            samples.append(sdk_sample)
    finally:
        if not sdk_timed_out:
            try:
                await asyncio.wait_for(client.aio.aclose(), timeout=5)
            except TimeoutError:
                pass
        await session.close()
    return GeminiLatencyProbeResult(
        model=model,
        voice=voice,
        sample_rate=sample_rate,
        sdk_version=importlib.metadata.version("google-genai"),
        key_marker=_key_marker(api_key),
        samples=samples,
    )
