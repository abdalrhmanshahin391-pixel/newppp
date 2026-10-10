"""Private, bounded Gemini TTS authentication diagnostics for Rita."""

from __future__ import annotations

import hashlib
import importlib.metadata
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass
from typing import Any

from google import genai

GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_AUTH_PROBE_TEXT = "Hi."
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
