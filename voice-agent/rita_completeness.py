"""Heuristic: does a final transcript read like a finished utterance?

Used only to bound the wait when Smart Turn answers INCOMPLETE for text that is
clearly complete (a real iPad session lost ~1.6 s on "Hey, how are you?").
It is deliberately conservative: terminal punctuation is required, and anything
that trails off, ends on a connective, or is a lone word is treated as unfinished
so genuine hesitation keeps the long safety net.
"""

from __future__ import annotations

import re

TERMINAL_MARKS = (".", "?", "!", "؟", "。")
TRAILING_OFF = ("...", "…", ",", "،", ";", "؛", ":", "-", "–", "—")
QUESTION_MARKS = ("?", "؟")

# Words after which a sentence is almost never finished (Arabic, German, English).
CONTINUATION_WORDS = frozenset(
    {
        # English
        "and", "but", "or", "so", "because", "that", "which", "who", "if", "when", "while",
        "to", "the", "a", "an", "of", "with", "for", "um", "uh", "like",
        # Arabic
        "و", "لكن", "بس", "او", "أو", "ثم", "يعني", "انو", "إنو", "أنو", "لأن", "لانو", "اللي",
        "الي", "في", "على", "مع", "عن", "من", "الى", "إلى",
        # German
        "und", "aber", "oder", "dass", "weil", "also", "wenn", "der", "die", "das", "ein",
        "eine", "mit", "für", "äh", "ähm",
    }
)

_WORD = re.compile(r"[\w']+", re.UNICODE)


def looks_complete(text: str) -> bool:
    """True when the transcript is long enough, punctuated as finished, and not mid-clause."""

    cleaned = (text or "").strip()
    if len(cleaned) < 3:
        return False
    if cleaned.endswith(TRAILING_OFF):
        return False
    if not cleaned.endswith(TERMINAL_MARKS):
        return False

    words = _WORD.findall(cleaned)
    if not words:
        return False
    if len(words) < 2 and not cleaned.endswith(QUESTION_MARKS):
        return False
    return words[-1].casefold() not in CONTINUATION_WORDS
