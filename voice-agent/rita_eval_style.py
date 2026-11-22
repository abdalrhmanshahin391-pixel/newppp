"""The style of a set of replies, as numbers, and the gaps between two styles.

A reference chat (another app's answers to the same learner lines) has a style: how long a reply
is, how often it asks a question, gives a phrase to say, corrects, writes a table, speaks Arabic
or the language being learned. `profile` measures it on the text the learner sees and hears;
`gaps` says, in plain sentences, where Uzyra differs; `limits` turns a reference into the length
and question limits the turn checks use instead of the fixed ones.
"""

from __future__ import annotations

import re
from statistics import mean, median
from typing import Any

WORD = re.compile(r"\S+")
SENTENCE_END = re.compile(r"[.!?؟]+(?:[\"'”»]?)(?:\s|$)")
QUESTION = re.compile(r"[?؟]")
QUOTED = re.compile(r"[\"“„«][^\"“”„«»]{1,120}[\"”“»]")
CORRECTION = re.compile(r"(?:الصح|الصحيح|صح)\s*[:：]|correct(?:ion)?\s*[:：]|the correct (?:sentence|form)", re.IGNORECASE)
ARABIC_LETTER = re.compile(r"[ء-ي]")
LATIN_LETTER = re.compile(r"[A-Za-zÀ-ÿ]")
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
LIST_LINE = re.compile(r"^\s*(?:[-•*]|\d+[.)])\s+", re.MULTILINE)
TABLE_LINE = re.compile(r"^\s*\|.*\|\s*$", re.MULTILINE)
SHEET_MARK = "[[SHEET]]"

#: How far apart two styles must be before a gap is worth naming.
WORDS_GAP = 0.25  # a quarter longer or shorter on average
RATE_GAP = 0.20  # 20 points more or less often


def split_sheet(text: str) -> tuple[str, str]:
    at = text.lower().find(SHEET_MARK.lower())
    return (text, "") if at < 0 else (text[:at].strip(), text[at + len(SHEET_MARK) :].strip())


def _rate(flags: list[bool]) -> float:
    return round(sum(flags) / len(flags), 2) if flags else 0.0


def profile(replies: list[str]) -> dict[str, Any]:
    """Numbers that describe how a set of replies talks (empty replies are left out)."""

    replies = [r for r in replies if r and r.strip()]
    if not replies:
        return {"replies": 0}
    spoken = [split_sheet(r)[0] for r in replies]
    words = [len(WORD.findall(s)) for s in spoken]
    arabic = [len(ARABIC_LETTER.findall(s)) for s in spoken]
    latin = [len(LATIN_LETTER.findall(QUOTED.sub("", s))) for s in spoken]
    letters = sum(arabic) + sum(latin)
    ordered = sorted(words)
    return {
        "replies": len(replies),
        "words_mean": round(mean(words), 1),
        "words_median": median(words),
        "words_p90": ordered[min(len(ordered) - 1, int(len(ordered) * 0.9))],
        "sentences_mean": round(
            mean(max(1, len([p for p in SENTENCE_END.split(QUOTED.sub("Q", s)) if p.strip()])) for s in spoken), 1
        ),
        "question_rate": _rate([bool(QUESTION.search(QUOTED.sub("", s))) for s in spoken]),
        "phrase_rate": _rate([bool(QUOTED.search(s)) for s in spoken]),
        "correction_rate": _rate([bool(CORRECTION.search(r)) for r in replies]),
        "sheet_rate": _rate([bool(split_sheet(r)[1]) or bool(TABLE_LINE.search(r)) for r in replies]),
        "list_rate": _rate([bool(LIST_LINE.search(r)) for r in replies]),
        "emoji_rate": _rate([bool(EMOJI.search(r)) for r in replies]),
        # Share of Arabic letters outside quoted phrases: how much is explained in Arabic.
        "arabic_share": round(sum(arabic) / letters, 2) if letters else 0.0,
    }


_RATES = (
    ("question_rate", "asks a question", "يسأل سؤال"),
    ("phrase_rate", "gives a phrase in quotes", "يعطي جملة بين علامات اقتباس"),
    ("correction_rate", "writes a correction line", "يكتب سطر تصحيح"),
    ("sheet_rate", "writes a table or sheet", "يكتب جدول أو ورقة"),
    ("list_rate", "writes a list", "يكتب قائمة"),
    ("emoji_rate", "uses emoji", "يستعمل إيموجي"),
)


def gaps(ours: dict[str, Any], reference: dict[str, Any]) -> list[str]:
    """Where our style differs from the reference, biggest first, as plain sentences."""

    if not ours.get("replies") or not reference.get("replies"):
        return []
    found: list[tuple[float, str]] = []
    a, b = ours["words_mean"], reference["words_mean"]
    if b and abs(a - b) / b >= WORDS_GAP:
        found.append(
            (abs(a - b) / b, f"length: Uzyra {a} words on average, the reference {b} ({'longer' if a > b else 'shorter'})")
        )
    for key, english, _ in _RATES:
        x, y = ours.get(key, 0), reference.get(key, 0)
        if abs(x - y) >= RATE_GAP:
            found.append((abs(x - y), f"{english}: Uzyra {x:.0%} of replies, the reference {y:.0%}"))
    x, y = ours.get("arabic_share", 0), reference.get("arabic_share", 0)
    if abs(x - y) >= RATE_GAP:
        found.append((abs(x - y), f"Arabic in the explanation: Uzyra {x:.0%} of letters, the reference {y:.0%}"))
    return [text for _, text in sorted(found, reverse=True)]


def limits(reference: dict[str, Any]) -> dict[str, int]:
    """Turn limits that follow the reference: its long replies (90th percentile) set the word limit."""

    if not reference.get("replies"):
        return {}
    return {"max_words": max(8, int(reference["words_p90"] * 1.15) + 1)}
