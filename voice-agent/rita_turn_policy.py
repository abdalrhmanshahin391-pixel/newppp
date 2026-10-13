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

from rita_completeness import looks_complete

DEFAULT_BOUNDED_COMMIT_SECS = 0.6
MIN_BOUNDED_COMMIT_SECS = 0.3
MAX_BOUNDED_COMMIT_SECS = 1.2


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


class RitaBoundedTurnStopStrategy(TurnAnalyzerUserTurnStopStrategy):
    """Smart Turn plus a short, cancellable commit for complete-looking final transcripts."""

    def __init__(self, *, turn_analyzer, bounded_secs: float, **kwargs):
        super().__init__(turn_analyzer=turn_analyzer, **kwargs)
        self._bounded_secs = bounded_secs
        self._bounded_task: asyncio.Task | None = None
        self._bounded_fired = False
        #: smart_complete | bounded_complete_commit (a controller timeout never reaches this class)
        self.last_stop_reason: str | None = None

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
        await self._cancel_bounded()
        self._bounded_fired = False
        await super()._handle_vad_user_started_speaking(frame)

    async def _handle_transcription(self, frame: TranscriptionFrame):
        await super()._handle_transcription(frame)
        if (
            self._bounded_secs > 0
            and frame.finalized
            and not self._turn_complete
            and not self._vad_user_speaking
            and looks_complete(frame.text)
        ):
            await self._cancel_bounded()
            self._bounded_task = self.task_manager.create_task(
                self._bounded_commit(frame.text), f"{self}::_bounded_commit"
            )

    async def _bounded_commit(self, text: str) -> None:
        try:
            await asyncio.sleep(self._bounded_secs)
        except asyncio.CancelledError:
            return
        self._bounded_task = None
        if self._vad_user_speaking or self._turn_complete or self._text != text:
            return
        self._turn_complete = True
        self._bounded_fired = True
        await self._maybe_trigger_user_turn_stopped()

    async def _maybe_trigger_user_turn_stopped(self):
        if self._text and self._turn_complete and (
            self._transcript_finalized or self._timeout_task is None
        ):
            self.last_stop_reason = (
                "bounded_complete_commit" if self._bounded_fired else "smart_complete"
            )
            logger.bind(stop_reason=self.last_stop_reason).info(
                "Rita turn stop reason={}", self.last_stop_reason
            )
        await super()._maybe_trigger_user_turn_stopped()
