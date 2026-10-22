"""Heuristic: does a final transcript read like a finished utterance?

Used only to bound the wait when Smart Turn answers INCOMPLETE for text that is
clearly complete (a real iPad session lost ~1.6 s on "Hey, how are you?").
It is deliberately conservative: terminal punctuation is required, and anything
that trails off, ends on a connective, or is a lone word is treated as unfinished
so genuine hesitation keeps the long safety net.
"""

from __future__ import annotations

import re

from rita_dialogue_acts import Act, classify

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
        "و", "لكن", "بس", "او", "أو", "ثم", "يعني", "انو", "إنو", "أنو", "لأن", "لانو", "لأنه",
        "لما", "عشان", "كأنه", "زي", "بدي", "ما", "مش", "مو", "اللي", "الي", "في", "على", "مع",
        "عن", "من", "الى", "إلى", "إنه", "انه", "أنه", "إذا", "اذا", "لو", "حتى", "عند", "بين",
        # German
        "und", "aber", "oder", "dass", "weil", "also", "wenn", "der", "die", "das", "ein",
        "eine", "mit", "für", "äh", "ähm",
    }
)

# Words a spoken sentence rarely ends on, but that can close a question ("What are you talking
# about?"). They block a turn only when it ends with a full stop or nothing: Soniox puts a stop at
# every breath, so "Things that happen in." is a pause, not an end.
STOP_ONLY_CONTINUATION_WORDS = frozenset(
    {"in", "about", "at", "from", "into", "than", "as", "by", "my", "your", "our", "their", "some", "any"}
)

_WORD = re.compile(r"[\w']+", re.UNICODE)

COMPLETE_SHORT_ACTS = frozenset(
    {
        Act.STOP, Act.NO, Act.YES, Act.DONT_KNOW, Act.UNDERSTOOD, Act.CONTINUE, Act.REPEAT,
        Act.CORRECTION,
    }
)

# Thinking sounds: a turn made only of these, or ending on one, is never finished.
HESITATION_WORDS = frozenset(
    {
        "أمم", "امم", "اممم", "إمم", "يعني", "استنى", "استني", "لحظة", "ثانية", "هم", "مم",
        "um", "uh", "er", "erm", "hmm", "hm", "äh", "ähm", "moment",
    }
)

# Sounds that show the learner is still searching for words. A session with several of them waits
# longer before a turn is committed (LiveKit's "dynamic" and OpenAI's eagerness=low idea).
THINKING_SOUNDS = frozenset(
    {"أمم", "امم", "اممم", "إمم", "هم", "مم", "um", "uh", "er", "erm", "hmm", "hm", "äh", "ähm"}
)

# Short, self-contained spoken turns which STT providers commonly finalize without
# punctuation. Keep this deliberately finite: arbitrary two-word fragments must
# still fall through to Smart Turn / the controller safety timeout.
SHORT_COMPLETE_PHRASES = frozenset(
    {
        "مرحبا",
        "أهلا",
        "اهلا",
        "ألو",
        "الو",
        "ألو مرحبا",
        "الو مرحبا",
        "كيف حالك",
        "شو الأخبار",
        "شو الاخبار",
        "صباح الخير",
        "مساء الخير",
        "hi",
        "hello",
        "hey",
        "hi there",
        "hello there",
        "how are you",
        "hallo",
        "guten morgen",
        "guten tag",
        "wie gehts",
        "wie geht es",
    }
)


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
        # One word is rarely a finished turn, except a clear command or answer such as
        # "خلص." or "نوب.": those commit quickly instead of waiting for the long timer.
        return classify(cleaned).act in COMPLETE_SHORT_ACTS
    last = words[-1].casefold()
    if last in HESITATION_WORDS or all(word.casefold() in HESITATION_WORDS for word in words):
        return False
    if last in CONTINUATION_WORDS:
        return False
    return not (last in STOP_ONLY_CONTINUATION_WORDS and not cleaned.endswith(QUESTION_MARKS + ("!",)))


def thinking_sound_count(text: str) -> int:
    """How many thinking sounds ("um", "äh", "أمم") the transcript contains."""

    return sum(1 for word in _WORD.findall(text or "") if word.casefold() in THINKING_SOUNDS)


def ends_on_hesitation(text: str) -> bool:
    """True when the learner trailed off on a thinking sound ("… أمم", "so, um…").

    The turn router holds such a turn instead of answering it.
    """

    words = _WORD.findall((text or "").strip())
    return bool(words) and words[-1].casefold() in HESITATION_WORDS


def looks_complete_unpunctuated(text: str) -> bool:
    """A final transcript with no closing mark that still reads as a finished sentence.

    Speech recognisers often leave the mark off short Arabic turns. Those turns used to wait for
    the 1.5 s safety net. This is stricter than `looks_complete`: at least three words, nothing
    trailing off, and not ending on a connective or a thinking sound.
    """

    cleaned = (text or "").strip()
    if len(cleaned) < 8 or cleaned.endswith(TRAILING_OFF) or cleaned.endswith(TERMINAL_MARKS):
        return False
    words = _WORD.findall(cleaned)
    if len(words) < 3:
        return False
    last = words[-1].casefold()
    return (
        last not in HESITATION_WORDS
        and last not in CONTINUATION_WORDS
        and last not in STOP_ONLY_CONTINUATION_WORDS
    )


def looks_complete_short_unpunctuated(text: str) -> bool:
    """True only for a small allow-list of complete greetings and check-ins.

    These are especially common as the first learner turn. Soniox may finalize
    them without punctuation, and waiting for the generic 1.5 s safety timeout
    makes the first response feel broken. An allow-list avoids prematurely
    committing ordinary two-word fragments such as ``بدي أروح``.
    """

    cleaned = " ".join(_WORD.findall((text or "").strip())).casefold()
    if not cleaned:
        return False
    return cleaned in {phrase.casefold() for phrase in SHORT_COMPLETE_PHRASES}
