"""Deterministic language and teaching state for one Rita voice lesson."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import StrEnum


class ResponseType(StrEnum):
    BACKCHANNEL = "backchannel"
    ANSWER_SHORT = "answer_short"
    CORRECTION = "correction"
    EXPLAIN = "explain"
    PRONUNCIATION_DRILL = "pronunciation_drill"
    TOOL_ACTION = "tool_action"
    EMPATHY = "empathy_social"


class LanguageSource(StrEnum):
    EXPLICIT = "explicit"
    STABLE_AUTO = "stable-auto"
    PROFILE = "profile"


_ARABIC = re.compile(r"[\u0600-\u06ff]")
_LATIN = re.compile(r"[A-Za-zÄÖÜäöüß]")
_GERMAN_MARKERS = re.compile(
    r"\b(?:ich|du|der|die|das|nicht|bitte|danke|guten|morgen|wie|was|warum|deutsch|"
    r"sprechen|möchte|kann|können|ist|sind|hallo)\b|[ÄÖÜäöüß]",
    re.IGNORECASE,
)


def infer_turn_language(text: str) -> str:
    """Return a conservative language guess without treating one loanword as a switch."""

    arabic = len(_ARABIC.findall(text))
    latin = len(_LATIN.findall(text))
    # Arabic function words wrapped around a German/English learning target are
    # still an Arabic turn. Requiring twice as many Arabic characters made
    # short questions such as "شو معنى Guten Morgen بالألماني؟" drift languages.
    if arabic >= 4 and arabic >= latin:
        return "ar"
    if latin >= 4 and _GERMAN_MARKERS.search(text):
        return "de"
    if latin >= 4:
        return "en"
    return "unknown"


@dataclass
class RitaSessionState:
    active_language: str = "automatic"
    active_dialect: str = "ar-JO"
    language_source: LanguageSource = LanguageSource.PROFILE
    current_turn_language: str = "unknown"
    candidate_language: str = "unknown"
    consecutive_evidence: int = 0
    attempt_count: int = 0
    understood: bool = False
    frustration_signal: bool = False
    correction_budget: int = 1
    last_feedback_signature: str = ""
    response_type: ResponseType = ResponseType.ANSWER_SHORT
    recent_user_turns: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.active_language in {"ar", "en", "de"}:
            self.language_source = LanguageSource.PROFILE

    def _apply_explicit_language(self, lowered: str) -> bool:
        commands = (
            (r"(?:احكي|تكلم|جاوب).{0,25}(?:أردني|اردني|لهجة أردنية|لهجة اردنية)", "ar", "ar-JO"),
            (r"(?:احكي|تكلم|جاوب).{0,25}(?:فصحى|عربي فصيح)", "ar", "standard"),
            (r"(?:speak|answer|talk).{0,20}(?:english)", "en", "en-GB"),
            (r"(?:speak|answer|talk).{0,20}(?:german|deutsch)|(?:sprich|antworte).{0,20}deutsch", "de", "standard"),
            (r"(?:احكي|تكلم|جاوب).{0,25}(?:انجليزي|إنجليزي)", "en", "en-GB"),
            (r"(?:احكي|تكلم|جاوب).{0,25}(?:ألماني|الماني)", "de", "standard"),
        )
        for pattern, language, dialect in commands:
            if re.search(pattern, lowered, re.IGNORECASE):
                self.active_language = language
                self.active_dialect = dialect
                self.language_source = LanguageSource.EXPLICIT
                self.candidate_language = language
                self.consecutive_evidence = 2
                return True
        return False

    def _update_stable_language(self, inferred: str) -> None:
        if inferred == "unknown" or self.language_source == LanguageSource.EXPLICIT:
            return
        if inferred == self.candidate_language:
            self.consecutive_evidence += 1
        else:
            self.candidate_language = inferred
            self.consecutive_evidence = 1
        if self.consecutive_evidence >= 2 and inferred != self.active_language:
            self.active_language = inferred
            self.active_dialect = "ar-JO" if inferred == "ar" else "en-GB" if inferred == "en" else "standard"
            self.language_source = LanguageSource.STABLE_AUTO

    def observe_user_turn(self, text: str) -> None:
        clean = re.sub(r"\s+", " ", text).strip()
        lowered = clean.casefold()
        self.recent_user_turns = (self.recent_user_turns + [clean])[-8:]
        self.current_turn_language = infer_turn_language(clean)
        if not self._apply_explicit_language(lowered):
            self._update_stable_language(self.current_turn_language)

        self.understood = bool(
            re.search(r"(?:فهمت|تمام فهمت|خلص فهمت|got it|i understand|verstanden|weiter)", lowered)
        )
        self.frustration_signal = bool(
            re.search(
                r"(?:مش فاهم|مو فاهم|صعب|غلط مرة ثانية|i don'?t get it|confused|verstehe nicht)",
                lowered,
            )
        )
        pronunciation = bool(re.search(r"(?:كيف تنطق|نطق|pronounc|aussprach)", lowered))
        correction_retry = bool(
            re.search(r"(?:مرة ثانية|كمان مرة|لسا غلط|again|noch einmal|wiederholen)", lowered)
        )
        if self.understood:
            self.attempt_count = 0
            self.last_feedback_signature = ""
        elif pronunciation or correction_retry:
            self.attempt_count += 1

        if pronunciation:
            self.response_type = ResponseType.PRONUNCIATION_DRILL
        elif re.search(r"(?:اشرح|ليش|why|explain|warum)", lowered):
            self.response_type = ResponseType.EXPLAIN
        elif re.search(r"(?:احفظ|حط|ضيف|flashcard|german lab)", lowered):
            self.response_type = ResponseType.TOOL_ACTION
        elif self.frustration_signal:
            self.response_type = ResponseType.EMPATHY
        elif correction_retry:
            self.response_type = ResponseType.CORRECTION
        else:
            self.response_type = ResponseType.ANSWER_SHORT

    def observe_assistant_turn(self, text: str) -> None:
        normalized = re.sub(r"[^\w\u0600-\u06ff]+", " ", text.casefold()).strip()
        self.last_feedback_signature = " ".join(normalized.split()[:16])

    def prompt_state(self) -> str:
        strategy = (
            "normal"
            if self.attempt_count < 2
            else "change-method: slower model, minimal pair, syllable isolation, or new analogy"
        )
        return (
            f"response_type={self.response_type}; active_language={self.active_language}; "
            f"turn_language={self.current_turn_language}; dialect={self.active_dialect}; "
            f"language_source={self.language_source}; evidence={self.consecutive_evidence}; "
            f"attempt_count={self.attempt_count}; understood={self.understood}; "
            f"frustration={self.frustration_signal}; correction_budget={self.correction_budget}; "
            f"teaching_strategy={strategy}; last_feedback={self.last_feedback_signature or 'none'}"
        )
