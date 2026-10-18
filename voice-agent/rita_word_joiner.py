"""Send the voice whole words, never pieces of a word.

The language model streams its reply in small pieces, and an Arabic word is often split across two
or three of them ("هلا" arrives as "ها" then "لا"). The voice speaks each piece as soon as it
arrives, so a split word is spoken with a gap inside it and comes out as "ها لا".

This step sits between the language model and the voice. It holds back only the unfinished last word
of the text so far and releases it when the next piece shows the word has ended. That costs about one
piece of waiting (tens of milliseconds) and the rest of the stream is unchanged.
"""

from __future__ import annotations

from loguru import logger
from pipecat.frames.frames import (
    Frame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

# Punctuation that ends a word: nothing can still be glued to it.
_WORD_ENDS = ".!?؟،,;:؛…)]\"”»'’"
# A word longer than this (a URL, a long compound) is released anyway so a reply can never stall.
MAX_HELD_CHARS = 24


def split_at_word_boundary(text: str) -> tuple[str, str]:
    """Return (text that is safe to speak now, the unfinished last word to hold back)."""

    if not text or text[-1].isspace() or text[-1] in _WORD_ENDS:
        return text, ""
    start = len(text)
    while start > 0 and not text[start - 1].isspace() and text[start - 1] not in _WORD_ENDS:
        start -= 1
    held = text[start:]
    if len(held) > MAX_HELD_CHARS:
        return text, ""
    return text[:start], held


class RitaWordJoiner(FrameProcessor):
    """Place between the language model and the voice (before the speech cleaner)."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._held = ""

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if direction == FrameDirection.DOWNSTREAM:
            try:
                if isinstance(frame, LLMFullResponseStartFrame | InterruptionFrame):
                    self._held = ""
                elif isinstance(frame, LLMTextFrame):
                    emit, self._held = split_at_word_boundary(self._held + frame.text)
                    if not emit:
                        return  # only the start of a word so far; wait for the next piece
                    frame.text = emit
                elif isinstance(frame, LLMFullResponseEndFrame) and self._held:
                    tail, self._held = self._held, ""
                    await self.push_frame(LLMTextFrame(tail), direction)
            except Exception as error:  # noqa: BLE001  joining must never silence Rita
                logger.bind(error=repr(error)).warning("Rita word joiner failed")
                self._held = ""
        await self.push_frame(frame, direction)
