"""Rita's written sheet: the part of a long answer that is shown, never spoken.

A long answer is said in one short sentence, and the details (a small table, the rules, examples, a
"watch out") are written after the marker line [[SHEET]]. The website shows that part as a tidy page
under her words, in the style of the study guide. This processor sits right after the language
model: what comes before the marker goes on to the voice as usual; the marker and everything after
it are held back from the voice. The page already receives the model's whole text (the bot-llm-text
messages), so it reads the sheet from there; the sheet is also kept so it can be added to Rita's
memory of the conversation once her turn ends.

The marker can arrive split across stream pieces ("[[SH" + "EET]]"), so a tail that could be the
start of the marker is held until the next piece shows whether it is.
"""

from __future__ import annotations

from typing import Callable

from pipecat.frames.frames import (
    Frame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    TTSSpeakFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

MARKER = "[[sheet]]"
#: How the marker is written into saved text and Rita's memory.
MARKER_LINE = "[[SHEET]]"
#: A sheet longer than this is cut (the model was told to keep it short).
MAX_SHEET_CHARS = 2400


def _held_prefix(text: str) -> int:
    """How many characters at the end of `text` could be the start of the marker."""
    lowered = text.lower()
    for size in range(min(len(MARKER) - 1, len(lowered)), 0, -1):
        if MARKER.startswith(lowered[-size:]):
            return size
    return 0


class SheetSplit:
    """The pure part: feed stream pieces, get back what may be spoken; the sheet is kept aside."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.held = ""
        self.sheet = ""
        self.in_sheet = False
        self.spoke = False

    def feed(self, piece: str) -> str:
        """Returns the text from this piece that may go to the voice (possibly empty)."""
        if self.in_sheet:
            self.sheet += piece
            return ""
        text = self.held + piece
        self.held = ""
        at = text.lower().find(MARKER)
        if at >= 0:
            self.in_sheet = True
            self.sheet = text[at + len(MARKER) :]
            return self._spoken(text[:at])
        keep = _held_prefix(text)
        if keep:
            self.held = text[-keep:]
            return self._spoken(text[:-keep])
        return self._spoken(text)

    def _spoken(self, text: str) -> str:
        if text.strip():
            self.spoke = True
        return text

    def finish(self) -> tuple[str, str]:
        """At the end of the answer: (held text that was not the marker after all, the sheet)."""
        tail = "" if self.in_sheet else self.held
        sheet = self.sheet.strip()[:MAX_SHEET_CHARS]
        self.held = ""
        self.in_sheet = False
        self.sheet = ""
        self.spoke = False
        return tail, sheet


class RitaSheetSplitter(FrameProcessor):
    """Place right after the language model, before the word joiner and the speech cleaner.

    `look_below` gives the short line Rita says when an answer was all sheet and no speech.
    """

    def __init__(self, *, look_below: Callable[[], str] | None = None, **kwargs):
        super().__init__(**kwargs)
        self._split = SheetSplit()
        self._last_sheet = ""
        self._look_below = look_below

    def take_sheet(self) -> str:
        """The sheet of the last finished answer, once (for Rita's memory of the conversation)."""
        sheet, self._last_sheet = self._last_sheet, ""
        return sheet

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if direction != FrameDirection.DOWNSTREAM:
            await self.push_frame(frame, direction)
            return
        if isinstance(frame, LLMFullResponseStartFrame):
            self._split.reset()
            self._last_sheet = ""
        elif isinstance(frame, InterruptionFrame):
            # The learner cut in before the answer was finished: nothing of it is kept.
            self._split.reset()
        elif isinstance(frame, LLMTextFrame):
            speak = self._split.feed(frame.text)
            if not speak:
                return
            frame.text = speak
        elif isinstance(frame, LLMFullResponseEndFrame):
            spoke = self._split.spoke
            tail, sheet = self._split.finish()
            if tail:
                await self.push_frame(LLMTextFrame(tail), direction)
            elif sheet and not spoke and self._look_below:
                # A sheet with nothing said before it: one short line so she is not silent.
                await self.push_frame(TTSSpeakFrame(self._look_below(), append_to_context=False))
            self._last_sheet = sheet
        await self.push_frame(frame, direction)
