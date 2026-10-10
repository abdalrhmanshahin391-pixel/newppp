"""Privacy-preserving per-turn latency milestones for the Rita worker."""

from __future__ import annotations

import time
from array import array

from loguru import logger
from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    ErrorFrame,
    InterimTranscriptionFrame,
    LLMTextFrame,
    TranscriptionFrame,
    TTSAudioRawFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.observers.base_observer import BaseObserver, FramePushed


def first_non_silent_sample_ms(audio: bytes, sample_rate: int, threshold: int = 250) -> float | None:
    """Return the offset of first audible 16-bit PCM sample in a chunk."""

    if sample_rate <= 0 or len(audio) < 2:
        return None
    samples = array("h")
    samples.frombytes(audio[: len(audio) - (len(audio) % 2)])
    for index, sample in enumerate(samples):
        if abs(sample) >= threshold:
            return index * 1000 / sample_rate
    return None


class RitaLatencyRecorder:
    """Track monotonic worker milestones without logging speech or transcript content."""

    def __init__(self, session_id: str, trace_id: str = ""):
        self.session_id = session_id
        self.trace_id = trace_id
        self.started_ns = time.perf_counter_ns()
        self.turn = 0
        self._marks: dict[int, dict[str, int]] = {}
        self._contexts: dict[str, int] = {}
        self._last_start_frame_id: str | None = None

    def start_turn(self, frame_id: str) -> None:
        if frame_id == self._last_start_frame_id:
            return
        self._last_start_frame_id = frame_id
        self.turn += 1
        self.mark("speech_start")

    def mark(self, event: str, *, turn: int | None = None, **details: object) -> None:
        turn = self.turn if turn is None else turn
        if turn <= 0:
            return
        marks = self._marks.setdefault(turn, {})
        if event in marks:
            return
        now_ns = time.perf_counter_ns()
        marks[event] = now_ns
        speech_end = marks.get("speech_end")
        monotonic_ms = round((now_ns - self.started_ns) / 1_000_000, 2)
        after_speech_end_ms = (
            round((now_ns - speech_end) / 1_000_000, 2) if speech_end else None
        )
        logger.bind(
            session_id=self.session_id,
            trace_id=self.trace_id or None,
            event_source="worker",
            turn_id=turn,
            event=event,
            monotonic_ms=monotonic_ms,
            after_speech_end_ms=after_speech_end_ms,
            **details,
        ).info(
            "Rita voice latency milestone event={} turn_id={} monotonic_ms={} after_speech_end_ms={}",
            event,
            turn,
            monotonic_ms,
            after_speech_end_ms,
        )

    def session_mark(self, event: str, **details: object) -> None:
        """Log startup/transport evidence that occurs before the first user turn."""

        logger.bind(
            session_id=self.session_id,
            trace_id=self.trace_id or None,
            event_source="worker",
            event=event,
            monotonic_ms=round((time.perf_counter_ns() - self.started_ns) / 1_000_000, 2),
            **details,
        ).info("Rita voice session milestone event={}", event)

    def provider_error(self, provider: str, error: object, *, category: str | None = None) -> None:
        """Classify a provider error without recording provider text or user content."""

        self.session_mark(
            "provider_error",
            provider=provider,
            error_type=type(error).__name__,
            category=category,
        )

    def tts_requested(self, context_id: str, text: str) -> None:
        self._contexts[context_id] = self.turn
        self.mark("first_clause_ready", turn=self.turn, characters=len(text))
        self.mark("tts_request", turn=self.turn)

    def tts_first_bytes(self, context_id: str) -> None:
        self.mark("tts_first_bytes", turn=self._contexts.get(context_id, self.turn))

    def tts_first_non_silent(self, context_id: str, offset_ms: float) -> None:
        self.mark(
            "tts_first_non_silent_pcm",
            turn=self._contexts.get(context_id, self.turn),
            chunk_offset_ms=round(offset_ms, 2),
        )


class RitaLatencyObserver(BaseObserver):
    """Observe frame flow without changing audio scheduling."""

    def __init__(self, recorder: RitaLatencyRecorder):
        super().__init__()
        self.recorder = recorder

    async def on_push_frame(self, data: FramePushed):
        frame = data.frame
        if isinstance(frame, UserStartedSpeakingFrame):
            self.recorder.start_turn(frame.id)
        elif isinstance(frame, UserStoppedSpeakingFrame):
            self.recorder.mark("speech_end")
        elif isinstance(frame, InterimTranscriptionFrame) and frame.text.strip():
            self.recorder.mark("stt_first_partial")
        elif isinstance(frame, TranscriptionFrame) and frame.text.strip():
            self.recorder.mark("stt_first_final")
        elif isinstance(frame, LLMTextFrame) and frame.text.strip():
            self.recorder.mark("llm_first_answer_text")
        elif isinstance(frame, BotStartedSpeakingFrame):
            self.recorder.mark("bot_speaking_signal")
        elif isinstance(frame, TTSAudioRawFrame):
            self.recorder.mark("worker_first_audio_frame")
        elif isinstance(frame, ErrorFrame):
            text = str(getattr(frame, "error", "")).casefold()
            provider = (
                "gemini_tts"
                if "gemini" in text
                else "soniox_stt"
                if "soniox" in text
                else "groq_llm"
                if "groq" in text
                else "pipeline"
            )
            self.recorder.provider_error(provider, getattr(frame, "error", ""))
