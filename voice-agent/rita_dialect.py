"""Natural Jordanian speech for Rita: what the model is told, a scripted greeting, and a cleaner.

Why this exists. Language models understand Arabic dialects better than they write them
(AL-QASIDA, 2024), so left alone the model invented phrases such as "كيف فيك اليوم؟" (in the
Levant "فيك" means "you can"), used "هكذا" instead of "هيك", and answered "كيف أحكي X بالإنجليزي؟"
in English only. Showing it real phrases and the exact answer shape fixes more than describing
the dialect does.

Three small pieces, none of them on the model's critical path:

- `DIALECT_PROMPT`: a phrasebank, a "say this, not that" table and short model dialogues.
- `is_greeting` / `greeting_for`: a plain "hello" as the first turn gets a vetted greeting
  instead of a generated one (also faster).
- `RitaSpeechCleaner`: a pipeline step in front of the voice that drops markdown marks and
  doubled full stops, and logs phrases we know are wrong so they can be added to the prompt.
"""

from __future__ import annotations

import re

from loguru import logger
from pipecat.frames.frames import (
    Frame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    TTSSpeakFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from rita_dialogue_acts import normalize, tokens

DIALECT_PROMPT = """JORDANIAN SPEECH (when speaking Arabic)
- Natural phrases to use and vary: أهلين، هلا والله، كيف الحال؟، شو الأخبار؟، آه فهمت، حلو، تمام، ماشي،
  أكيد، بالضبط، قربت، هيك أحسن، كمان مرة وبتضبط، عادي هاي صعبة عند الكل، من وين نبدأ؟، بدنا نكمل؟
- Say this, not that: هيك (not هكذا)، هلأ (not الآن)، شو (not ماذا)، ليش (not لماذا)، وين (not أين)،
  بدي (not أريد)، ما بعرف (not لا أعرف)، هاد/هاي (not هذا/هذه)، بنقولها (not يمكنك أن تقول).
- Never write "كيف فيك" (it means "how can you"); greet with "كيف الحال؟". Never ask "شو حابب/حابة"; ask
  "عن شو بدنا نحكي؟" so the sentence fits any gender.
- When the learner asks how to say something in English or German ("كيف أحكي X بالإنجليزي"،
  "شو بنقول Y بالألماني"), write the short explanation in the REPLY LANGUAGE named at the end of this
  prompt: one short sentence, the target phrase once in quotes, then one short usage tip. If the
  REPLY LANGUAGE is English, the explanation is English and only the quoted phrase is German; never
  switch to Arabic because the question was about translation.
  Put no extra full stop after a closing quote.
- Never use * or # or markdown marks; the voice would read them.

Examples of the right shape:
Learner: كيف أحكي بدي أروح على الحمام بالإنجليزي
Rita: بنقولها "I need to go to the bathroom". وبالحكي السريع بنقول "I'm going to the bathroom".
Learner: صباح الخير بالألماني
Rita: بنقول "Guten Morgen". وبنستخدمها لحد الساعة عشرة تقريباً.
Learner: شو معنى borrow
Rita: "Borrow" يعني تاخد شي مؤقت وبترجعه. مثلاً "Can I borrow your pen?"
Learner: مش فاهم الفرق
Rita: عادي، هاي بتلخبط الكل. خلّينا نشوف مثال واحد بس.
"""

LANGUAGE_NAMES = {"ar": "Arabic", "en": "English", "de": "German"}


def how_to_say_directive(reply_language: str | None) -> str:
    """Turn note for "how do I say X in Y": the explanation follows the reply language, the quoted
    phrase follows the language asked about. Never "the learner's own language", which the model
    read as Arabic even when the learner had asked for English."""

    name = LANGUAGE_NAMES.get(reply_language or "")
    where = f"in {name}" if name else "in the language of the learner's question"
    return (
        f"the learner asks how to say something in another language; write the explanation {where} "
        "(see REPLY LANGUAGE): one short sentence, the phrase in the language they asked about once "
        f"in quotes, then one short usage tip {where}"
    )


_TALK_VERB = r"(?:ا?حكي|ا?قول|بحكي|بقول|بنحكي|بنقول|نحكي|نقول|انطق|اكتب)"
_HOW_TO_SAY = re.compile(
    # "كيف أحكي X" / "شو بنقول Y". "شو نحكي هلق؟" means "what shall we talk about", so with شو a
    # talking verb only counts when a language is named after it ("شو أحكي بالإنجليزي").
    rf"(?:(?:كيف|شلون)\s+(?:(?:بدي|بقدر|ممكن|نقدر|بنقدر)\s+)?{_TALK_VERB})"
    r"|(?:شو\s+(?:(?:بدي|بقدر|ممكن|نقدر|بنقدر)\s+)?(?:ا?قول|بقول|بنقول|نقول|انطق|اكتب))"
    r"|(?:شو\s+(?:(?:بدي|بقدر|ممكن|نقدر|بنقدر)\s+)?(?:ا?حكي|بحكي|بنحكي|نحكي)\b(?=.*\bب(?:ال)?(?:ال)?(?:انجليز|انكليز|ماني|عرب)))"
    r"|(?:how\s+(?:do|can|would|should)\s+(?:i|you|we)\s+(?:say|write|tell)|how\s+to\s+say|how\s+do\s+you\s+say)"
    r"|(?:what\s+(?:is|s)\s+.{1,60}\s+in\s+(?:english|german|arabic))"
    r"|(?:wie\s+(?:sagt\s+man|heisst))"
)


def asks_how_to_say(text: str) -> bool:
    """True for "كيف أحكي X بالإنجليزي", "how do I say X", "wie sagt man X"."""

    return bool(_HOW_TO_SAY.search(normalize(text)))


# ------------------------------------------------------------------------------- greeting

_GREETING_WORDS = frozenset(
    normalize(w)
    for w in (
        "مرحبا", "مرحبتين", "اهلا", "اهلين", "هلا", "هلا والله", "هاي", "السلام", "عليكم", "صباح",
        "مساء", "الخير", "النور", "ريتا", "يا", "وسهلا", "hello", "hi", "hey", "hallo", "rita",
    )
    for w in w.split()
)

GREETINGS = {
    "ar": (
        "أهلين! كيف الحال؟ عن شو بدنا نحكي اليوم؟",
        "هلا والله! كيف الأحوال؟ شو بدنا نتعلم اليوم؟",
        "أهلاً وسهلاً! كيف الحال؟ من وين بدنا نبدأ؟",
    ),
    "en": (
        "Hi! How's it going? What shall we talk about today?",
        "Hello! Good to hear you. What would you like to practise?",
        "Hey! How are you today? What shall we work on?",
    ),
    "de": (
        "Hallo! Wie geht's? Worüber wollen wir heute sprechen?",
        "Hallo! Schön, dass du da bist. Was wollen wir üben?",
    ),
}


def is_greeting(text: str) -> bool:
    """A plain hello (at most four words, nothing but greeting words). "Guten Morgen" alone is
    left to the model: in a German lesson it is an exercise, not a hello."""

    parts = tokens(text)
    return 0 < len(parts) <= 4 and all(part in _GREETING_WORDS for part in parts)


def greeting_for(text: str, language: str) -> str:
    options = GREETINGS.get(language, GREETINGS["ar"])
    return options[sum(map(ord, text)) % len(options)]


# --------------------------------------------------------------------------------- watch

# Phrases the model has produced that no Jordanian speaker would say; they are only logged.
KNOWN_WRONG = (
    (re.compile(r"كيف\s+فيك"), "كيف فيك -> كيف الحال"),
    (re.compile(r"هكذا"), "هكذا -> هيك"),
    (re.compile(r"شو\s+حاب[ةب]"), "شو حابب/حابة -> عن شو بدنا نحكي"),
    (re.compile(r"يمكنك\s+أن"), "يمكنك أن -> بنقول/بتقدر"),
    (re.compile(r"\*\*|__|`"), "markdown mark in speech"),
    (re.compile(r"(?i)\buser\s+wants?\b|learner_act|\bdirective\b"), "model note leaked into the reply"),
)


def scan_dialect(text: str) -> list[str]:
    return [label for pattern, label in KNOWN_WRONG if pattern.search(text)]


# ------------------------------------------------------------------------------- cleaner

_CLOSERS = "”\"’»'"
_STOPS = ".!?؟"

# Notes the model sometimes writes to itself ("User wants continue.") and that must never be
# spoken or shown. Only specific openings are matched, so ordinary English sentences pass.
LEAK_OPENINGS = (
    "user wants", "user want", "user asks", "user asked", "user said", "user says", "user is",
    "user needs", "user has", "the user", "the learner", "learner wants", "learner asks",
    "learner said", "we should respond", "we should answer", "we should continue",
    "we should reply", "we need to respond", "we need to continue", "we need to answer",
    "rita should", "assistant should", "need to respond", "learner_act", "directive",
    "last_question", "topic_paused", "response_type", "teaching_strategy", "respond in arabic",
    "answer in arabic", "reply in arabic",
)
_MAX_PROBE = max(len(item) for item in LEAK_OPENINGS)


def _probe(buffer: str) -> str:
    """"leak" once the buffer starts a known leaked note, "keep" if it cannot become one,
    otherwise "wait" for more characters."""

    text = re.sub(r"\s+", " ", buffer.lower())
    if any(text.startswith(item) for item in LEAK_OPENINGS):
        return "leak"
    if any(item.startswith(text) for item in LEAK_OPENINGS):
        return "wait"
    return "keep"


class SpeechTextFilter:
    """Clean-up that works on any slicing of a streamed reply: markdown marks, a stop after a
    closing quote, and self-notes. Only text that starts like a leaked note is ever held back,
    and only for a few characters."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self._tail = ""  # the last two characters that were let through
        self._at_start = True  # at the start of a sentence
        self._probe = ""  # Latin text held while it might be a leaked note
        self._dropping = False  # inside a leaked note, until its sentence ends
        self._skip_space = False  # swallow the space that follows a dropped note

    @property
    def pending(self) -> str:
        """Held-back text that turned out not to be a leak (call at the end of a reply)."""

        held, self._probe = self._probe, ""
        return held if held and _probe(held) != "leak" else ""

    def _emit(self, out: list[str], text: str) -> None:
        for ch in text:
            # "…”." -> a stop, a closing quote, then another stop: drop the second stop.
            if ch in _STOPS and len(self._tail) == 2 and self._tail[0] in _STOPS and self._tail[1] in _CLOSERS:
                continue
            # "!!" or "؟؟": one is enough (a three-dot ellipsis is kept).
            if ch in "!?؟" and self._tail[-1:] == ch:
                continue
            out.append(ch)
            self._tail = (self._tail + ch)[-2:]
            if ch in _STOPS or ch == "\n":
                self._at_start = True
            elif ch in _CLOSERS and self._at_start:
                pass  # a closing quote right after a stop still ends the same sentence
            elif not ch.isspace():
                self._at_start = False

    def feed(self, text: str) -> str:
        out: list[str] = []
        for ch in text:
            if ch in "*`":
                continue
            # A heading mark or a lone underscore at the start of a line is markdown, not speech.
            if ch in "#_" and (not self._tail or self._tail[-1] in " \n"):
                continue
            if self._dropping:
                if ch in _STOPS or ch == "\n":
                    self._dropping = False
                    self._skip_space = True
                    self._at_start = True
                continue
            if self._skip_space:
                if ch.isspace():
                    continue
                self._skip_space = False
            if self._probe:
                self._probe += ch
                verdict = _probe(self._probe)
                if verdict == "leak":
                    self._probe = ""
                    self._dropping = True
                elif verdict == "keep" or len(self._probe) > _MAX_PROBE:
                    held, self._probe = self._probe, ""
                    self._emit(out, held)
                continue
            if self._at_start and ch.isascii() and ch.isalpha():
                self._probe = ch
                if _probe(ch) == "keep":
                    self._probe = ""
                    self._emit(out, ch)
                continue
            self._emit(out, ch)
        return "".join(out)


class RitaSpeechCleaner(FrameProcessor):
    """Place between the language model and the voice. The text frame is changed in place so
    the page's live chat (which reads the same frames) is never shown the text twice."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._filter = SpeechTextFilter()
        self._raw: list[str] = []

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        try:
            if isinstance(frame, LLMFullResponseStartFrame | InterruptionFrame):
                self._filter.reset()
                self._raw = []
            elif isinstance(frame, LLMTextFrame):
                self._raw.append(frame.text)
                frame.text = self._filter.feed(frame.text)
                if not frame.text:
                    return  # everything in it is being held back or dropped
            elif isinstance(frame, LLMFullResponseEndFrame):
                tail = self._filter.pending
                if tail:
                    await self.push_frame(TTSSpeakFrame(tail), direction)
                found = scan_dialect("".join(self._raw))
                if found:
                    logger.bind(findings=found).warning("Rita dialect watch")
                self._raw = []
        except Exception as error:  # cleaning must never silence Rita
            logger.bind(error=repr(error)).warning("Rita speech cleaner failed")
        await self.push_frame(frame, direction)
