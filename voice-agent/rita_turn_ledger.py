"""One small record per turn: who decided the learner was done, what Rita understood, how she answered.

The worker fills it from state it already has (the latency milestones, the turn policy, the session
state, the router) and sends one RTVI server message when Rita's answer ends or is cut off. The page
stores it next to the conversation, so a complaint such as "she interrupted me" can be traced to the
decision, the wait and the build that produced it, and later turned into a test.

Nothing here does work on the audio path: it only copies numbers and short labels that are already
computed. It never holds what the learner or Rita said, and never a secret.
"""

from __future__ import annotations

import hashlib
import json
import os
from typing import Any

LEDGER_VERSION = 1
MESSAGE_TYPE = "rita-turn-ledger"
#: a ledger message stays under this many bytes (it travels over the realtime channel)
MAX_BYTES = 1024
#: marker that ends the fixed part of the system prompt (everything after it changes every turn)
PROMPT_STATE_MARKER = "SESSION STATE"

# Dropped first when a record is too large: the least useful details come first.
_DROP_ORDER = ("tts_bytes_ms", "stt_final_ms", "task", "route", "how_to_say", "llm_first_ms", "explain_src")


def turn_ref(session_id: str, turn: int) -> str:
    """The id the worker and the page share for one learner turn and the answer to it."""

    return f"{session_id}-t-{turn}"


def build_id() -> str:
    """The deployed commit, set by the deploy workflow ('' when running locally)."""

    return (os.getenv("RITA_GIT_SHA", "") or "").strip()[:12] or "unknown"


def fixed_prompt_hash(prompt: str) -> str:
    """A short hash of the part of the system prompt that does not change from turn to turn."""

    fixed = prompt.split(PROMPT_STATE_MARKER, 1)[0]
    return hashlib.sha256(fixed.encode("utf-8")).hexdigest()[:8]


def compact(record: dict[str, Any], limit: int = MAX_BYTES) -> dict[str, Any]:
    """Drop empty values, then the least useful fields, until the record fits."""

    trimmed = {key: value for key, value in record.items() if value is not None}

    def size() -> int:
        return len(json.dumps(trimmed, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

    for key in _DROP_ORDER:
        if size() <= limit:
            break
        trimmed.pop(key, None)
    return trimmed


class TurnLedger:
    """Holds the learner side of each turn until Rita's answer to it ends."""

    def __init__(self, session_id: str, *, learn_language: str | None = None, keep: int = 8):
        self._session_id = session_id
        self._learn_language = learn_language
        self._open: dict[int, dict[str, Any]] = {}
        self._keep = keep

    def user_turn_committed(self, turn: int, fields: dict[str, Any]) -> None:
        """Remember the learner side of a turn (the decision and what was read from it)."""

        if turn <= 0:
            return
        self._open[turn] = dict(fields)
        while len(self._open) > self._keep:
            self._open.pop(min(self._open))

    def has_open(self, turn: int) -> bool:
        return turn in self._open

    def newest_open_turn(self) -> int | None:
        return max(self._open) if self._open else None

    def unanswered_before(
        self, turn: int, fields: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Records for earlier turns Rita never answered (a silent stop, a hold). Removes them."""

        records: list[dict[str, Any]] = []
        for old in sorted(key for key in self._open if key < turn):
            records.append(self._finish(old, {**(fields or {}), "answered": False}))
        return records

    def assistant_turn_stopped(self, turn: int, fields: dict[str, Any]) -> dict[str, Any] | None:
        """The finished record for `turn` once Rita's answer ended or was cut off."""

        if turn not in self._open:
            return None
        return self._finish(turn, {"answered": True, **fields})

    def _finish(self, turn: int, extra: dict[str, Any]) -> dict[str, Any]:
        record = self._open.pop(turn)
        record.update(extra)
        record.update(
            {
                "type": MESSAGE_TYPE,
                "v": LEDGER_VERSION,
                "turn_ref": turn_ref(self._session_id, turn),
                "turn": turn,
                "build": build_id(),
            }
        )
        if self._learn_language:
            record["learn_lang"] = self._learn_language
        return compact(record)
