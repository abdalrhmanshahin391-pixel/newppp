"""Gemini 3.8 streaming TTS adapter for Rita.

Pipecat 0.0.105's bundled ``GeminiTTSService`` targets the Google Cloud
Text-to-Speech streaming API. Rita uses the newer Gemini Developer API model
``gemini-3.8-flash-lite-tts`` instead, so this adapter deliberately calls the
official Google Gen AI SDK and emits raw 24 kHz PCM frames into Pipecat.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import AsyncGenerator

from google import genai
from loguru import logger

from pipecat.frames.frames import CancelFrame, EndFrame, ErrorFrame, Frame, TTSAudioRawFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService, TextAggregationMode
from pipecat.utils.tracing.service_decorators import traced_tts


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

    async def _close_client(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self._client.aio.aclose()

    def can_generate_metrics(self) -> bool:
        return True

    @staticmethod
    def _audio_bytes(chunk) -> bytes:
        """Collect every inline audio part emitted by a streaming response."""

        pieces: list[bytes] = []
        for candidate in getattr(chunk, "candidates", None) or []:
            content = getattr(candidate, "content", None)
            for part in getattr(content, "parts", None) or []:
                inline = getattr(part, "inline_data", None)
                data = getattr(inline, "data", None)
                if isinstance(data, bytes):
                    pieces.append(data)
                elif isinstance(data, str) and data:
                    pieces.append(base64.b64decode(data))
        return b"".join(pieces)

    @traced_tts
    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame, None]:
        logger.debug(f"{self}: Gemini 3.8 TTS [{text}]")
        try:
            contents = [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": text,
                            "speech_metadata": {"style": self._settings.style},
                        }
                    ],
                }
            ]
            config = {
                "response_modalities": ["AUDIO"],
                "speech_config": {"voice_config": {"voice": self._settings.voice}},
            }
            stream = await self._client.aio.models.generate_content_stream(
                model=self._settings.model,
                contents=contents,
                config=config,
            )
            await self.start_tts_usage_metrics(text)
            async for chunk in stream:
                audio = self._audio_bytes(chunk)
                if not audio:
                    continue
                await self.stop_ttfb_metrics()
                yield TTSAudioRawFrame(
                    audio,
                    self.sample_rate,
                    1,
                    context_id=context_id,
                )
        except Exception as exc:
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
