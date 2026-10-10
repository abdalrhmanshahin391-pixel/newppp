import asyncio

from rita_gemini_auth import (
    GeminiProbeAttempt,
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
