import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipecat.frames.frames import (  # noqa: E402
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    InterimTranscriptionFrame,
    TranscriptionFrame,
)

from rita_interruption import RitaUserTurnStartStrategy, legacy_interrupts  # noqa: E402


def final(text):
    return TranscriptionFrame(text=text, user_id="u", timestamp="t", finalized=True)


def interim(text):
    return InterimTranscriptionFrame(text=text, user_id="u", timestamp="t")


async def run(frames, mode="new"):
    strategy = RitaUserTurnStartStrategy(mode=mode)
    started = []

    async def on_started(strategy, params):
        started.append(True)

    strategy.add_event_handler("on_user_turn_started", on_started)
    for frame in frames:
        await strategy.process_frame(frame)
    return bool(started)


def speaking(*frames):
    return [BotStartedSpeakingFrame(), *frames]


class StrategyTests(unittest.TestCase):
    def interrupts(self, *frames, mode="new"):
        return asyncio.run(run(frames, mode=mode))

    def test_a_single_stop_word_stops_rita(self):
        for text in ("خلص", "وقفي", "كفاية", "stop"):
            with self.subTest(text=text):
                self.assertTrue(self.interrupts(*speaking(final(text))))

    def test_listening_noises_do_not(self):
        for text in ("آه", "مم", "أها", "تمام", "إيه", "mhm", "أمم"):
            with self.subTest(text=text):
                self.assertFalse(self.interrupts(*speaking(final(text))))

    def test_but_at_the_start_of_a_sentence_is_not_a_bare_stop(self):
        # "بس" alone is "enough"; an interim "بس" of "بس بدي أسأل" waits for the final text,
        # which is then a normal sentence (two or more words) and still interrupts as speech.
        self.assertFalse(self.interrupts(*speaking(interim("بس"))))
        self.assertTrue(self.interrupts(*speaking(final("بس"))))

    def test_an_ambiguous_stop_word_waits_for_its_final_transcript(self):
        # "خلص" may be the start of "خلصت التمرين": the interim alone must not interrupt.
        self.assertFalse(self.interrupts(*speaking(interim("خلص"))))
        self.assertTrue(self.interrupts(*speaking(interim("خلص"), final("خلص"))))
        self.assertTrue(self.interrupts(*speaking(interim("خلص خلص"))))
        self.assertTrue(self.interrupts(*speaking(interim("وقفي"))))

    def test_finished_exercise_is_not_a_stop(self):
        self.assertFalse(self.interrupts(*speaking(interim("خلص"), final("خلصت"))))

    def test_a_real_sentence_interrupts(self):
        self.assertTrue(self.interrupts(*speaking(final("شو يعني هاي الكلمة"))))

    def test_outside_bot_speech_any_transcript_starts_the_turn(self):
        self.assertTrue(self.interrupts(interim("أمم")))
        self.assertTrue(
            self.interrupts(BotStartedSpeakingFrame(), BotStoppedSpeakingFrame(), final("آه"))
        )

    def test_legacy_mode_restores_the_word_list(self):
        self.assertFalse(self.interrupts(*speaking(final("خلص")), mode="legacy"))
        self.assertTrue(self.interrupts(*speaking(final("خلص خلص")), mode="legacy"))


if __name__ == "__main__":
    unittest.main()
