"""Deterministic language and teaching state for one Rita voice lesson."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import StrEnum

from rita_dialect import LANGUAGE_NAMES, asks_how_to_say, how_to_say_directive
from rita_dialogue_acts import Act, Awaiting, classify, parse_last_question, tokens
from rita_language_commands import detect_language_command


class ResponseType(StrEnum):
    BACKCHANNEL = "backchannel"
    ANSWER_SHORT = "answer_short"
    CORRECTION = "correction"
    EXPLAIN = "explain"
    PRONUNCIATION_DRILL = "pronunciation_drill"
    TOOL_ACTION = "tool_action"
    EMPATHY = "empathy_social"
    COMPLAINT = "complaint"
    SIMPLIFY = "simplify"


class LanguageSource(StrEnum):
    EXPLICIT = "explicit"
    STABLE_AUTO = "stable-auto"
    PROFILE = "profile"


_ARABIC = re.compile(r"[\u0600-\u06ff]")
_LATIN = re.compile(r"[A-Za-zÄÖÜäöüß]")
# "was" and "die" are ordinary English words ("I was there"), so they are not German evidence.
_GERMAN_MARKERS = re.compile(
    r"\b(?:ich|du|der|das|nicht|bitte|danke|guten|morgen|wie|warum|deutsch|und|habe|mein|aber|"
    r"sprechen|möchte|kann|können|ist|sind|hallo)\b|[ÄÖÜäöüß]",
    re.IGNORECASE,
)
# Thinking sounds are not words of any language: "Äh. You are so confused" is English.
_THINKING_SOUNDS = re.compile(r"\b(?:äh+m?|ähm|uh+m?|hmm+)\b", re.IGNORECASE)
_ARABIC_LEARNING_REQUEST = re.compile(
    r"(?:شو|ما|إيش|ايش)\s+معنى|(?:ترجم|ترجمة|يعني|معنى|كلمة|كلمات|بالألماني|بالالماني|بالإنجليزي|بالانجليزي)"
)


def infer_turn_language(text: str) -> str:
    """Return a conservative language guess without treating one loanword as a switch."""

    text = _THINKING_SOUNDS.sub(" ", text)
    arabic = len(_ARABIC.findall(text))
    latin = len(_LATIN.findall(text))
    # Arabic function words wrapped around a German/English learning target are
    # still an Arabic turn. Requiring twice as many Arabic characters made
    # short questions such as "شو معنى Guten Morgen بالألماني؟" drift languages.
    if arabic >= 4 and (arabic >= latin or _ARABIC_LEARNING_REQUEST.search(text)):
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
    # Conversation memory for short answers ("إيه", "مش عارف") and stop commands.
    last_question: str = ""
    awaiting: Awaiting = Awaiting.NONE
    options: tuple[str, ...] = ()
    topic: str = ""
    topic_paused: bool = False
    last_act: Act = Act.OTHER
    clarification_count: int = 0
    stop_count: int = 0
    # How many words are in the learner's list on screen (None until the page reports it).
    learning_count: int | None = None
    # The learner asked how to say something; the reply stays in their own language.
    asked_how_to_say: bool = False
    # Rita has already spoken (or been greeted by the scripted hello).
    assistant_turns: int = 0
    greeted: bool = False
    # Interpretations explicitly rejected by the learner. Keep this tiny and bounded.
    rejected_interpretations: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.active_language in {"ar", "en", "de"}:
            self.language_source = LanguageSource.PROFILE

    def _apply_explicit_language(self, text: str) -> bool:
        """Lock the reply language on an order such as "احكي معي بالإنجليزي"; see rita_language_commands."""

        command = detect_language_command(text, how_to_say=asks_how_to_say(text))
        if command is None:
            return False
        self.active_language = command.language
        self.active_dialect = command.dialect
        self.language_source = LanguageSource.EXPLICIT
        self.candidate_language = command.language
        self.consecutive_evidence = 2
        return True

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
        self._observe_act(clean)
        self.asked_how_to_say = asks_how_to_say(clean)
        self.current_turn_language = infer_turn_language(clean)
        if not self._apply_explicit_language(clean):
            self._update_stable_language(self.current_turn_language)

        # "ما فهمت ولا كلمة" contains "فهمت" and means the opposite.
        negated = bool(
            re.search(r"(?:(?<!\S)(?:ما|مش|مو|لا|not|nicht|nie)|n['’]t)\s*(?:\S+\s+)?(?:فهمت|understand|get it|verstan)", lowered)
        )
        self.understood = not negated and self.last_act not in (Act.SIMPLIFY, Act.COMPLAINT) and bool(
            re.search(r"(?:فهمت|تمام فهمت|خلص فهمت|got it|i understand|verstanden|weiter)", lowered)
        )
        self.frustration_signal = bool(
            re.search(
                r"(?:مش فاهم|مو فاهم|صعب|معقد|مبتدئ|ابسط|أبسط|بسط|غلط مرة ثانية|i don'?t get it|confused|simpler|verstehe nicht)",
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
        elif pronunciation or correction_retry or self.last_act == Act.SIMPLIFY:
            self.attempt_count += 1

        if self.last_act == Act.COMPLAINT:
            self.response_type = ResponseType.COMPLAINT
        elif self.last_act == Act.SIMPLIFY:
            self.response_type = ResponseType.SIMPLIFY
        elif pronunciation:
            self.response_type = ResponseType.PRONUNCIATION_DRILL
        elif re.search(
            r"(?:اشرح|ليش|لماذا|فصل|تفصيل|كل كلمه|كل كلمة|وضح|why|explain|warum|in detail|word by word|break (?:it )?down)",
            lowered,
        ):
            self.response_type = ResponseType.EXPLAIN
        elif re.search(r"(?:احفظ|حط|ضيف|flashcard|german lab)", lowered):
            self.response_type = ResponseType.TOOL_ACTION
        elif self.frustration_signal:
            self.response_type = ResponseType.EMPATHY
        elif correction_retry:
            self.response_type = ResponseType.CORRECTION
        else:
            self.response_type = ResponseType.ANSWER_SHORT

    def _observe_act(self, clean: str) -> None:
        reading = classify(clean, awaiting=self.awaiting)
        self.last_act = reading.act
        if reading.act == Act.CORRECTION:
            rejected = self._rejected_interpretation(clean)
            if rejected and rejected not in self.rejected_interpretations:
                self.rejected_interpretations = (self.rejected_interpretations + [rejected])[-5:]
        if reading.act == Act.STOP:
            self.topic_paused = True
            self.stop_count += 1
        elif reading.act in (Act.OTHER, Act.CONTINUE):
            self.topic_paused = False
        if reading.act == Act.OTHER and len(tokens(clean)) >= 3:
            self.topic = " ".join(clean.split()[:12])
        if not (reading.act == Act.YES and self.awaiting == Awaiting.CHOICE):
            self.clarification_count = 0

    @staticmethod
    def _rejected_interpretation(text: str) -> str:
        """Extract only an explicit rejected interpretation, never invent one."""

        match = re.match(r"^\s*(?:مش|مو|not)\s+(.+?)\s*[.!؟?]*$", text, re.IGNORECASE) or re.match(
            r"^\s*i\s+(?:was\s*not|wasn['’]?t)\s+talking\s+about\s+(.+?)\s*[.!؟?]*$", text, re.IGNORECASE
        )
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip()[:80]
        return ""

    def observe_assistant_turn(self, text: str) -> None:
        self.assistant_turns += 1
        normalized = re.sub(r"[^\w\u0600-\u06ff]+", " ", text.casefold()).strip()
        self.last_feedback_signature = " ".join(normalized.split()[:16])
        question = parse_last_question(text)
        self.last_question = question.text
        self.awaiting = question.awaiting
        self.options = question.options

    def turn_directive(self) -> str:
        """One instruction for the model about the learner's last short turn, or empty."""

        if self.asked_how_to_say:
            return how_to_say_directive(self.reply_language())
        act, awaiting = self.last_act, self.awaiting
        if act == Act.YES and awaiting == Awaiting.YES_NO:
            return "the learner answered YES to last_question"
        if act == Act.NO:
            if awaiting == Awaiting.CHOICE:
                return "the learner refused every option; ask one short open question about what they want"
            if awaiting == Awaiting.YES_NO:
                return "the learner answered NO to last_question"
            return "the learner said no; accept it, do not argue or explain, offer one short alternative"
        if act == Act.DONT_KNOW:
            return "the learner does not know; pick the simplest option yourself in one short sentence and continue; do not ask again"
        if act == Act.CORRECTION:
            rejected = ", ".join(self.rejected_interpretations[-5:]) or "the last assumption"
            return f"the learner is correcting you; do not return to these rejected interpretations: {rejected}; ask one short clarification if the replacement is not explicit"
        if act == Act.COMPLAINT:
            return "acknowledge the reported problem in one short sentence; do not invent a technical cause, teach, or defend yourself; ask one short follow-up only if needed"
        if act == Act.SIMPLIFY:
            if self.attempt_count >= 2:
                return "the learner still needs a simpler explanation; change method completely and use one concrete everyday example; do not repeat the previous wording"
            return "explain the same idea in plain words with one concrete example; do not add a second concept"
        if act == Act.UNDERSTOOD:
            return "the learner understood; do not re-explain; take one small next step"
        if act == Act.CONTINUE:
            return "continue the topic from where you stopped; do not restart or summarise"
        if act == Act.REPEAT:
            return "repeat your last reply, shorter and simpler"
        if act == Act.UNCLEAR:
            return "the answer does not fit last_question; ask one short clarification of at most eight words"
        if act == Act.BACKCHANNEL:
            return "the learner only acknowledged; answer in one short sentence or continue naturally"
        return ""

    def turn_note(self, *, dialogue: bool = False) -> str:
        """The response type as a plain sentence, for types that change how Rita should answer.

        Empty when the dialogue directive already says it (router on), so the model never reads
        the same instruction twice.
        """

        if dialogue and self.turn_directive():
            return ""
        if self.response_type == ResponseType.COMPLAINT:
            return (
                "TURN NOTE: THE LEARNER IS REPORTING A PROBLEM. Acknowledge it in one short sentence. "
                "Do not defend yourself, do not invent a technical cause, do not teach."
            )
        if self.response_type == ResponseType.SIMPLIFY:
            if self.attempt_count >= 2:
                return (
                    "TURN NOTE: THE LEARNER IS STILL CONFUSED. Change method completely: one concrete "
                    "everyday example, no grammar terms, none of your previous wording."
                )
            return (
                "TURN NOTE: THE LEARNER IS CONFUSED. Explain the same idea again in plain words with "
                "ONE concrete everyday example. No grammar terms. Do not repeat your previous wording."
            )
        if self.response_type == ResponseType.EXPLAIN:
            return (
                "TURN NOTE: THE LEARNER ASKED FOR AN EXPLANATION. This overrides the usual length: up to "
                "five short spoken sentences, still no lists. Cover exactly what they asked, nothing more."
            )
        if self.response_type == ResponseType.EMPATHY:
            return (
                "TURN NOTE: THE LEARNER SOUNDS DISCOURAGED. Say one human sentence about it first, "
                "then offer one small, easy next step."
            )
        return ""

    def reply_language(self) -> str | None:
        """The language Rita writes explanations in this turn, or None when it is not known yet."""

        if self.active_language in LANGUAGE_NAMES:
            return self.active_language
        if self.current_turn_language in LANGUAGE_NAMES:
            return self.current_turn_language
        return None

    def reply_language_line(self, target_name: str | None = None) -> str:
        """One plain sentence for the end of the prompt, instead of a symbol the model has to decode."""

        language = self.reply_language()
        if language is None:
            line = "REPLY LANGUAGE: the language of the learner's last turn."
        else:
            line = f"REPLY LANGUAGE: {LANGUAGE_NAMES[language].upper()}. Write every explanation in {LANGUAGE_NAMES[language]}."
            if self.language_source == LanguageSource.EXPLICIT:
                line += " The learner asked for this; keep it until they ask for another language."
        if target_name:
            line += f" EXAMPLES AND TARGET PHRASES IN: {target_name.upper()}; do not translate them unless asked."
        return line

    def dialogue_state(self) -> str:
        question = self.last_question.replace('"', "'")[:120]
        options = "|".join(self.options)[:120]
        parts = [
            f"awaiting={self.awaiting.value}",
            f'last_question="{question}"' if question else "last_question=none",
            f'options="{options}"' if options else "options=none",
            f'topic="{self.topic.replace(chr(34), chr(39))[:90]}"' if self.topic else "topic=none",
            f"topic_paused={self.topic_paused}",
            f"learner_act={self.last_act.value}",
            f'rejected="{"|".join(self.rejected_interpretations[-5:])[:160]}"'
            if self.rejected_interpretations
            else "rejected=none",
        ]
        directive = self.turn_directive()
        if directive:
            parts.append(f"directive={directive}")
        return "; ".join(parts)

    def prompt_state(self, *, dialogue: bool = False) -> str:
        strategy = (
            "normal"
            if self.attempt_count < 2
            else "change-method: slower model, minimal pair, syllable isolation, or new analogy"
        )
        base = (
            f"response_type={self.response_type}; active_language={self.active_language}; "
            f"turn_language={self.current_turn_language}; dialect={self.active_dialect}; "
            f"language_source={self.language_source}; evidence={self.consecutive_evidence}; "
            f"attempt_count={self.attempt_count}; understood={self.understood}; "
            f"frustration={self.frustration_signal}; correction_budget={self.correction_budget}; "
            f"teaching_strategy={strategy}; last_feedback={self.last_feedback_signature or 'none'}"
        )
        return f"{base}; {self.dialogue_state()}" if dialogue else base
