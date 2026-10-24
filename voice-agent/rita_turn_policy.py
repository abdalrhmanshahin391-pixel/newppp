"""End-of-turn policy with a bounded wait for clearly complete utterances.

Smart Turn is audio-only and can answer INCOMPLETE for a finished question. When
that happens Pipecat's only remaining stop path is the controller's inactivity
timer (1.5 s). This strategy adds one extra, shorter path: if the transcript is final and
looks complete, commit after a short bounded delay. New speech cancels it. Turns
that are genuinely unfinished (trailing connective, trailing comma, one word)
keep the long timer.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

from loguru import logger
from pipecat.frames.frames import TranscriptionFrame, VADUserStartedSpeakingFrame
from pipecat.turns.user_stop import TurnAnalyzerUserTurnStopStrategy

from rita_completeness import (
    looks_complete,
    looks_complete_short_unpunctuated,
    looks_complete_unpunctuated,
    thinking_sound_count,
)

DEFAULT_BOUNDED_COMMIT_SECS = 0.3
MIN_BOUNDED_COMMIT_SECS = 0.3
MAX_BOUNDED_COMMIT_SECS = 1.2
# A turn that ends on a plain full stop is often only a breath (Soniox stops at every pause), so it
# waits longer than a question or an exclamation. 0 restores the old single short wait.
DEFAULT_PERIOD_COMMIT_SECS = 0.9
MIN_PERIOD_COMMIT_SECS = 0.5
MAX_PERIOD_COMMIT_SECS = 1.4
# Extra wait once the learner has shown they search for words ("um", "äh", "أمم").
SLOW_SPEAKER_EXTRA_SECS = 0.3
SLOW_SPEAKER_THINKING_SOUNDS = 2
DEFAULT_UNPUNCTUATED_COMMIT_SECS = 0.9
MIN_UNPUNCTUATED_COMMIT_SECS = 0.6
MAX_UNPUNCTUATED_COMMIT_SECS = 1.4


def adaptive_unpunctuated_secs(text: str, configured: float) -> float:
    """Keep short complete turns fast; give only long clauses extra continuation room."""

    word_count = len((text or "").split())
    if word_count <= 5:
        return min(configured, 0.45)
    if word_count <= 10:
        return min(configured, 0.65)
    return min(configured, 0.85)


def bounded_wait_secs(text: str, quick_secs: float, period_secs: float, thinking_sounds: int = 0) -> float:
    """How long to wait before committing a complete-looking turn.

    Questions, exclamations and one-word commands ("وقفي.", "Stop.") keep the quick wait. A turn
    that ends on a plain full stop waits `period_secs`, and a little longer for a learner who has
    shown that they search for words. `period_secs` <= 0 means the quick wait for everything.
    """

    cleaned = (text or "").strip()
    if period_secs <= 0 or cleaned.endswith(("?", "؟", "!")):
        return quick_secs
    if len(cleaned.split()) < 2:
        return quick_secs
    wait = max(quick_secs, period_secs)
    if thinking_sounds >= SLOW_SPEAKER_THINKING_SOUNDS:
        wait += SLOW_SPEAKER_EXTRA_SECS
    return wait


def period_commit_secs(body: dict[str, Any]) -> float:
    """Seconds a turn ending on a plain full stop waits before it is committed; 0 disables."""

    raw = body.get("periodCommitSecs", os.getenv("RITA_PERIOD_COMMIT_SECS"))
    try:
        value = float(raw) if raw not in (None, "") else DEFAULT_PERIOD_COMMIT_SECS
    except (TypeError, ValueError):
        return DEFAULT_PERIOD_COMMIT_SECS
    if value <= 0:
        return 0.0
    return min(MAX_PERIOD_COMMIT_SECS, max(MIN_PERIOD_COMMIT_SECS, value))


def bounded_commit_secs(body: dict[str, Any]) -> float:
    """Seconds to wait before committing a complete-looking turn; 0 disables the bounded commit."""

    raw = body.get("boundedCommitSecs", os.getenv("RITA_BOUNDED_COMMIT_SECS"))
    try:
        value = float(raw) if raw not in (None, "") else DEFAULT_BOUNDED_COMMIT_SECS
    except (TypeError, ValueError):
        return DEFAULT_BOUNDED_COMMIT_SECS
    if value <= 0:
        return 0.0
    return min(MAX_BOUNDED_COMMIT_SECS, max(MIN_BOUNDED_COMMIT_SECS, value))


def unpunctuated_commit_secs(body: dict[str, Any]) -> float:
    """Seconds to wait before committing a finished-looking turn that has no closing mark; 0 disables."""

    raw = body.get("unpunctuatedCommitSecs", os.getenv("RITA_UNPUNCTUATED_COMMIT_SECS"))
    try:
        value = float(raw) if raw not in (None, "") else DEFAULT_UNPUNCTUATED_COMMIT_SECS
    except (TypeError, ValueError):
        return DEFAULT_UNPUNCTUATED_COMMIT_SECS
    if value <= 0:
        return 0.0
    return min(MAX_UNPUNCTUATED_COMMIT_SECS, max(MIN_UNPUNCTUATED_COMMIT_SECS, value))


class RitaBoundedTurnStopStrategy(TurnAnalyzerUserTurnStopStrategy):
    """Smart Turn plus a short, cancellable commit for complete-looking final transcripts."""

    def __init__(
        self,
        *,
        turn_analyzer,
        bounded_secs: float,
        unpunctuated_secs: float = 0.0,
        period_secs: float = 0.0,
        **kwargs,
    ):
        super().__init__(turn_analyzer=turn_analyzer, **kwargs)
        self._bounded_secs = bounded_secs
        self._unpunctuated_secs = unpunctuated_secs
        self._period_secs = period_secs
        #: thinking sounds heard in this session; a slow speaker gets a longer wait
        self._thinking_sounds = 0
        self._bounded_task: asyncio.Task | None = None
        self._bounded_fired = False
        #: smart_complete | bounded_complete_commit (a controller timeout never reaches this class)
        self.last_stop_reason: str | None = None
        #: which path decided the last turn: smart | quick | period | short_phrase | unpunctuated
        self.last_stop_path: str | None = None
        #: how long that path waited, in ms (None for the audio-only Smart Turn decision)
        self.last_wait_ms: int | None = None
        #: how many times the learner resumed speaking while a commit was pending, for the last turn
        self.last_resume_count: int = 0
        self._resume_count = 0
        self._fired_path: str | None = None
        self._fired_wait_ms: int | None = None

    async def _cancel_bounded(self) -> None:
        task, self._bounded_task = self._bounded_task, None
        if task is not None:
            await self.task_manager.cancel_task(task)

    async def reset(self):
        await self._cancel_bounded()
        self._bounded_fired = False
        await super().reset()

    async def cleanup(self):
        await self._cancel_bounded()
        await super().cleanup()

    async def _handle_vad_user_started_speaking(self, frame: VADUserStartedSpeakingFrame):
        # The learner kept talking: whatever was about to be committed is no longer the end.
        if self._bounded_task is not None:
            self._resume_count += 1
        await self._cancel_bounded()
        self._bounded_fired = False
        await super()._handle_vad_user_started_speaking(frame)

    async def _handle_transcription(self, frame: TranscriptionFrame):
        await super()._handle_transcription(frame)
        if frame.finalized:
            self._thinking_sounds += thinking_sound_count(frame.text)
        if (
            self._bounded_secs > 0
            and frame.finalized
            and not self._turn_complete
            and not self._vad_user_speaking
            and looks_complete(frame.text)
        ):
            await self._cancel_bounded()
            wait = bounded_wait_secs(
                frame.text, self._bounded_secs, self._period_secs, self._thinking_sounds
            )
            self._bounded_task = self.task_manager.create_task(
                self._bounded_commit(
                    frame.text, wait, "period" if wait > self._bounded_secs else "quick"
                ),
                f"{self}::_bounded_commit",
            )
        elif (
            self._bounded_secs > 0
            and frame.finalized
            and not self._turn_complete
            and not self._vad_user_speaking
            and looks_complete_short_unpunctuated(frame.text)
        ):
            # Greetings such as "ألو مرحبا" are complete turns even when the
            # recogniser omits punctuation. Commit through the same cancellable
            # path so resumed speech still wins safely.
            await self._cancel_bounded()
            self._bounded_task = self.task_manager.create_task(
                self._bounded_commit(frame.text, None, "short_phrase"),
                f"{self}::_bounded_commit",
            )
        elif (
            self._unpunctuated_secs > 0
            and frame.finalized
            and not self._turn_complete
            and not self._vad_user_speaking
            and looks_complete_unpunctuated(frame.text)
        ):
            # No closing mark, but it reads as a finished sentence: wait a little less than the 1.5 s net.
            await self._cancel_bounded()
            self._bounded_task = self.task_manager.create_task(
                self._bounded_commit(
                    frame.text,
                    adaptive_unpunctuated_secs(frame.text, self._unpunctuated_secs),
                    "unpunctuated",
                ),
                f"{self}::_bounded_commit",
            )

    async def _bounded_commit(
        self, text: str, secs: float | None = None, path: str = "quick"
    ) -> None:
        wait = self._bounded_secs if secs is None else secs
        try:
            await asyncio.sleep(wait)
        except asyncio.CancelledError:
            return
        self._bounded_task = None
        if self._vad_user_speaking or self._turn_complete or self._text != text:
            return
        self._turn_complete = True
        self._bounded_fired = True
        self._fired_path = path
        self._fired_wait_ms = round(wait * 1000)
        await self._maybe_trigger_user_turn_stopped()

    async def _maybe_trigger_user_turn_stopped(self):
        if self._text and self._turn_complete and (
            self._transcript_finalized or self._timeout_task is None
        ):
            self.last_stop_reason = (
                "bounded_complete_commit" if self._bounded_fired else "smart_complete"
            )
            self.last_stop_path = self._fired_path if self._bounded_fired else "smart"
            self.last_wait_ms = self._fired_wait_ms if self._bounded_fired else None
            self.last_resume_count, self._resume_count = self._resume_count, 0
            self._fired_path = self._fired_wait_ms = None
            logger.bind(stop_reason=self.last_stop_reason).info(
                "Rita turn stop reason={} path={} wait_ms={} resumed={} word_count={}",
                self.last_stop_reason,
                self.last_stop_path,
                self.last_wait_ms,
                self.last_resume_count,
                len(self._text.split()),
            )
        await super()._maybe_trigger_user_turn_stopped()
