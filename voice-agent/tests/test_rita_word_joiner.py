"""Whole words only: a split Arabic word must reach the voice as one piece."""

import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipecat.frames.frames import (
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.tests.utils import run_test

from rita_dialect import RitaSpeechCleaner
from rita_word_joiner import MAX_HELD_CHARS, RitaWordJoiner, split_at_word_boundary


class SplitTests(unittest.TestCase):
    def test_a_finished_word_is_released_and_an_open_word_is_held(self):
        self.assertEqual(split_at_word_boundary("هلا كيف"), ("هلا ", "كيف"))
        self.assertEqual(split_at_word_boundary("هلا كيف "), ("هلا كيف ", ""))
        self.assertEqual(split_at_word_boundary("ها"), ("", "ها"))

    def test_punctuation_ends_a_word(self):
        for text in ("كيف الحال؟", "Guten Morgen.", "تمام،", 'قول "Hallo"', "ok!"):
            self.assertEqual(split_at_word_boundary(text), (text, ""))

    def test_a_very_long_word_is_never_held_forever(self):
        long_word = "x" * (MAX_HELD_CHARS + 1)
        self.assertEqual(split_at_word_boundary("a " + long_word), ("a " + long_word, ""))

    def test_empty_text(self):
        self.assertEqual(split_at_word_boundary(""), ("", ""))


def frames_for(pieces):
    return [LLMFullResponseStartFrame(), *[LLMTextFrame(p) for p in pieces], LLMFullResponseEndFrame()]


async def run(pieces, *, with_cleaner=False):
    processors = [RitaWordJoiner()] + ([RitaSpeechCleaner()] if with_cleaner else [])
    down, _ = await run_test(Pipeline(processors), frames_to_send=frames_for(pieces))
    return [f.text for f in down if isinstance(f, LLMTextFrame)]


class PipelineTests(unittest.TestCase):
    def test_a_word_split_across_pieces_is_sent_whole(self):
        pieces = ["ها", "لا", " كي", "ف الح", "ال", "؟"]
        out = asyncio.run(run(pieces))
        self.assertEqual("".join(out), "".join(pieces))
        self.assertIn("هالا ", out)  # the two halves arrive together, never as "ها" then "لا"
        for text in out[:-1]:
            self.assertTrue(text[-1].isspace() or text[-1] in ".!?؟،,", text)

    def test_the_last_word_is_flushed_before_the_reply_ends(self):
        out = asyncio.run(run(["هلا", " صدي", "ق"]))
        self.assertEqual("".join(out), "هلا صديق")

    def test_nothing_is_lost_with_the_cleaner_in_front_of_the_voice(self):
        out = asyncio.run(run(["بنقو", "لها ", "**Gu", "ten** Mor", "gen."], with_cleaner=True))
        self.assertEqual("".join(out), "بنقولها Guten Morgen.")

    def test_a_new_reply_never_inherits_the_held_word_of_a_cut_off_one(self):
        async def go():
            down, _ = await run_test(
                Pipeline([RitaWordJoiner()]),
                frames_to_send=[
                    LLMFullResponseStartFrame(),
                    LLMTextFrame("هلا ك"),
                    LLMFullResponseStartFrame(),
                    LLMTextFrame("جديد"),
                    LLMFullResponseEndFrame(),
                ],
            )
            return [f.text for f in down if isinstance(f, LLMTextFrame)]

        self.assertEqual("".join(asyncio.run(go())), "هلا جديد")


class TelemetryTests(unittest.TestCase):
    def test_it_counts_the_words_that_arrived_in_pieces(self):
        joiner = RitaWordJoiner()

        async def go():
            await run_test(
                Pipeline([joiner]),
                frames_to_send=frames_for(["ها", "لا", " كي", "ف", " الحال", "؟"]),
            )

        asyncio.run(go())
        self.assertEqual(joiner.repaired_splits, 2)  # هلا and كيف


if __name__ == "__main__":
    unittest.main()
