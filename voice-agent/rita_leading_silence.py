"""Conservative streaming removal of provider-added leading PCM silence.

The trimmer is deliberately fail-open: uncertainty preserves the original
audio.  Once speech has started, every remaining byte is passed through
unchanged.  It never removes pauses inside an utterance.
"""

from __future__ import annotations

import math
import statistics
from array import array
from dataclasses import dataclass


@dataclass(frozen=True)
class TrimDecision:
    """One-time decision made for the beginning of a TTS context."""

    opened: bool
    bypassed: bool
    onset_ms: float | None
    trimmed_ms: float
    preroll_ms: float


class LeadingSilenceTrimmer:
    """Trim only confidently detected leading silence from PCM16LE audio.

    Sustained activity above a near-digital-silence floor confirms the onset.
    The emitted audio starts before it by ``preroll_ms``. Early noise therefore
    reduces the amount trimmed rather than risking a clipped phoneme.
    """

    def __init__(
        self,
        *,
        sample_rate: int = 24_000,
        frame_ms: int = 5,
        preroll_ms: int = 40,
        max_hold_ms: int = 250,
        confirmation_frames: int = 2,
        low_rms_floor: float = 32.0,
        low_peak_floor: int = 128,
    ) -> None:
        if sample_rate <= 0 or frame_ms <= 0:
            raise ValueError("sample_rate and frame_ms must be positive")
        if not 0 <= preroll_ms < max_hold_ms:
            raise ValueError("preroll_ms must be non-negative and below max_hold_ms")
        if confirmation_frames <= 0:
            raise ValueError("confirmation_frames must be positive")

        self.sample_rate = sample_rate
        self.frame_samples = max(1, round(sample_rate * frame_ms / 1000))
        self.preroll_samples = round(sample_rate * preroll_ms / 1000)
        self.max_hold_samples = round(sample_rate * max_hold_ms / 1000)
        self.confirmation_frames = confirmation_frames
        self.low_rms_floor = low_rms_floor
        self.low_peak_floor = low_peak_floor

        self._buffer = bytearray()
        self._pending_byte = b""
        self._analyzed_samples = 0
        self._noise_rms: list[float] = []
        self._noise_peak: list[int] = []
        self._possible_onset_sample: int | None = None
        self._activity_run = 0
        self._opened = False
        self._bypassed = False
        self._cancelled = False
        self._decision: TrimDecision | None = None

    @property
    def decision(self) -> TrimDecision | None:
        return self._decision

    @property
    def is_open(self) -> bool:
        return self._opened

    def process(self, audio: bytes) -> bytes:
        """Consume one arbitrary PCM chunk and return safe audio ready to play."""

        if self._cancelled or not audio:
            return b""

        combined = self._pending_byte + audio
        even_length = len(combined) - (len(combined) % 2)
        complete = combined[:even_length]
        self._pending_byte = combined[even_length:]

        if self._opened:
            return complete

        self._buffer.extend(complete)
        emitted = self._analyze_new_frames()
        if emitted is not None:
            return emitted

        if len(self._buffer) // 2 >= self.max_hold_samples:
            return self._open_without_trimming()
        return b""

    def finish(self) -> bytes:
        """Finish a context without ever discarding uncertain buffered audio."""

        if self._cancelled:
            return b""
        if self._opened:
            trailing = self._pending_byte
            self._pending_byte = b""
            return trailing
        return self._open_without_trimming(include_pending=True)

    def cancel(self) -> None:
        """Discard only unplayed audio belonging to an interrupted context."""

        self._cancelled = True
        self._buffer.clear()
        self._pending_byte = b""

    def _analyze_new_frames(self) -> bytes | None:
        samples = array("h")
        samples.frombytes(self._buffer)

        while self._analyzed_samples + self.frame_samples <= len(samples):
            start = self._analyzed_samples
            stop = start + self.frame_samples
            window = samples[start:stop]
            peak = max(abs(value) for value in window)
            rms = math.sqrt(sum(value * value for value in window) / len(window))

            noise_rms = statistics.median(self._noise_rms) if self._noise_rms else 0.0
            noise_peak = statistics.median(self._noise_peak) if self._noise_peak else 0.0
            low_rms = max(self.low_rms_floor, noise_rms * 2.0)
            low_peak = max(self.low_peak_floor, int(noise_peak * 2.5))
            low_activity = rms >= low_rms or peak >= low_peak

            # Only near-digital-silence frames teach the adaptive noise floor.
            if not low_activity and len(self._noise_rms) < 32:
                self._noise_rms.append(rms)
                self._noise_peak.append(peak)

            if low_activity and self._possible_onset_sample is None:
                self._possible_onset_sample = start

            if low_activity:
                self._activity_run += 1
            else:
                self._activity_run = 0
                self._possible_onset_sample = None

            self._analyzed_samples = stop
            if self._activity_run >= self.confirmation_frames:
                onset = self._possible_onset_sample if self._possible_onset_sample is not None else start
                return self._open_at(onset)
        return None

    def _open_at(self, onset_sample: int) -> bytes:
        cut_sample = max(0, onset_sample - self.preroll_samples)
        cut_byte = cut_sample * 2
        emitted = bytes(self._buffer[cut_byte:])
        self._buffer.clear()
        self._opened = True
        self._decision = TrimDecision(
            opened=True,
            bypassed=False,
            onset_ms=onset_sample * 1000 / self.sample_rate,
            trimmed_ms=cut_sample * 1000 / self.sample_rate,
            preroll_ms=(onset_sample - cut_sample) * 1000 / self.sample_rate,
        )
        return emitted

    def _open_without_trimming(self, *, include_pending: bool = False) -> bytes:
        emitted = bytes(self._buffer)
        self._buffer.clear()
        if include_pending:
            emitted += self._pending_byte
            self._pending_byte = b""
        self._opened = True
        self._bypassed = True
        self._decision = TrimDecision(
            opened=True,
            bypassed=True,
            onset_ms=None,
            trimmed_ms=0.0,
            preroll_ms=0.0,
        )
        return emitted
