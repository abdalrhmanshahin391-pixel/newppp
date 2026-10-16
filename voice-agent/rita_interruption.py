"""Rita-specific user-turn start strategy.

The default VAD strategy interrupts on any sound. Rita waits for transcript evidence
while she is speaking, so short acknowledgements such as "mhm" or "آه" do not kill a useful
answer, while commands such as "خلص", "وقفي" or "stop" stop her even as a single word.
Outside bot speech the first transcript starts the turn.

`RITA_INTERRUPT_GATE=legacy` restores the previous word-list behaviour without a deploy of
different code (only a restart with the variable set).
"""

from __future__ import annotations

import os
import re

from loguru import logger
from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    Frame,
    InterimTranscriptionFrame,
    TranscriptionFrame,
)
from pipecat.turns.user_start.base_user_turn_start_strategy import BaseUserTurnStartStrategy

from rita_dialogue_acts import interrupts_speaking_bot

_BACKCHANNEL = re.compile(
    r"^(?:m+h+m+|mhm+|uh-?huh|yeah|yep|right|okay|ok|آ+ه|ا+ه|مم+|تمام)$",
    re.IGNORECASE,
)
_TRUE_INTERRUPTION = re.compile(
    r"(?:^|\s)(?:wait|stop|no|why|hold on|استنى|استني|وقف|لا|بس|ليش|لحظة)(?:\s|$)",
    re.IGNORECASE,
)


def gate_mode() -> str:
    return "legacy" if os.getenv("RITA_INTERRUPT_GATE", "new").strip().casefold() == "legacy" else "new"


def legacy_interrupts(text: str) -> bool:
    """The word-list gate used before the dialogue-act reader (kept behind the RITA_INTERRUPT_GATE=legacy switch)."""

    if _BACKCHANNEL.fullmatch(text):
        return False
    return bool(_TRUE_INTERRUPTION.search(text) or len(text.split()) >= 2)


class RitaUserTurnStartStrategy(BaseUserTurnStartStrategy):
    """Start turns quickly while preserving harmless learner backchannels."""

    def __init__(self, *, mode: str | None = None, **kwargs):
        super().__init__(**kwargs)
        self._bot_speaking = False
        self._mode = mode or gate_mode()

    async def reset(self):
        await super().reset()
        self._bot_speaking = False

    async def process_frame(self, frame: Frame):
        await super().process_frame(frame)
        if isinstance(frame, BotStartedSpeakingFrame):
            self._bot_speaking = True
            return
        if isinstance(frame, BotStoppedSpeakingFrame):
            self._bot_speaking = False
            return
        if not isinstance(frame, (TranscriptionFrame, InterimTranscriptionFrame)):
            return

        text = re.sub(r"\s+", " ", frame.text).strip()
        if not text:
            return
        if not self._bot_speaking:
            await self.trigger_user_turn_started()
            return
        final = isinstance(frame, TranscriptionFrame)
        if self._mode == "legacy":
            interrupt, reading = legacy_interrupts(text), "legacy"
        else:
            interrupt, reading = interrupts_speaking_bot(text, final=final)
        if not interrupt:
            logger.bind(text=text, reading=str(reading), final=final).debug(
                "Rita kept listening while speaking"
            )
            return
        logger.bind(text=text, reading=str(reading), final=final).info(
            "Rita confirmed a true interruption"
        )
        await self.trigger_user_turn_started()
