"""Spoken commands for the learner's words list: "open the list", "turn them into flashcards".

These are not conversation. The model is never asked about them: the router recognises the
command, tells the page what to do and says one short line. The page does the work (opens the
list, or saves the words to the subject the learner named) and shows the honest result on
screen.

The match is deliberately strict: an imperative that names the list (or flashcards) and has no
question word in it. "How do I turn words into flashcards?" is a question for the model.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from rita_dialogue_acts import normalize, tokens


class UiAction(StrEnum):
    OPEN_LIST = "open_list"
    CONVERT_LIST = "convert_list"


@dataclass(frozen=True)
class UiCommand:
    action: UiAction
    target: str = "flashcards"  # "flashcards" or "german_lab"
    hint: str = ""  # the subject the learner named, if any


def _set(*words: str) -> frozenset[str]:
    return frozenset(normalize(word) for word in words if normalize(word))


MAX_TOKENS = 16
MAX_HINT_CHARS = 60

# A question is never a command ("how do I...", "what is...").
QUESTION_TOKENS = _set(
    "كيف", "شلون", "ليش", "لماذا", "شو", "ايش", "وش", "what", "how", "why", "when", "wie", "was",
    "warum", "wann",
)
# Politeness and address that may surround a command.
POLITE_TOKENS = _set(
    "ريتا", "رتا", "يا", "لو", "سمحتي", "سمحت", "ممكن", "بتقدري", "بتقدر", "فيكي", "فيك", "الان",
    "هلا", "هسا", "please", "rita", "can", "could", "you", "bitte", "kannst", "du", "mal", "طيب",
    "تمام", "اوكي", "okay", "ok",
)

OPEN_VERBS = _set(
    "افتحي", "افتح", "فتحي", "فتح", "اظهري", "اظهر", "اعرضي", "اعرض", "اعرضلي", "وريني", "ورجيني",
    "open", "show", "display", "offne", "zeig", "zeige",
)
LIST_NOUNS = _set(
    "القائمه", "قائمه", "القايمه", "قايمه", "القائمة", "اللستة", "لستة", "اللستا", "الليست", "ليست",
    "كلماتي", "الكلمات", "list", "the list", "words", "liste", "wortliste", "worter",
)
CONVERT_VERBS = _set(
    "حولي", "حوليهم", "حولهم", "حولهن", "حول", "حطي", "حطيهم", "حطهم", "حط", "اعملي", "اعمليهم",
    "اعملهم", "اعمل", "خليهم", "خليها", "خزني", "خزنيهم", "اضيفي", "اضيفيهم", "ضيفي", "ضيفيهم",
    "convert", "turn", "make", "put", "save", "add", "mach", "mache", "wandle",
)
FLASH_WORDS = _set(
    "فلاش", "فلاشكارد", "فلاشكاردز", "فلاشكاردس", "فلاشكاردات", "بطاقات", "flashcard", "flashcards",
    "karteikarten", "karten", "flash",
)
GERMAN_LAB_WORDS = _set("german lab", "المختبر", "مختبر", "germanlab", "labor")
HINT_PREPOSITIONS = _set(
    "في", "ب", "ضمن", "تحت", "الى", "الي", "ل", "لل", "على", "under", "in", "into", "to", "unter",
)
HINT_NOUNS = _set(
    "موضوع", "الموضوع", "مادة", "المادة", "subject", "folder", "مجلد", "topic", "thema", "فرعي",
)
FLASH_TAIL = _set("كارد", "كاردز", "كاردس", "cards", "card", "كاردات", "كروت", "كرت")


def _hint_after(parts: list[str], start: int) -> str:
    rest = parts[start:]
    while rest and rest[0] in FLASH_TAIL:
        rest = rest[1:]
    if rest and rest[0] in HINT_PREPOSITIONS:
        rest = rest[1:]
    while rest and rest[0] in HINT_NOUNS:
        rest = rest[1:]
    return " ".join(rest).strip()[:MAX_HINT_CHARS]


STRONG_CONVERT = _set(
    "حولي", "حوليهم", "حولهم", "حولهن", "حول", "convert", "turn", "wandle",
)
LIST_REFS = _set(
    "كلهم", "كلها", "هدول", "هدولا", "هدوليك", "them", "all", "alle", "sie", "الكلمات", "كلماتي",
    "القائمه", "قائمه", "القايمه", "قايمه", "اللستة", "لستة", "اللستا", "الليست", "ليست", "list",
    "words", "liste", "wortliste", "worter",
)
FILLER = _set("the", "my", "ال", "لي", "لنا", "تبعي", "تبعتي", "تبعتنا", "meine", "die", "mir")


def _names_list(part: str) -> bool:
    return part in LIST_NOUNS


def _is_flash(part: str) -> bool:
    return part in FLASH_WORDS or part.startswith("فلاش")


def read_ui_command(text: str) -> UiCommand | None:
    """Return the list command in a finished learner turn, or None for ordinary talk."""

    parts = tokens(text)
    if not parts or len(parts) > MAX_TOKENS:
        return None
    if any(part in QUESTION_TOKENS for part in parts):
        return None
    joined = " ".join(parts)

    flash_at = next((i for i, part in enumerate(parts) if _is_flash(part)), None)
    if flash_at is not None:
        strong = any(part in STRONG_CONVERT for part in parts)
        # "put word X in flashcards" names one word; only a clear reference to the whole
        # list ("حطهم", "all of them", "the list") may use a weaker verb.
        weak = any(part in CONVERT_VERBS for part in parts) and any(
            part in LIST_REFS or part.endswith(("هم", "هن")) for part in parts
        )
        if strong or weak:
            target = (
                "german_lab" if any(word in joined for word in GERMAN_LAB_WORDS) else "flashcards"
            )
            hint = _hint_after(parts, flash_at + 1)
            if target == "german_lab":
                # "German Lab" names the place, not a subject inside it.
                for word in sorted(GERMAN_LAB_WORDS, key=len, reverse=True):
                    hint = hint.replace(word, " ")
                hint = " ".join(hint.split())
            return UiCommand(UiAction.CONVERT_LIST, target, hint)
        return None

    if any(part in OPEN_VERBS for part in parts) and any(_names_list(part) for part in parts):
        # Everything else must be polite filler, so "open the window next to the list"
        # style sentences do not trigger.
        extra = [
            part
            for part in parts
            if part not in OPEN_VERBS
            and part not in LIST_NOUNS
            and part not in POLITE_TOKENS
            and part not in FILLER
        ]
        if len(extra) <= 1:
            return UiCommand(UiAction.OPEN_LIST)
    return None
