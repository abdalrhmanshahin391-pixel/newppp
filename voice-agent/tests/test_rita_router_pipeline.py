"""The router inside a real Pipecat pipeline: stop ack and clarification reach the context once."""

import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipecat.frames.frames import LLMContextFrame, TTSAudioRawFrame  # noqa: E402
from pipecat.pipeline.pipeline import Pipeline  # noqa: E402
from pipecat.processors.aggregators.llm_context import LLMContext  # noqa: E402
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair  # noqa: E402
from pipecat.services.tts_service import TTSService  # noqa: E402
from pipecat.tests.utils import run_test  # noqa: E402

from rita_state import RitaSessionState  # noqa: E402
from rita_turn_router import RitaTurnRouter, RouterMode  # noqa: E402


class SilentTTS(TTSService):
    """Stands in for Cartesia: one chunk of silence per utterance."""

    def __init__(self):
        super().__init__(sample_rate=24000)

    def can_generate_metrics(self):
        return False

    async def run_tts(self, text, context_id):
        yield TTSAudioRawFrame(
            audio=b"\x00\x00" * 240, sample_rate=24000, num_channels=1, context_id=context_id
        )


async def run(user_text, assistant_text, *, ack=True):
    state = RitaSessionState()
    state.observe_assistant_turn(assistant_text)
    context = LLMContext(
        [
            {"role": "system", "content": "You are Rita."},
            {"role": "assistant", "content": assistant_text},
            {"role": "user", "content": user_text},
        ]
    )
    _, assistant = LLMContextAggregatorPair(context)
    router = RitaTurnRouter(
        state=state,
        prepare_turn=state.observe_user_turn,
        language_of_turn=lambda: "ar",
        mode=RouterMode.ON,
        ack=ack,
    )
    down, _ = await run_test(
        Pipeline([router, SilentTTS(), assistant]),
        frames_to_send=[LLMContextFrame(context=context)],
    )
    return [m["content"] for m in context.get_messages() if m["role"] == "assistant"], down


class RouterInsideAPipelineTests(unittest.TestCase):
    def test_stop_ack_is_spoken_once_and_recorded_once(self):
        assistant_texts, down = asyncio.run(run("خلص", "الثورة الفرنسية صارت 1789."))
        self.assertEqual(assistant_texts[-1], "تمام.")
        self.assertEqual(assistant_texts.count("تمام."), 1)
        self.assertTrue(any(isinstance(frame, TTSAudioRawFrame) for frame in down))

    def test_silent_stop_speaks_and_records_nothing(self):
        assistant_texts, down = asyncio.run(run("خلص", "الثورة الفرنسية صارت 1789.", ack=False))
        self.assertEqual(assistant_texts, ["الثورة الفرنسية صارت 1789."])
        self.assertFalse(any(isinstance(frame, TTSAudioRawFrame) for frame in down))

    def test_a_bare_yes_after_options_is_answered_with_one_question(self):
        assistant_texts, _ = asyncio.run(run("إيه", "بدك نكمل ولا نغيّر الموضوع؟"))
        self.assertEqual(assistant_texts[-1], "أي واحد: نكمل ولا نغيّر الموضوع؟")


if __name__ == "__main__":
    unittest.main()
