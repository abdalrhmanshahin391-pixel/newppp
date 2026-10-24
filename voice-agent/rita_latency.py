"""Privacy-preserving per-turn latency milestones for the Rita worker."""

from __future__ import annotations

import time
from array import array

from loguru import logger
from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    ErrorFrame,
    InterimTranscriptionFrame,
    InterruptionFrame,
    LLMFullResponseStartFrame,
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
        # Details given with a milestone (for example the model's finish reason), per turn.
        self._details: dict[int, dict[str, dict[str, object]]] = {}
        # Which learner turn Rita is answering, and whether the learner cut her off.
        self.reply_turn = 0
        self.reply_active = False
        self.bot_speaking = False
        self._reply_started_ns: int | None = None
        self._bot_started_ns: int | None = None
        self._interrupted_after_ms: dict[int, int] = {}
        self._seen_frame_ids: dict[str, None] = {}

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
        if details:
            self._details.setdefault(turn, {})[event] = dict(details)
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

    def _first_time(self, frame_id: str) -> bool:
        """Observers see one frame at every hop; act on each frame once."""

        if frame_id in self._seen_frame_ids:
            return False
        self._seen_frame_ids[frame_id] = None
        if len(self._seen_frame_ids) > 256:
            self._seen_frame_ids.pop(next(iter(self._seen_frame_ids)))
        return True

    def reply_started(self, frame_id: str) -> None:
        if not self._first_time(frame_id):
            return
        self.reply_turn = self.turn
        self.reply_active = True
        self._reply_started_ns = time.perf_counter_ns()
        self._bot_started_ns = None

    def bot_started_speaking(self) -> None:
        if not self.reply_active:
            # A scripted line (greeting, stop acknowledgement) has no model response of its own.
            self.reply_turn = self.turn
            self.reply_active = True
            self._reply_started_ns = time.perf_counter_ns()
        self.bot_speaking = True
        if self._bot_started_ns is None:
            self._bot_started_ns = time.perf_counter_ns()

    def bot_stopped_speaking(self) -> None:
        self.bot_speaking = False
        self.reply_active = False

    def interruption(self, frame_id: str) -> None:
        """The learner (or the stop button) cut off a reply that was being generated or spoken."""

        if not self._first_time(frame_id):
            return
        if not (self.reply_active or self.bot_speaking) or self.reply_turn <= 0:
            return
        if self.reply_turn in self._interrupted_after_ms:
            return
        started = self._bot_started_ns or self._reply_started_ns or time.perf_counter_ns()
        self._interrupted_after_ms[self.reply_turn] = round((time.perf_counter_ns() - started) / 1_000_000)
        self.reply_active = False

    def interrupted_after_ms(self, turn: int) -> int | None:
        return self._interrupted_after_ms.get(turn)

    def detail(self, turn: int, event: str, key: str) -> object | None:
        return self._details.get(turn, {}).get(event, {}).get(key)

    def offset_ms(self, turn: int, event: str, since: str = "speech_end") -> int | None:
        """Milliseconds from one milestone of a turn to another, or None if either is missing."""

        marks = self._marks.get(turn, {})
        if event not in marks or since not in marks:
            return None
        return round((marks[event] - marks[since]) / 1_000_000)

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
        # Called immediately before the Cartesia adapter builds and sends the
        # WebSocket payload. The isolated benchmark measures the exact socket
        # send; this production mark keeps the full-pipeline trace correlated.
        self.mark("cartesia_first_text_sent", turn=self.turn)

    def turn_for_context(self, context_id: str) -> int:
        return self._contexts.get(context_id, self.turn)

    def tts_first_bytes(self, context_id: str) -> None:
        self.mark("tts_first_bytes", turn=self._contexts.get(context_id, self.turn))

    def tts_first_non_silent(self, context_id: str, offset_ms: float) -> None:
        turn = self.turn_for_context(context_id)
        self.mark(
            "tts_first_non_silent_pcm",
            turn=turn,
            chunk_offset_ms=round(offset_ms, 2),
        )
        self.mark(
            "cartesia_first_non_silent_pcm",
            turn=turn,
            chunk_offset_ms=round(offset_ms, 2),
        )

    def tts_audio_received(self, context_id: str, audio: bytes, sample_rate: int) -> None:
        """Record first Cartesia audio frame without retaining speech content."""

        turn = self._contexts.get(context_id, self.turn)
        # This is deliberately an audio-frame milestone, not a claim about the
        # first WebSocket byte or the instant a listener hears it on a device.
        self.mark("tts_first_audio_frame", turn=turn)
        first_sample_ms = first_non_silent_sample_ms(audio, sample_rate)
        if first_sample_ms is not None:
            self.tts_first_non_silent(context_id, first_sample_ms)

    def cartesia_raw_audio_received(
        self, context_id: str, audio: bytes, sample_rate: int
    ) -> None:
        """Record provider PCM before any local leading-silence processing."""

        turn = self.turn_for_context(context_id)
        self.mark("cartesia_raw_first_chunk", turn=turn)
        first_sample_ms = first_non_silent_sample_ms(audio, sample_rate)
        if first_sample_ms is not None:
            self.mark(
                "cartesia_raw_speech_onset",
                turn=turn,
                chunk_offset_ms=round(first_sample_ms, 2),
            )

    def cartesia_trim_decision(
        self,
        context_id: str,
        *,
        bypassed: bool,
        onset_ms: float | None,
        trimmed_ms: float,
        preroll_ms: float,
    ) -> None:
        """Record safe numeric trim evidence without retaining provider audio."""

        event = "cartesia_trim_bypassed" if bypassed else "cartesia_leading_silence_trimmed"
        self.mark(
            event,
            turn=self.turn_for_context(context_id),
            onset_ms=round(onset_ms, 2) if onset_ms is not None else None,
            trimmed_ms=round(trimmed_ms, 2),
            preroll_ms=round(preroll_ms, 2),
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
        elif isinstance(frame, LLMFullResponseStartFrame):
            self.recorder.reply_started(str(frame.id))
        elif isinstance(frame, InterruptionFrame):
            self.recorder.interruption(str(frame.id))
        elif isinstance(frame, BotStoppedSpeakingFrame):
            self.recorder.bot_stopped_speaking()
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
            self.recorder.bot_started_speaking()
        elif isinstance(frame, TTSAudioRawFrame):
            self.recorder.mark("worker_first_audio_frame")
            self.recorder.tts_audio_received(
                frame.context_id, frame.audio, frame.sample_rate
            )
        elif isinstance(frame, ErrorFrame):
            text = str(getattr(frame, "error", "")).casefold()
            provider = (
                "cartesia_tts"
                if "cartesia" in text
                else "gemini_tts"
                if "gemini" in text
                else "soniox_stt"
                if "soniox" in text
                else "groq_llm"
                if "groq" in text
                else "pipeline"
            )
            self.recorder.provider_error(provider, getattr(frame, "error", ""))
