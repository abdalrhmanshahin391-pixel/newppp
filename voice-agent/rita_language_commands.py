"""Spoken or typed requests to change the language Rita answers in.

Only a request in the shape of an order locks the language: "احكي معي بالإنجليزي",
"اشرحلي بالعربي", "speak English", "explain dative in English", "sprich Deutsch". A learner who
only mentions a language ("I speak German at work", "talk about German grammar") has asked for
nothing. A wrong lock is worse than a missed one, because it holds for the rest of the session.

Arabic is matched after `normalize`, so hamza forms (أحكي/احكي), "ى/ي" and "ة/ه" all agree.
"""

from __future__ import annotations

import re
from typing import NamedTuple

from rita_dialogue_acts import normalize


class LanguageCommand(NamedTuple):
    language: str  # ar | en | de
    dialect: str  # ar-JO | standard | en-GB
    #: the order was to explain in a language; how-to-say questions may still carry it
    explain: bool = False


_TALK = r"(?:احكي|احكو|تحكي|حكي|تكلم|تكلمي|كلمني|كلمينا|جاوب|جاوبي|رد|ردي)"
_EXPLAIN = r"(?:اشرح|اشرحي|تشرح|تشرحي|شرح|فسر|فسري|تفسر|تفسري)"
# "اشرحلي" glues the pronoun on; "احكي معي" keeps it apart.
_ME = r"(?:ل(?:ي|نا|ه))?(?:\s+(?:لي|لنا|معي|معنا|معاي))?"
# `normalize` folds the doubled lam of "باللغة" and "باللهجة", so they read "بالغه" and "بالهجه".
_BY = r"\s+(?:(?:ب|بالغه\s+|بلغه\s+|بالهجه\s+|بلهجه\s+)(?:ال)?)?"

_AR_ENGLISH = r"(?:انجليز|انكليز)(?:ي|يه)?"
_AR_GERMAN = r"(?:ال)?ماني(?:ه)?"
_AR_ARABIC = r"(?:عربي\s+فصيح|عرب(?:ي|يه)|فصحي|اردني(?:ه)?)"

_EN_LANG = r"(english|german|arabic|deutsch)"
_EN_LEAD = (
    r"(?:^|[.!?,;]\s*|\b(?:please|pls|can you|could you|would you|will you|let'?s|you can|you could|"
    r"you should|you must|i want you to|i'?d like you to|i would like you to)\s+(?:please\s+)?)"
)
_DE_LEAD = r"(?:^|[.!?,;]\s*|\b(?:bitte|kannst du|könntest du|kannst|könnte)\s+)"

_EN_NAMES = {"english": "en", "german": "de", "deutsch": "de", "arabic": "ar"}
_DE_NAMES = {"deutsch": "de", "englisch": "en", "arabisch": "ar"}


def _from_arabic(stem: str) -> LanguageCommand:
    if re.fullmatch(_AR_ENGLISH, stem):
        return LanguageCommand("en", "en-GB")
    if re.fullmatch(_AR_GERMAN, stem):
        return LanguageCommand("de", "standard")
    if stem.startswith("فصح") or "فصيح" in stem:
        return LanguageCommand("ar", "standard")
    return LanguageCommand("ar", "ar-JO")


def detect_language_command(text: str, *, how_to_say: bool = False) -> LanguageCommand | None:
    """The language change this turn orders, or None.

    `how_to_say` is True for "كيف أحكي X بالإنجليزي": there "احكي" belongs to the question, so only
    an order to *explain* in a language still counts ("اشرحلي بالإنجليزي كيف أقولها بالألماني").
    """

    arabic = normalize(text)
    lang = f"({_AR_ENGLISH}|{_AR_GERMAN}|{_AR_ARABIC})"
    explain = re.search(rf"(?:^|\s){_EXPLAIN}{_ME}{_BY}{lang}\b", arabic)
    if explain:
        return _from_arabic(explain.group(1))._replace(explain=True)
    if not how_to_say:
        talk = re.search(rf"(?:^|\s){_TALK}{_ME}{_BY}{lang}\b", arabic)
        if talk:
            return _from_arabic(talk.group(1))

    english = re.sub(r"\s+", " ", (text or "").casefold()).strip()
    explain_en = re.search(rf"{_EN_LEAD}explain\b[^.?!]{{0,30}}?\bin\s+{_EN_LANG}\b", english)
    if explain_en:
        code = _EN_NAMES[explain_en.group(1)]
        return LanguageCommand(code, _dialect(code), explain=True)
    if not how_to_say:
        talk_en = re.search(
            rf"{_EN_LEAD}(?:speak|talk|answer|reply|respond|continue)\b"
            rf"(?:\s+(?:to|with)\s+me)?\s+(?:in\s+)?{_EN_LANG}\b",
            english,
        )
        if talk_en:
            code = _EN_NAMES[talk_en.group(1)]
            return LanguageCommand(code, _dialect(code))
        german = re.search(
            rf"{_DE_LEAD}(?:sprich|sprechen|antworte|rede|erkläre)\w*\b[^.?!]{{0,25}}?"
            r"\b(?:auf\s+)?(deutsch|englisch|arabisch)\b",
            english,
        )
        if german:
            code = _DE_NAMES[german.group(1)]
            return LanguageCommand(code, _dialect(code))
    return None


def _dialect(language: str) -> str:
    return {"ar": "ar-JO", "en": "en-GB"}.get(language, "standard")
