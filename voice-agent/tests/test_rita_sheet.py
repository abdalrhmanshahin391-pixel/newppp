"""The written sheet never reaches the voice; the spoken sentence before it does, whole."""

import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipecat.frames.frames import (
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    TTSSpeakFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.tests.utils import run_test

from rita_sheet import MAX_SHEET_CHARS, RitaSheetSplitter, SheetSplit


def split(pieces):
    s = SheetSplit()
    spoken = "".join(s.feed(piece) for piece in pieces)
    tail, sheet = s.finish()
    return spoken + tail, sheet


class SplitTests(unittest.TestCase):
    def test_no_sheet_everything_is_spoken(self):
        self.assertEqual(split(["هلا، ", "كيفك؟"]), ("هلا، كيفك؟", ""))

    def test_the_sheet_after_the_marker_is_kept_aside(self):
        spoken, sheet = split(["مع he بنزيد s. ", "[[SHEET]]\n# Third person\n- work → works"])
        self.assertEqual(spoken, "مع he بنزيد s. ")
        self.assertEqual(sheet, "# Third person\n- work → works")

    def test_a_marker_split_across_pieces(self):
        spoken, sheet = split(["Add -s. [[", "SH", "EET]]", "\n- a", "\n- b"])
        self.assertEqual(spoken, "Add -s. ")
        self.assertEqual(sheet, "- a\n- b")

    def test_a_held_bracket_that_was_not_the_marker_is_spoken(self):
        self.assertEqual(split(["see [[", "x]] ok"]), ("see [[x]] ok", ""))
        self.assertEqual(split(["the end ["]), ("the end [", ""))

    def test_the_marker_in_lower_case(self):
        self.assertEqual(split(["Hi [[sheet]] - a"]), ("Hi ", "- a"))

    def test_a_long_sheet_is_cut(self):
        _, sheet = split(["x [[SHEET]]", "a" * (MAX_SHEET_CHARS + 50)])
        self.assertEqual(len(sheet), MAX_SHEET_CHARS)

    def test_a_reset_forgets_everything(self):
        s = SheetSplit()
        s.feed("Hi [[SHEET]] - a")
        s.reset()
        self.assertEqual(s.feed("next"), "next")
        self.assertEqual(s.finish(), ("", ""))


async def through_pipeline(pieces, look_below=None):
    splitter = RitaSheetSplitter(look_below=look_below)
    frames = [LLMFullResponseStartFrame(), *(LLMTextFrame(p) for p in pieces), LLMFullResponseEndFrame()]
    down, _ = await run_test(
        Pipeline([splitter]),
        frames_to_send=frames,
        expected_down_frames=None,
    )
    text = "".join(f.text for f in down if isinstance(f, LLMTextFrame))
    said = [f.text for f in down if isinstance(f, TTSSpeakFrame)]
    return text, splitter.take_sheet(), splitter.take_sheet(), said


class PipelineTests(unittest.TestCase):
    def test_only_the_spoken_part_goes_on(self):
        text, sheet, again, _ = asyncio.run(
            through_pipeline(["Add -s or -es. [[SHE", "ET]]\n| a | b |\n", "! Watch out: has"])
        )
        self.assertEqual(text, "Add -s or -es. ")
        self.assertEqual(sheet, "| a | b |\n! Watch out: has")
        self.assertEqual(again, "")

    def test_a_held_tail_is_released_before_the_end(self):
        text, sheet, _, _ = asyncio.run(through_pipeline(["ok [", "["]))
        self.assertEqual(text, "ok [[")
        self.assertEqual(sheet, "")

    def test_a_sheet_with_nothing_said_gets_a_short_line(self):
        text, sheet, _, said = asyncio.run(
            through_pipeline(["[[SHEET]]\n- a"], look_below=lambda: "شوف الشرح تحت.")
        )
        self.assertEqual(text, "")
        self.assertEqual(sheet, "- a")
        self.assertEqual(said, ["شوف الشرح تحت."])

    def test_no_extra_line_when_something_was_said(self):
        _, _, _, said = asyncio.run(
            through_pipeline(["Add -s. [[SHEET]]\n- a"], look_below=lambda: "x")
        )
        self.assertEqual(said, [])


if __name__ == "__main__":
    unittest.main()
