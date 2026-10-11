"""Cartesia Sonic streaming TTS adapter for Rita's live voice pipeline.

The service deliberately uses Cartesia's WebSocket implementation supplied by
Pipecat.  A single socket stays open for the lesson; Pipecat maps an LLM turn
to a Cartesia context and sends a cancel message when the learner interrupts.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections.abc import AsyncGenerator
from typing import ClassVar

from pipecat.frames.frames import Frame, TTSAudioRawFrame, TTSStoppedFrame
from pipecat.processors.frame_processor import FrameProcessorSetup
from pipecat.services.cartesia.tts import CartesiaTTSService, CartesiaTTSSettings
from pipecat.services.tts_service import TextAggregationMode

from rita_latency import RitaLatencyRecorder
from rita_leading_silence import LeadingSilenceTrimmer


class RitaCartesiaTTSService(CartesiaTTSService):
    """Low-latency, interruption-safe Cartesia TTS for the Rita worker."""

    SAMPLE_RATE = 24_000
    MODEL = "sonic-3.6"

    # Cartesia accepts base language tags over its current WebSocket API. The
    # conversation state chooses the tag before Groq begins each response.
    _LANGUAGE_CODES: ClassVar[dict[str, str]] = {"ar": "ar", "de": "de", "en": "en"}

    def __init__(
        self,
        *,
        api_key: str,
        voice_id: str,
        latency_recorder: RitaLatencyRecorder | None = None,
        max_buffer_delay_ms: int | None = 0,
        trim_leading_silence: bool = False,
        trim_preroll_ms: int = 40,
        trim_max_hold_ms: int = 250,
        trim_rms_floor: float = 32.0,
        trim_peak_floor: int = 128,
        **kwargs,
    ):
        super().__init__(
            api_key=api_key,
            settings=CartesiaTTSSettings(model=self.MODEL, voice=voice_id),
            # Sonic 3.6 and the selected Layan voice are exercised against the
            # current Cartesia API contract, not Pipecat's older default.
            cartesia_version="2026-08-14",
            sample_rate=self.SAMPLE_RATE,
            encoding="pcm_s16le",
            container="raw",
            # Token streaming lets Cartesia begin speaking while Groq is still
            # generating. Cartesia's contexts preserve continuity across those
            # fragments and Pipecat flushes the context on response completion.
            text_aggregation_mode=TextAggregationMode.TOKEN,
            **kwargs,
        )
        self._latency_recorder = latency_recorder
        self._rita_language = "ar"
        self._rita_max_buffer_delay_ms = max_buffer_delay_ms
        self._trim_leading_silence = trim_leading_silence
        self._trim_preroll_ms = trim_preroll_ms
        self._trim_max_hold_ms = trim_max_hold_ms
        self._trim_rms_floor = trim_rms_floor
        self._trim_peak_floor = trim_peak_floor
        self._trim_contexts: dict[str, LeadingSilenceTrimmer] = {}
        self._trim_decisions_logged: set[str] = set()
        self._last_socket_activity_at = time.monotonic()
        self._idle_monitor_task = None

    def set_turn_language(self, language: str) -> None:
        """Choose the synthesis language for the next Rita response.

        This is intentionally called only after Rita's deterministic session
        state commits a user turn, so one German learning word cannot turn an
        otherwise Jordanian reply into a German Cartesia context.
        """

        self._rita_language = self._LANGUAGE_CODES.get(language, "ar")

    def _build_msg(self, *args, **kwargs):
        """Pin each Cartesia context to Rita's stable response language."""

        message = json.loads(super()._build_msg(*args, **kwargs))
        message["language"] = self._rita_language
        if self._rita_max_buffer_delay_ms is not None:
            message["max_buffer_delay_ms"] = self._rita_max_buffer_delay_ms
        return json.dumps(message)

    async def setup(self, setup: FrameProcessorSetup):
        await super().setup(setup)
        if self._idle_monitor_task is None:
            self._idle_monitor_task = self.create_task(self._idle_socket_monitor())

    async def cleanup(self):
        if self._idle_monitor_task is not None:
            await self.cancel_task(self._idle_monitor_task)
            self._idle_monitor_task = None
        await super().cleanup()

    async def _connect_websocket(self):
        started_at = time.perf_counter()
        await super()._connect_websocket()
        self._last_socket_activity_at = time.monotonic()
        if self._latency_recorder and self._websocket:
            self._latency_recorder.session_mark(
                "cartesia_ws_connected",
                connect_ms=round((time.perf_counter() - started_at) * 1000, 2),
                modal_region=os.environ.get("MODAL_REGION", "unknown"),
                modal_cloud_provider=os.environ.get("MODAL_CLOUD_PROVIDER", "unknown"),
            )

    async def _idle_socket_monitor(self) -> None:
        """Refresh a quiet socket before Cartesia's five-minute idle timeout."""

        while True:
            await asyncio.sleep(30)
            idle_secs = time.monotonic() - self._last_socket_activity_at
            if idle_secs < 240 or self.get_active_audio_context_id():
                continue
            await self._disconnect()
            await self._connect()
            self._last_socket_activity_at = time.monotonic()
            if self._latency_recorder:
                self._latency_recorder.session_mark(
                    "cartesia_ws_idle_refreshed", idle_secs=round(idle_secs, 2)
                )

    async def append_to_audio_context(self, context_id: str, frame: Frame):
        self._last_socket_activity_at = time.monotonic()
        if isinstance(frame, TTSAudioRawFrame) and self._latency_recorder:
            self._latency_recorder.mark(
                "cartesia_first_chunk_received",
                turn=self._latency_recorder.turn_for_context(context_id),
            )
            self._latency_recorder.cartesia_raw_audio_received(
                context_id, frame.audio, frame.sample_rate
            )
        if self._trim_leading_silence and isinstance(frame, TTSAudioRawFrame):
            trimmer = self._trim_contexts.setdefault(
                context_id,
                LeadingSilenceTrimmer(
                    sample_rate=frame.sample_rate,
                    preroll_ms=self._trim_preroll_ms,
                    max_hold_ms=self._trim_max_hold_ms,
                    low_rms_floor=self._trim_rms_floor,
                    low_peak_floor=self._trim_peak_floor,
                ),
            )
            trimmed_audio = trimmer.process(frame.audio)
            self._record_trim_decision(context_id, trimmer)
            if not trimmed_audio:
                return None
            frame = self._replacement_audio_frame(frame, trimmed_audio)
            if self._latency_recorder:
                self._latency_recorder.mark(
                    "cartesia_first_trimmed_pcm_forwarded",
                    turn=self._latency_recorder.turn_for_context(context_id),
                )
        elif self._trim_leading_silence and isinstance(frame, TTSStoppedFrame):
            trimmer = self._trim_contexts.get(context_id)
            if trimmer:
                final_audio = trimmer.finish()
                self._record_trim_decision(context_id, trimmer)
                if final_audio:
                    await super().append_to_audio_context(
                        context_id,
                        TTSAudioRawFrame(
                            audio=final_audio,
                            sample_rate=self.SAMPLE_RATE,
                            num_channels=1,
                            context_id=context_id,
                        ),
                    )
                self._trim_contexts.pop(context_id, None)
                self._trim_decisions_logged.discard(context_id)
        return await super().append_to_audio_context(context_id, frame)

    @staticmethod
    def _replacement_audio_frame(
        source: TTSAudioRawFrame, audio: bytes
    ) -> TTSAudioRawFrame:
        replacement = TTSAudioRawFrame(
            audio=audio,
            sample_rate=source.sample_rate,
            num_channels=source.num_channels,
            context_id=source.context_id,
        )
        replacement.pts = source.pts
        replacement.metadata = dict(source.metadata)
        replacement.transport_source = source.transport_source
        replacement.transport_destination = source.transport_destination
        return replacement

    def _record_trim_decision(
        self, context_id: str, trimmer: LeadingSilenceTrimmer
    ) -> None:
        decision = trimmer.decision
        if not decision or context_id in self._trim_decisions_logged:
            return
        self._trim_decisions_logged.add(context_id)
        if self._latency_recorder:
            self._latency_recorder.cartesia_trim_decision(
                context_id,
                bypassed=decision.bypassed,
                onset_ms=decision.onset_ms,
                trimmed_ms=decision.trimmed_ms,
                preroll_ms=decision.preroll_ms,
            )

    async def flush_audio(self, context_id: str | None = None):
        flush_id = context_id or self.get_active_audio_context_id()
        if self._latency_recorder and flush_id:
            self._latency_recorder.mark(
                "cartesia_context_flushed",
                turn=self._latency_recorder.turn_for_context(flush_id),
            )
        self._last_socket_activity_at = time.monotonic()
        return await super().flush_audio(context_id)

    async def on_audio_context_interrupted(self, context_id: str):
        trimmer = self._trim_contexts.pop(context_id, None)
        if trimmer:
            trimmer.cancel()
            self._trim_decisions_logged.discard(context_id)
            if self._latency_recorder:
                self._latency_recorder.mark(
                    "cartesia_trim_cancelled",
                    turn=self._latency_recorder.turn_for_context(context_id),
                )
        if self._latency_recorder and context_id:
            self._latency_recorder.mark(
                "cartesia_context_cancelled",
                turn=self._latency_recorder.turn_for_context(context_id),
            )
        self._last_socket_activity_at = time.monotonic()
        return await super().on_audio_context_interrupted(context_id)

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame | None, None]:
        self._last_socket_activity_at = time.monotonic()
        if self._latency_recorder:
            self._latency_recorder.tts_requested(context_id, text)
        async for frame in super().run_tts(text, context_id):
            yield frame
