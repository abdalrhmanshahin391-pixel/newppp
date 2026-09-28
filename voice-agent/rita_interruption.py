"""Rita-specific user-turn start strategy.

The default VAD strategy interrupts on any sound. Rita waits for transcript
evidence while she is speaking so short acknowledgements such as "mhm" do not
kill a useful answer. Outside bot speech the first transcript starts the turn.
"""

from __future__ import annotations

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


_BACKCHANNEL = re.compile(
    r"^(?:m+h+m+|mhm+|uh-?huh|yeah|yep|right|okay|ok|آ+ه|ا+ه|مم+|تمام)$",
    re.IGNORECASE,
)
_TRUE_INTERRUPTION = re.compile(
    r"(?:^|\s)(?:wait|stop|no|why|hold on|استنى|استني|وقف|لا|بس|ليش|لحظة)(?:\s|$)",
    re.IGNORECASE,
)


class RitaUserTurnStartStrategy(BaseUserTurnStartStrategy):
    """Start turns quickly while preserving harmless learner backchannels."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._bot_speaking = False

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
        if _BACKCHANNEL.fullmatch(text):
            logger.bind(text=text).debug("Rita preserved a learner backchannel")
            return
        if _TRUE_INTERRUPTION.search(text) or len(text.split()) >= 2:
            logger.bind(text=text).info("Rita confirmed a true interruption")
            await self.trigger_user_turn_started()
