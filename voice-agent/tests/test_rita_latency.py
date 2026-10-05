import asyncio
import struct
from types import SimpleNamespace

from loguru import logger
from pipecat.frames.frames import (
    InterimTranscriptionFrame,
    LLMTextFrame,
    TranscriptionFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)

from rita_latency import RitaLatencyObserver, RitaLatencyRecorder, first_non_silent_sample_ms


def test_first_non_silent_sample_is_not_first_byte():
    audio = struct.pack("<hhhh", 0, 0, 300, 600)
    assert first_non_silent_sample_ms(audio, sample_rate=1000) == 2.0
    assert first_non_silent_sample_ms(struct.pack("<hh", 0, 30), 1000) is None


def test_turn_milestones_are_deduplicated_without_storing_transcript():
    recorder = RitaLatencyRecorder("test-session")
    observer = RitaLatencyObserver(recorder)
    start = UserStartedSpeakingFrame()

    async def send(frame):
        await observer.on_push_frame(SimpleNamespace(frame=frame))

    async def exercise():
        await send(start)
        await send(start)
        await send(UserStoppedSpeakingFrame())
        await send(InterimTranscriptionFrame("شو معنى Guten Morgen", "user", "now"))
        await send(TranscriptionFrame("شو معنى Guten Morgen؟", "user", "now"))
        await send(LLMTextFrame("معناها صباح الخير."))

    asyncio.run(exercise())
    recorder.mark("turn_committed")
    recorder.tts_requested("context-1", "معناها صباح الخير.")
    recorder.tts_first_bytes("context-1")
    recorder.tts_first_non_silent("context-1", 16.0)
    assert recorder.turn == 1
    assert set(recorder._marks[1]) == {
        "speech_start",
        "speech_end",
        "stt_first_partial",
        "stt_first_final",
        "llm_first_answer_text",
        "turn_committed",
        "first_clause_ready",
        "tts_request",
        "tts_first_bytes",
        "tts_first_non_silent_pcm",
    }
    assert not any("Guten" in str(value) for value in recorder._marks.values())


def test_milestone_fields_are_visible_in_plain_log_without_transcript():
    messages = []
    sink_id = logger.add(lambda message: messages.append(str(message)), format="{message}")
    try:
        recorder = RitaLatencyRecorder("test-session")
        recorder.start_turn("frame-1")
        recorder.mark("speech_end")
        recorder.tts_requested("context-1", "private spoken content")
    finally:
        logger.remove(sink_id)
    assert any("event=tts_request turn_id=1" in message for message in messages)
    assert not any("private spoken content" in message for message in messages)
