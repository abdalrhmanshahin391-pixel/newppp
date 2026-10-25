"""Rita's side of a lesson with exercises (the website's lesson engine).

The website owns the lesson: its engine decides the step, checks every answer and sends Rita
the current step ("rita-lesson-step") plus any exact line to say ("rita-lesson-say"). Rita never
moves the lesson, never says whether an answer is right, and never reads an answer key: she
does not have one.

This module does two things, both pure so they are unit tested:

1. What Rita is told: a fixed LESSON MODE CONTRACT and a short CURRENT LESSON STEP block,
   rebuilt from the step the website sent.
2. What a finished learner turn means for the lesson (`route`): "ready", "no question", "I did
   not understand", pause, hint, repeat, a question, or an answer to the open question. The
   router sends that to the website as "rita-lesson-signal"; only questions reach the model.
   When unsure between an answer and a question, it is a question: a question costs one model
   reply, a wrong answer would cost a mark.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from rita_dialogue_acts import normalize

ITEM_PHASES = {"guided", "practice", "remediation"}
READY_PHASES = {"intro", "explain", "section_result", "wrap"}


def _phrases(*values: str) -> tuple[str, ...]:
    return tuple(sorted({normalize(value) for value in values if normalize(value)}, key=len, reverse=True))


READY = _phrases(
    "يلا", "يالله", "يلا نبلش", "يلا نكمل", "جاهز", "جاهزه", "تمام", "اوكي", "أوكي", "ماشي", "طيب",
    "نعم", "اه", "آه", "أه", "اي", "إيه", "ايوه", "أيوه", "يب", "اكيد", "أكيد", "كمل", "كملي", "نكمل",
    "فهمت", "فهمتها", "فهمت عليكي", "واضح", "واضحه", "التالي", "خلينا نتمرن", "نتمرن",
    "ok", "okay", "yes", "yeah", "yep", "ready", "got it", "i got it", "clear", "next",
    "lets go", "let's go", "go on", "continue", "sure",
)
NO_QUESTION = _phrases(
    "لا", "لأ", "لا ما عندي", "ما عندي", "ما عندي سؤال", "مافي", "ما في", "ما في سؤال", "لا شكرا",
    "no", "nope", "no questions", "no question", "nothing",
)
NOT_UNDERSTOOD = _phrases(
    "مش فاهم", "مش فاهمه", "ما فهمت", "مافهمت", "ما فهمتش", "مش واضح", "مش واضحه", "اشرحي كمان",
    "اشرح كمان", "عيدي الشرح", "عيد الشرح", "اشرحيها مره ثانيه", "اشرحيها مرة تانية",
    "مره ثانيه", "مرة ثانية", "مرة تانية", "بطريقه ثانيه",
    "i don't understand", "i dont understand", "didn't understand", "explain again", "not clear",
)
REPEAT_QUESTION = _phrases(
    "عيدي السؤال", "عيد السؤال", "شو السؤال", "عيدي", "عيد", "كمان مره", "كمان مرة",
    "repeat", "repeat the question", "say it again", "again", "what was the question",
)
PAUSE = _phrases(
    "وقف", "وقفي", "وقّفي", "لحظه", "لحظة", "دقيقه", "دقيقة", "بعدين", "خليني ارتاح", "استراحه",
    "خلص", "كفايه", "كفاية", "pause", "stop", "wait a minute", "one moment", "hold on",
)
RESUME = _phrases(
    "كمل", "كملي", "نكمل", "يلا", "رجعنا", "جاهز", "جاهزه", "يلا نكمل", "خلينا نكمل",
    "continue", "go on", "resume", "ready", "lets continue", "let's continue",
)
HINT = _phrases(
    "تلميح", "ساعديني", "ساعدني", "اعطيني تلميح", "عطيني تلميح", "مش عارف", "مش عارفه", "ما بعرف",
    "hint", "help", "help me", "give me a hint", "i don't know", "i dont know",
)
ASK = _phrases("عندي سؤال", "سؤال", "بدي اسال", "بدي أسأل", "i have a question", "question")
# Words that make a turn a question about the lesson, not an answer to the open item.
QUESTION_WORDS = _phrases(
    "ليش", "ليه", "كيف", "شو يعني", "شو معنى", "يعني شو", "ليش مش", "طب ليش", "متى", "امتى",
    "why", "how", "what does", "what is", "when do", "is it", "can i", "should i",
)
# Fillers: the learner is thinking; the normal router holds without answering.
FILLERS = _phrases("امم", "ممم", "اه يعني", "يعني", "استني", "استنى", "um", "uh", "hmm")


@dataclass(frozen=True)
class LessonRoute:
    """What a learner turn means for the lesson."""

    signal: str  # ready | no_question | repeat | question | pause | resume | hint | answer | ack
    value: str = ""
    # True when the model should reply (a question); False when the website's next step speaks.
    to_model: bool = False


def _matches(text: str, phrases: tuple[str, ...], *, whole: bool = False) -> bool:
    said = normalize(text)
    if not said:
        return False
    if whole:
        return said in phrases
    padded = f" {said} "
    return any(f" {phrase} " in padded for phrase in phrases)


def _is_question(raw: str) -> bool:
    return "?" in raw or "؟" in raw or _matches(raw, QUESTION_WORDS) or _matches(raw, ASK)


class LessonVoice:
    """The step the website last sent, and how learner turns are read against it."""

    def __init__(self) -> None:
        self.step: dict[str, Any] = {}

    @property
    def active(self) -> bool:
        return bool(self.step)

    def set_step(self, data: Any) -> bool:
        """Keeps a newer step; ignores an older revision arriving late. True when kept."""
        if not isinstance(data, dict):
            return False
        try:
            revision = int(data.get("revision", 0))
        except (TypeError, ValueError):
            return False
        if self.step and revision < int(self.step.get("revision", 0)):
            return False
        self.step = data
        return True

    @property
    def phase(self) -> str:
        return str(self.step.get("phase", ""))

    @property
    def paused(self) -> bool:
        return bool(self.step.get("paused"))

    def route(self, text: str) -> LessonRoute | None:
        """The lesson meaning of one finished turn, or None to leave it to the normal router."""

        raw = (text or "").strip()
        if not self.active or not raw or self.phase in {"", "done"}:
            return None
        if _matches(raw, FILLERS, whole=True):
            return None
        if self.phase in ITEM_PHASES and not self.paused:
            return self._route_item(raw)
        if self.paused:
            if _matches(raw, RESUME, whole=True):
                return LessonRoute("resume")
            return LessonRoute("question", to_model=True)
        return self._route_ready(raw)

    def _route_ready(self, raw: str) -> LessonRoute:
        if _matches(raw, NOT_UNDERSTOOD):
            if self.phase == "explain":
                return LessonRoute("repeat", to_model=True)
            return LessonRoute("question", to_model=True)
        if _is_question(raw) and not _matches(raw, NO_QUESTION, whole=True):
            return LessonRoute("question", to_model=True)
        if _matches(raw, NO_QUESTION, whole=True):
            return LessonRoute("no_question" if self.phase == "explain" else "ready")
        if _matches(raw, READY, whole=True) or _short_ready(raw):
            return LessonRoute("no_question" if self.phase == "explain" else "ready")
        return LessonRoute("question", to_model=True)

    def _route_item(self, raw: str) -> LessonRoute:
        options = [str(option) for option in (self.step.get("item") or {}).get("options") or []]
        if normalize(raw) in {normalize(option) for option in options}:
            return LessonRoute("answer", value=raw[:200])
        if _matches(raw, PAUSE, whole=True):
            return LessonRoute("pause")
        if _matches(raw, HINT, whole=True):
            return LessonRoute("hint")
        if _matches(raw, REPEAT_QUESTION, whole=True):
            return LessonRoute("repeat")
        if _matches(raw, NOT_UNDERSTOOD) or _is_question(raw):
            # "مش فاهم" or "ليش is؟" in the middle of an exercise: pause on this question and let
            # Rita answer; the learner says "كمّل" to come back to the same question.
            return LessonRoute("question", to_model=True)
        if _matches(raw, READY, whole=True) or _short_ready(raw):
            # "تمام" after a result is an acknowledgement, not an answer: nothing to do.
            return LessonRoute("ack")
        return LessonRoute("answer", value=raw[:200])

    # ---------- what Rita is told ----------

    def step_text(self) -> str:
        """The CURRENT LESSON STEP block for the system prompt."""

        step = self.step
        if not step:
            return "CURRENT LESSON STEP\nThe lesson is loading. Say nothing about it yet.\n"
        lines = ["CURRENT LESSON STEP (from the website; it changes as the lesson moves)"]
        section = step.get("section") or {}
        if section:
            lines.append(
                f"Part {int(section.get('index', 0)) + 1} of {section.get('count', 1)}: "
                f"{section.get('title', '')} ({section.get('title_ar', '')})"
            )
        phase = self.phase
        lines.append(f"Phase: {phase}{' (paused)' if self.paused else ''}")
        explain = step.get("explain") or {}
        if explain:
            lines.append(f"Rule to teach: {explain.get('rule_ar', '')}")
            if explain.get("rule_en"):
                lines.append(f"Rule in English: {explain.get('rule_en')}")
            table = explain.get("table") or []
            if table:
                lines.append("Table: " + "; ".join(f"{row.get('left')} → {row.get('right')}" for row in table))
            examples = explain.get("examples") or []
            if examples:
                lines.append("Examples from the book: " + " | ".join(str(e.get("text", "")) for e in examples))
        item = step.get("item") or {}
        if item:
            options = item.get("options") or []
            lines.append(
                f"Open question {step.get('item_number', 1)} of {step.get('item_count', 1)} "
                f"(shown in the exercise window): {item.get('prompt', '')}"
                + (f" Options: {', '.join(options)}." if options else "")
            )
        lines.append("What to do now: " + _what_now(phase, self.paused))
        return "\n".join(lines) + "\n"


def _short_ready(raw: str) -> bool:
    """"تمام يلا" or "ok let's go": the turn is made only of ready words (at most six words)."""

    said = normalize(raw)
    if not said or len(said.split()) > 6:
        return False
    rest = f" {said} "
    for phrase in READY:  # longest first, so "lets go" goes before "go"
        while f" {phrase} " in rest:  # "يلا يلا": the matches touch, so repeat until none is left
            rest = rest.replace(f" {phrase} ", " ")
    return not rest.strip()


def _what_now(phase: str, paused: bool) -> str:
    if paused:
        return (
            "The exercise is paused because the learner has a question. Answer it in at most three "
            "short sentences about this part only, then say they can say «كمّل» to go back to the "
            "same question. Never give the answer to the open question."
        )
    return {
        "intro": (
            "Greet the learner in one short sentence, name today's lesson in one sentence, and ask "
            "if they are ready to start («جاهز نبلش؟» is fine, gender-neutral wording only)."
        ),
        "explain": (
            "Teach this part now, in three to six short spoken sentences: the rule, then the table "
            "read naturally, then one or two of the book's examples. The table and examples are on "
            "the learner's screen. End with exactly one question: «عندك سؤال قبل ما نتمرن؟». If the "
            "learner said they did not understand, explain it again a different way with a new "
            "simple example, shorter than before, and ask the same question."
        ),
        "guided": _ITEM_RULE,
        "practice": _ITEM_RULE,
        "remediation": _ITEM_RULE,
        "section_result": "The website says the result of this part. Say nothing more unless asked.",
        "wrap": "The website says the summary. Say nothing more unless asked.",
    }.get(phase, "Follow the website's lead.")


_ITEM_RULE = (
    "The exercise window is open and the website reads the question and says if an answer is right. "
    "You only answer a question the learner asks: at most two short sentences about this rule, "
    "never the answer to the open question, never «صح» or «غلط». Then invite them to answer."
)

LESSON_MODE_CONTRACT = """LESSON MODE (a lesson with exercises)
- The website runs this lesson. It sends you the current step below and says some lines itself
  (the questions, whether an answer is right, the results). Never repeat those lines.
- Teach only what the current step says. Never start another topic, another part or a new
  exercise yourself, and never say that an answer is right or wrong: you do not know the answers.
- If the learner talks about something unrelated, answer in one short sentence and bring them
  back to the current step.
- Explanations are in the explanation language from the session state; English (or German)
  only for the words and sentences being taught.
"""


def lesson_engine_enabled(body: dict[str, Any]) -> bool:
    lesson = body.get("lesson")
    return isinstance(lesson, dict) and lesson.get("engine") is True


def lesson_engine_section(body: dict[str, Any], voice: LessonVoice | None) -> str:
    if not lesson_engine_enabled(body) or voice is None:
        return ""
    lesson = body.get("lesson") or {}
    title = str(lesson.get("title") or "").strip()[:160]
    header = f"\nCURRICULUM LESSON: {title}\n" if title else "\n"
    return f"{header}{LESSON_MODE_CONTRACT}\n{voice.step_text()}"


_SPACES = re.compile(r"\s+")


def clean_say(text: Any) -> str:
    """A line from the website for Rita to say: plain text, one paragraph, bounded."""

    return _SPACES.sub(" ", str(text or "")).strip()[:600]
