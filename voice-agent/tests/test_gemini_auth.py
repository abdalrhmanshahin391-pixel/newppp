import asyncio
import base64
from types import SimpleNamespace

from rita_gemini_auth import (
    GeminiProbeAttempt,
    _decode_sse_json,
    _event_audio_bytes,
    _safe_quota_details,
    gemini_error_category,
    gemini_interaction_payload,
    run_gemini_auth_probe,
)


def test_interactions_payload_keeps_pcm_contract_and_private_probe_text():
    payload = gemini_interaction_payload(
        text="Hi.",
        model="gemini-3.8-flash-lite-tts",
        voice="Achernar",
        style="test style",
        sample_rate=24_000,
    )
    assert payload["model"] == "gemini-3.8-flash-lite-tts"
    assert payload["response_format"] == {
        "type": "audio",
        "mime_type": "audio/l16",
        "sample_rate": 24_000,
    }
    assert payload["input"][0]["content"][0]["text"] == "Hi."


def test_authentication_errors_have_a_safe_stable_category():
    error = RuntimeError("401 ACCESS_TOKEN_TYPE_UNSUPPORTED private provider details")
    assert gemini_error_category(error) == ("authentication", 401)


def test_probe_uses_rest_only_when_the_sdk_returns_401():
    calls = []

    async def sdk_probe(*args, **kwargs):
        calls.append("sdk")
        return GeminiProbeAttempt("sdk", False, 401, "authentication")

    async def rest_probe(*args, **kwargs):
        calls.append("rest")
        return GeminiProbeAttempt("rest", True, 200, "ok")

    result = asyncio.run(
        run_gemini_auth_probe("test-key", sdk_probe=sdk_probe, rest_probe=rest_probe)
    )
    assert calls == ["sdk", "rest"]
    assert result.outcome == "sdk_transport_mismatch"
    assert result.sdk.accepted is False
    assert result.rest and result.rest.accepted is True
    assert "test-key" not in str(result.public_dict())


def test_probe_does_not_make_a_rest_call_after_sdk_success():
    async def sdk_probe(*args, **kwargs):
        return GeminiProbeAttempt("sdk", True, 200, "ok")

    async def rest_probe(*args, **kwargs):
        raise AssertionError("REST must not run after a successful SDK request")

    result = asyncio.run(
        run_gemini_auth_probe("test-key", sdk_probe=sdk_probe, rest_probe=rest_probe)
    )
    assert result.outcome == "sdk_authenticated"
    assert result.rest is None


def test_latency_probe_decodes_sdk_and_rest_audio_without_retaining_text():
    pcm = b"\x00\x00\x10\x01"
    encoded = base64.b64encode(pcm).decode("ascii")
    sdk_event = SimpleNamespace(
        event_type="step.delta",
        delta=SimpleNamespace(type="audio", data=encoded),
    )
    rest_line = (
        'data: {"event_type":"step.delta","delta":{"type":"audio","data":"'
        + encoded
        + '"}}\n'
    ).encode("utf-8")
    rest_event = _decode_sse_json(rest_line)
    assert _event_audio_bytes(sdk_event) == pcm
    assert rest_event is not None
    assert _event_audio_bytes(rest_event) == pcm


def test_latency_probe_ignores_non_audio_and_malformed_sse():
    assert _decode_sse_json(b": keepalive\n") is None
    assert _decode_sse_json(b"data: not-json\n") is None
    assert _event_audio_bytes({"event_type": "step.delta", "delta": {"type": "text"}}) == b""


def test_quota_parser_keeps_only_safe_identifiers():
    payload = {
        "error": {
            "message": "sensitive provider message",
            "details": [
                {
                    "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                    "violations": [
                        {
                            "quotaMetric": "generate_requests_per_model_per_day",
                            "quotaId": "RequestsPerDayPerProjectPerModel",
                            "quotaDimensions": {"model": "gemini-test", "location": "global"},
                        }
                    ],
                },
                {
                    "@type": "type.googleapis.com/google.rpc.RetryInfo",
                    "retryDelay": "12s",
                },
            ],
        }
    }
    result = _safe_quota_details(payload)
    assert result["quota_metric"] == "generate_requests_per_model_per_day"
    assert result["quota_dimensions"] == {"model": "gemini-test", "location": "global"}
    assert result["retry_delay"] == "12s"
    assert "message" not in result
