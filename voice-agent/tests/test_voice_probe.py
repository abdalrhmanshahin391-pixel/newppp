import unittest
import threading
import time
from types import SimpleNamespace

from voice_probe import (
    first_non_silent_offset_ms,
    is_remote_participant,
    probe_succeeded,
    wait_for_onset,
    wait_for_quiet,
)


class VoiceProbeTest(unittest.TestCase):
    def test_detects_first_sample(self):
        self.assertEqual(first_non_silent_offset_ms(b"\x00\x00" * 160 + b"\xe8\x03", 16000), 10)

    def test_rejects_silence(self):
        self.assertIsNone(first_non_silent_offset_ms(b"\x00\x00" * 160, 16000))

    def test_ready_only_for_remote_participant(self):
        self.assertTrue(is_remote_participant({"id": "bot-id", "info": {"isLocal": False}}))
        self.assertFalse(is_remote_participant({"id": "self-id", "info": {"isLocal": True}}))
        self.assertFalse(is_remote_participant({"id": "unknown-id", "info": {}}))

    def test_empty_or_partial_probe_cannot_pass(self):
        self.assertFalse(probe_succeeded({"error": None, "turns": []}))
        self.assertFalse(probe_succeeded({"error": None, "turns": [{"candidate_audio": True}]}))
        self.assertFalse(probe_succeeded({
            "error": None,
            "interrupt_sent_during_audio": False,
            "turns": [{"candidate_audio": True, "first_candidate_audio_after_input_ms": 100} for _ in range(4)],
        }))
        self.assertFalse(probe_succeeded({
            "error": None,
            "interrupt_sent_during_audio": True,
            "turns": [
                {"candidate_audio": True, "first_candidate_audio_after_input_ms": -1305},
                *[{"candidate_audio": True, "first_candidate_audio_after_input_ms": 100} for _ in range(3)],
            ],
        }))
        self.assertTrue(probe_succeeded({
            "error": None,
            "interrupt_sent_during_audio": True,
            "turns": [{"candidate_audio": True, "first_candidate_audio_after_input_ms": 100} for _ in range(4)],
        }))

    def test_quiet_gate_and_new_onset_require_fresh_audio(self):
        capture = SimpleNamespace(
            lock=threading.Lock(), last_audio=None, onsets=[1.0], error=None,
        )
        self.assertTrue(wait_for_quiet(capture, time.monotonic() + 0.01))
        self.assertIsNone(wait_for_onset(capture, 1, 1.5, time.monotonic() + 0.01))
        capture.onsets.append(2.0)
        self.assertEqual(wait_for_onset(capture, 1, 1.5, time.monotonic() + 0.01), 2.0)
        self.assertIsNone(wait_for_onset(capture, 1, 2.5, time.monotonic() + 0.01))
        capture.last_audio = time.monotonic()
        self.assertFalse(wait_for_quiet(capture, time.monotonic() + 0.01))
