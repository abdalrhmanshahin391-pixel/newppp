"""Gemini 3.8 Interactions streaming TTS adapter for Rita."""

from __future__ import annotations

import base64
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from google import genai
from loguru import logger
from pipecat.frames.frames import CancelFrame, EndFrame, ErrorFrame, Frame, TTSAudioRawFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TextAggregationMode, TTSService
from pipecat.utils.tracing.service_decorators import traced_tts

from rita_latency import RitaLatencyRecorder, first_non_silent_sample_ms


@dataclass
class RitaGeminiTTSSettings(TTSSettings):
    """Runtime settings shared by every Rita speech chunk."""

    style: str = (
        "Natural close-mic conversation. Warm, quick and emotionally present, never theatrical. "
        "Use a friendly Jordanian accent for Arabic, natural native pronunciation for German and "
        "English words, and preserve seamless code-switching."
    )


class RitaGeminiTTSService(TTSService):
    """Stream Gemini 3.8 Flash-Lite TTS audio through Pipecat."""

    SAMPLE_RATE = 24_000

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "gemini-3.8-flash-lite-tts",
        voice: str = "Achernar",
        style: str | None = None,
        latency_recorder: RitaLatencyRecorder | None = None,
        **kwargs,
    ):
        settings = RitaGeminiTTSSettings(
            model=model,
            voice=voice,
            language=None,
            style=style
            or (
                "Natural close-mic conversation. Warm, quick and emotionally present, never "
                "theatrical. Use a friendly Jordanian accent for Arabic, natural native "
                "pronunciation for German and English words, and preserve seamless code-switching."
            ),
        )
        super().__init__(
            sample_rate=self.SAMPLE_RATE,
            push_start_frame=True,
            push_stop_frames=True,
            text_aggregation_mode=TextAggregationMode.SENTENCE,
            stop_frame_timeout_s=0.35,
            append_trailing_space=False,
            settings=settings,
            **kwargs,
        )
        self._client = genai.Client(api_key=api_key)
        self._closed = False
        self._latency_recorder = latency_recorder

    async def _close_client(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self._client.aio.aclose()

    def can_generate_metrics(self) -> bool:
        return True

    @staticmethod
    def _audio_bytes(event) -> bytes:
        """Decode one Interactions ``step.delta`` audio event."""

        if getattr(event, "event_type", None) != "step.delta":
            return b""
        delta = getattr(event, "delta", None)
        if getattr(delta, "type", None) != "audio":
            return b""
        data = getattr(delta, "data", None)
        if isinstance(data, bytes):
            return data
        if isinstance(data, str) and data:
            return base64.b64decode(data)
        return b""

    @traced_tts
    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame, None]:
        if self._latency_recorder:
            self._latency_recorder.tts_requested(context_id, text)
        logger.debug("Gemini 3.8 TTS request: {} characters", len(text))
        try:
            interaction_input = [
                {
                    "type": "user_input",
                    "content": [
                        {
                            "type": "text",
                            "text": text,
                            "annotations": [
                                {
                                    "type": "speech_metadata",
                                    "style": self._settings.style,
                                }
                            ],
                        }
                    ],
                }
            ]
            stream = await self._client.aio.interactions.create(
                model=self._settings.model,
                input=interaction_input,
                response_format={
                    "type": "audio",
                    "mime_type": "audio/l16",
                    "sample_rate": self.SAMPLE_RATE,
                },
                generation_config={
                    "speech_config": [{"voice": self._settings.voice}],
                },
                stream=True,
            )
            await self.start_tts_usage_metrics(text)
            async for event in stream:
                audio = self._audio_bytes(event)
                if not audio:
                    continue
                await self.stop_ttfb_metrics()
                if self._latency_recorder:
                    self._latency_recorder.tts_first_bytes(context_id)
                    first_sample_ms = first_non_silent_sample_ms(audio, self.sample_rate)
                    if first_sample_ms is not None:
                        self._latency_recorder.tts_first_non_silent(context_id, first_sample_ms)
                yield TTSAudioRawFrame(
                    audio,
                    self.sample_rate,
                    1,
                    context_id=context_id,
                )
        # Provider/transport SDKs expose several exception families. Pipecat must
        # receive every one as an ErrorFrame rather than losing the session task.
        except Exception as exc:  # noqa: BLE001
            logger.exception("Gemini 3.8 TTS request failed")
            yield ErrorFrame(error=f"Gemini 3.8 TTS generation error: {exc}")

    async def stop(self, frame: EndFrame):
        """Close Gemini's async HTTP client when a lesson ends."""

        await self._close_client()
        await super().stop(frame)

    async def cancel(self, frame: CancelFrame):
        """Release the provider connection when Pipecat cancels a session."""

        await self._close_client()
        await super().cancel(frame)
