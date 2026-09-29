import base64
from types import SimpleNamespace

from rita_gemini_tts import RitaGeminiTTSService


def test_decodes_interactions_audio_delta():
    pcm = b"\x01\x02\x03\x04"
    event = SimpleNamespace(
        event_type="step.delta",
        delta=SimpleNamespace(type="audio", data=base64.b64encode(pcm).decode("ascii")),
    )

    assert RitaGeminiTTSService._audio_bytes(event) == pcm


def test_ignores_non_audio_interactions_events():
    event = SimpleNamespace(
        event_type="interaction.complete",
        delta=SimpleNamespace(type="text", data="finished"),
    )

    assert RitaGeminiTTSService._audio_bytes(event) == b""
