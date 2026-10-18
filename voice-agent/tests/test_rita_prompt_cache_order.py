import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bot
from rita_state import RitaSessionState


def prompt(language):
    state = RitaSessionState(active_language=language, active_dialect="ar-JO")
    body = {"personality": "kind", "language": "automatic", "dialect": "ar-JO", "mode": "free_conversation"}
    return bot.build_prompt(body, state, dialogue=True)


class PromptOrderTests(unittest.TestCase):
    def test_the_per_turn_state_is_last_so_the_long_fixed_part_can_be_cached(self):
        text = prompt("ar")
        state_at = text.index("Structured session state:")
        self.assertGreater(state_at, text.index("HUMAN TONE"))
        self.assertGreater(state_at, text.index("TEACHING CONTROL"))
        self.assertNotIn("VOICE CONTRACT", text[state_at:])

    def test_everything_before_the_state_is_identical_from_turn_to_turn(self):
        a, b = prompt("ar"), prompt("de")
        marker = "SESSION STATE"
        self.assertEqual(a[: a.index(marker)], b[: b.index(marker)])

    def test_the_reply_budget_leaves_room_for_the_model_to_think(self):
        self.assertGreaterEqual(bot.LLM_MAX_COMPLETION_TOKENS, 300)


if __name__ == "__main__":
    unittest.main()
