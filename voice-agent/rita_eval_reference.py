"""Another app's chat as the target style for the free-conversation evaluation.

The owner sends a chat from an app whose replies they like (screenshots or pasted text). It is
written down once as a JSON file in `voice-agent/evals/references/` (see the README there):

    {
      "name": "cafe-de",
      "source": "where the chat came from and when",
      "site_language": "ar",
      "target": {"code": "de", "name": "German", "speechCode": "de"},
      "notes": "what the owner likes about these replies",
      "conversations": [
        {"id": "cafe", "turns": [
          {"learner": "…", "reply": "…"},
          {"learner": "…", "reply": "…", "expect": {"fix": ["…"], "must": ["…"], "right": true}}
        ]}
      ]
    }

`expect` is optional: the same checks as the built-in corpus (`fix`: the right form must appear,
`must`: one of these words must appear, `right`: the learner's sentence is right, no correction).

Every learner line is played to Uzyra in the same context the other app had: by default its own
replies go into the history ("reference" history), so each of Uzyra's replies can be compared with
the other app's reply to the very same turn. "own" history feeds Uzyra's replies back instead,
which shows how a whole chat drifts.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from rita_talk_probe import Talk, Turn

REFERENCES = Path(__file__).resolve().parent / "evals" / "references"


@dataclass(frozen=True)
class Reference:
    name: str
    source: str
    notes: str
    talks: tuple[Talk, ...]
    #: the other app's reply to each turn, per conversation id
    replies: dict[str, tuple[str, ...]]


def _turn(raw: dict[str, Any]) -> Turn:
    expect = raw.get("expect") or {}
    return Turn(
        str(raw["learner"]).strip(),
        sheet=str(expect.get("sheet", "any")),
        right=bool(expect.get("right", False)),
        fix=tuple(expect.get("fix", ())),
        must=tuple(expect.get("must", ())),
        forbid=tuple(expect.get("forbid", ())),
        free_language=bool(expect.get("free_language", False)),
        want=str(raw.get("reply", ""))[:200],
    )


def parse_reference(data: dict[str, Any]) -> Reference:
    """A reference from its JSON; raises ValueError with a readable reason when it is malformed."""

    target = data.get("target")
    if not isinstance(target, dict) or not target.get("code") or not target.get("name"):
        raise ValueError("reference needs target {code, name, speechCode}")
    site = str(data.get("site_language", "ar"))
    talks: list[Talk] = []
    replies: dict[str, tuple[str, ...]] = {}
    for index, conversation in enumerate(data.get("conversations") or [], 1):
        turns = [t for t in conversation.get("turns") or [] if str(t.get("learner", "")).strip()]
        if not turns:
            continue
        talk_id = f"ref-{conversation.get('id') or index}"
        if talk_id in replies:
            raise ValueError(f"conversation id repeats: {talk_id}")
        talks.append(Talk(talk_id, site, {**target, "speechCode": target.get("speechCode") or target["code"]}, tuple(_turn(t) for t in turns)))
        replies[talk_id] = tuple(str(t.get("reply", "")) for t in turns)
    if not talks:
        raise ValueError("reference has no conversation with learner lines")
    return Reference(
        name=str(data.get("name") or "reference"),
        source=str(data.get("source") or ""),
        notes=str(data.get("notes") or ""),
        talks=tuple(talks),
        replies=replies,
    )


def load_reference(name_or_path: str) -> dict[str, Any]:
    """The reference JSON, by file path or by name in evals/references (without .json)."""

    path = Path(name_or_path)
    if not path.suffix:
        path = REFERENCES / f"{name_or_path}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    parse_reference(data)  # fail early, before anything is sent to Modal
    return data
