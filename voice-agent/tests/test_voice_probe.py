import unittest

from voice_probe import first_non_silent_offset_ms, is_remote_participant


class VoiceProbeTest(unittest.TestCase):
    def test_detects_first_sample(self):
        self.assertEqual(first_non_silent_offset_ms(b"\x00\x00" * 160 + b"\xe8\x03", 16000), 10)

    def test_rejects_silence(self):
        self.assertIsNone(first_non_silent_offset_ms(b"\x00\x00" * 160, 16000))

    def test_ready_only_for_remote_participant(self):
        self.assertTrue(is_remote_participant({"id": "bot-id", "info": {"isLocal": False}}))
        self.assertFalse(is_remote_participant({"id": "self-id", "info": {"isLocal": True}}))
        self.assertFalse(is_remote_participant({"id": "unknown-id", "info": {}}))
