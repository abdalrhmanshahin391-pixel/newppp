"""Deterministic reading of short learner turns.

A voice learner says a lot of very short things: "خلص", "إيه", "أمم… نوب", "مش عارف".
What they mean depends on the word, on what Rita was just doing, and on the question
she last asked. Sending all of that to the language model as an ordinary request is
what made Rita re-explain after "خلص", pick an option after a bare "إيه", and lose
the topic after "مش عارف".

This module reads such turns with plain dictionaries: no network, no model, no
latency (microseconds). It only ever claims an act for a *whole* short utterance, so
"بس بدي أسأل" ("but I want to ask") is never mistaken for "بس" ("enough").

Everything here is pure so it can be tested exhaustively.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import StrEnum


class Act(StrEnum):
    STOP = "stop"  # stop talking / enough
    WAIT = "wait"  # hold on: pause request while Rita speaks, hesitation when she is idle
    HESITATION = "hesitation"  # "أمم…", "يعني…": the learner is still thinking
    BACKCHANNEL = "backchannel"  # "آه", "تمام": listening noises and acknowledgements
    YES = "yes"
    NO = "no"
    DONT_KNOW = "dont_know"
    CORRECTION = "correction"  # "لا قصدي…", "مش هيك": the learner fixes what Rita understood
    CONTINUE = "continue"  # "كمّل"
    REPEAT = "repeat"  # "عيدي", "شو؟", "again"
    UNDERSTOOD = "understood"  # "فهمت", "got it"
    COMPLAINT = "complaint"  # a product/conversation failure reported by the learner
    SIMPLIFY = "simplify"  # explain the same idea more simply
    UNCLEAR = "unclear"  # an answer that does not fit the question just asked
    OTHER = "other"  # everything else: a real request or sentence


class Awaiting(StrEnum):
    NONE = "none"
    YES_NO = "yes_no"
    CHOICE = "choice"
    OPEN = "open"


# --------------------------------------------------------------------------- text


_COLLAPSE = re.compile(r"(.)\1+")
_NON_WORD = re.compile(r"[^\w\s]|_", re.UNICODE)
_SPACES = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Lower-case, strip marks and punctuation, unify Arabic letters, collapse repeats.

    The same function is applied to the dictionaries below, so a spelling only has to
    match after normalisation: "أمممم", "امم" and "أمّم" are all the same word, and so
    are "خلصصص" and "خلص".
    """

    value = unicodedata.normalize("NFKD", text or "")
    # Drops diacritics, tatweel-like marks and Arabic hamza/madda marks, so أ إ آ become ا.
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = value.replace("ـ", "")  # tatweel
    value = value.replace("ى", "ي").replace("ة", "ه").replace("ß", "ss")
    value = value.casefold()
    value = _NON_WORD.sub(" ", value)
    value = _COLLAPSE.sub(r"\1", value)
    return _SPACES.sub(" ", value).strip()


def tokens(text: str) -> list[str]:
    value = normalize(text)
    return value.split() if value else []


def _set(*words: str) -> frozenset[str]:
    return frozenset(normalize(word) for word in words if normalize(word))


def _phrases(*phrases: str) -> frozenset[str]:
    return frozenset(normalize(phrase) for phrase in phrases if normalize(phrase))


# ------------------------------------------------------------------- dictionaries
# Jordanian and standard Arabic first, then English and German. Reviewed by ear with
# native speakers; extend from the "short but unknown" log, never by guessing.

STOP_TOKENS = _set(
    "خلص", "خلاص", "كفاية", "بكفي", "يكفي", "كفى", "وقف", "وقفي", "اوقف", "اوقفي", "ستوب",
    "استوب", "بس", "اسكتي", "اسكت", "انسي", "انسى", "بلاش", "خلصنا",
    "stop", "enough", "halt", "stopp", "genug",
)
STOP_PHRASES = _phrases(
    "مش لازم تكمل", "مش لازم تكملي", "بكفي هيك", "كفاية هيك", "خلص هيك", "that's enough",
    "that is enough", "hör auf", "hor auf", "ok enough", "stop it", "مش محتاج", "مو محتاج",
)

# Words which may accompany a real stop command without turning it into a new request.
# This deliberately does not include request verbs such as "قولي" or question words.
STOP_COMPANIONS = _set("لا", "لاء", "لأ", "مش", "مو", "ما", "محتاج", "لازم", "بعد", "please")
REQUEST_OR_QUESTION = _set(
    "قولي", "احكي", "اشرحي", "اشرح", "كيف", "ليش", "شو", "ماذا", "why", "how", "what"
)

# "wait / one moment": a pause request while Rita speaks, plain hesitation when idle.
WAIT_TOKENS = _set(
    "استنى", "استني", "استنوا", "لحظة", "لحظه", "ثانية", "ثانيه", "wait", "moment", "warte",
    "momentchen", "hold",
)
WAIT_PHRASES = _phrases(
    "hold on", "one moment", "one second", "just a second", "wait a second", "just a moment",
    "خليني افكر", "شوي", "بس شوي", "لحظة وحدة", "ثانية وحدة",
)

HESITATION_TOKENS = _set(
    "امم", "اممم", "ام", "ايم", "يعني", "هم", "مم", "um", "uh", "er", "erm", "hmm", "hm",
    "ah", "ahm", "ahem",
)

BACKCHANNEL_TOKENS = _set(
    "اه", "اها", "ايه", "تمام", "طيب", "ماشي", "صح", "يب", "اوكي", "اوك", "اكيد", "حلو",
    "mhm", "mm", "mmhmm", "yeah", "yep", "ok", "okay", "right", "ja", "genau", "uh", "huh",
    "aha", "sure",
)
# Said alone these are acknowledgements while Rita talks; after a question they are answers.
AMBIGUOUS_YES = _set("ايه", "اه", "اها", "تمام", "طيب", "ماشي", "اوكي", "اوك", "yeah", "yep",
                     "ok", "okay", "ja", "sure", "right", "صح")
STRONG_YES = _set("ايوه", "ايوا", "نعم", "اجل", "اكيد", "طبعا", "yes", "definitely", "klar",
                  "certainly", "بالطبع")
YES_PHRASES = _phrases("ايوه اكيد", "اه اكيد", "اكيد ايوه", "yes please", "ja bitte", "of course")

NO_TOKENS = _set("لا", "لاء", "لأ", "نو", "نوب", "ناه", "ابدا", "no", "nope", "nah", "nein",
                 "nee", "never")
NO_PHRASES = _phrases("لا شكرا", "no thanks", "no thank you", "nein danke", "لا والله", "لا ابدا")

DONT_KNOW_PHRASES = _phrases(
    "مش عارف", "مش عارفه", "مش عارفين", "ما بعرف", "ما بعرفش", "مدري", "ما ادري", "ما عندي فكره",
    "لا اعرف", "مش متاكد", "مش متاكده", "مش فاكر", "مش فاكره", "مش متاكد بس",
    "i don't know", "i do not know", "no idea", "not sure", "dunno", "keine ahnung",
    "weiss nicht", "ich weiss nicht",
)

CORRECTION_STARTS = _phrases(
    "لا قصدي", "لا اقصد", "قصدي", "اقصد", "مش هيك", "لا مش هيك", "ما قصدت", "مش قصدي", "غلط قصدي", "i meant", "i mean",
    "no i meant", "ich meinte", "nein ich meinte", "not that", "no not that",
)

COMPLAINT_PHRASES = _phrases(
    "الصوت مقطع", "الصوت بقطع", "الصوت بطيء", "الرد بطيء", "ما عم ترد", "ما عم برد",
    "ما بترد", "بتخبصي", "بتخبص", "الرد مش منطقي", "الجواب مش منطقي", "مش فاهمتني",
    "انت مش فاهمه", "انتي مش فاهمه", "you are not making sense", "audio is choppy",
    "the sound is choppy", "you are not responding", "das audio stockt",
)

SIMPLIFY_PHRASES = _phrases(
    "اشرح ابسط", "اشرحي ابسط", "بطريقه ابسط", "بشكل ابسط", "ابسط", "بسطها", "بسطيها",
    "مش فاهم الشرح", "مو فاهم الشرح", "لشخص مبتدئ", "يعني لمبتدئ", "explain simply",
    "make it simpler", "simpler please", "einfacher erklaren", "einfacher erklären",
)

CONTINUE_TOKENS = _set("كمل", "كمل", "كملي", "اكمل", "اكملي", "تابع", "تابعي", "continue",
                       "weiter", "proceed")
CONTINUE_PHRASES = _phrases("go on", "go ahead", "keep going", "mach weiter", "كمل كمل")

REPEAT_TOKENS = _set("عيد", "عيدي", "اعد", "اعيدي", "repeat", "nochmal", "wiederholen", "شو",
                     "ايش", "هاه", "pardon", "wie", "was")
REPEAT_PHRASES = _phrases(
    "مره ثانيه", "مره تانيه", "كمان مره", "ما سمعت", "ما سمعتك", "شو قلت", "say that again",
    "say it again", "once more", "again please", "noch einmal", "what did you say",
    "ما فهمت شو قلتي", "مره اخرى",
)

UNDERSTOOD_PHRASES = _phrases(
    "فهمت", "فهمنا", "فهمت عليك", "تمام فهمت", "اه فهمت", "اها فهمت", "وضحت", "واضح", "got it",
    "i get it", "i understand", "understood", "verstanden", "ich verstehe", "alles klar",
)

# Words that may surround a short command without changing it ("طيب خلص يا ريتا").
SOFT_TOKENS = _set(
    "يا", "ريتا", "rita", "لو", "سمحت", "سمحتي", "من", "فضلك", "please", "bitte", "بقى", "بقا",
    "هلا", "هلق", "هسا", "الان", "now", "طيب", "اوكي", "ok", "okay", "تمام", "ماشي", "اه",
    "اها", "شكرا", "thanks", "thank", "you", "هيك", "بقول", "قلت", "i", "say", "said",
)

# A single word while Rita speaks that is still a real interruption (questions).
QUESTION_INTERRUPTS = _set("ليش", "لماذا", "why", "warum", "كيف", "how", "wieso")

# Negations turn "فهمت" into "I did not understand".
NEGATION_TOKENS = _set("ما", "مش", "لا", "not", "nicht", "kein", "keine", "don", "didn", "no", "nie")


# -------------------------------------------------------------------------- result


@dataclass(frozen=True)
class Reading:
    act: Act
    reason: str  # short, loggable explanation of the rule that fired

    def __str__(self) -> str:
        return f"{self.act.value}({self.reason})"


def _all_in(parts: list[str], allowed: frozenset[str]) -> bool:
    return bool(parts) and all(part in allowed for part in parts)


def _contains_phrase(joined: str, phrases: frozenset[str]) -> bool:
    padded = f" {joined} "
    return any(f" {phrase} " in padded for phrase in phrases)


MAX_SHORT_TOKENS = 6  # commands may include natural fillers/refusals; content still wins below


def classify(
    text: str,
    *,
    bot_speaking: bool = False,
    awaiting: Awaiting | str = Awaiting.NONE,
) -> Reading:
    """Read one learner turn. Only whole short utterances get an act; the rest is OTHER."""

    awaiting = Awaiting(awaiting)
    words = tokens(text)
    if not words:
        return Reading(Act.OTHER, "empty")
    joined = " ".join(words)
    long_utterance = len(words) > MAX_SHORT_TOKENS

    if len(words) <= 12 and _contains_phrase(joined, COMPLAINT_PHRASES):
        return Reading(Act.COMPLAINT, "complaint cue")
    if len(words) <= 12 and _contains_phrase(joined, SIMPLIFY_PHRASES):
        return Reading(Act.SIMPLIFY, "simplify cue")

    # Corrections and "I don't know" may be a little longer than the other commands.
    if len(words) <= 8:
        if _contains_phrase(joined, DONT_KNOW_PHRASES) and len(words) <= 5:
            return Reading(Act.DONT_KNOW, "dont-know phrase")
        if any(joined == cue or joined.startswith(cue + " ") for cue in CORRECTION_STARTS):
            return Reading(Act.CORRECTION, "correction cue")
        # "مش باي" / "not X" corrects a specific interpretation. Broader negative
        # sentences remain ordinary content, and known complaints/don't-know cues won above.
        if len(words) <= 4 and words[0] in _set("مش", "مو", "not"):
            return Reading(Act.CORRECTION, "short rejected interpretation")
    if long_utterance:
        return Reading(Act.OTHER, "long utterance")

    # A question containing "خلصنا؟" asks for status; it is not a stop command.
    has_question = (text or "").rstrip().endswith(("?", "؟")) or any(
        word in REQUEST_OR_QUESTION for word in words
    )
    negated_finished = joined.startswith(("ما خلصنا", "مش خلصنا", "مو خلصنا"))
    if _contains_phrase(joined, STOP_PHRASES) and len(words) <= 6 and not has_question:
        return Reading(Act.STOP, "stop phrase")
    negated = any(word in NEGATION_TOKENS for word in words)
    if _contains_phrase(joined, UNDERSTOOD_PHRASES) and len(words) <= 3 and not negated:
        return Reading(Act.UNDERSTOOD, "understood phrase")
    if _contains_phrase(joined, WAIT_PHRASES) and len(words) <= 3:
        return Reading(Act.WAIT, "wait phrase")
    if _contains_phrase(joined, REPEAT_PHRASES) and len(words) <= 4:
        return Reading(Act.REPEAT, "repeat phrase")
    if _contains_phrase(joined, CONTINUE_PHRASES) and len(words) <= 3:
        return Reading(Act.CONTINUE, "continue phrase")
    if joined in NO_PHRASES:
        return Reading(Act.NO, "no phrase")
    if joined in YES_PHRASES:
        return Reading(Act.YES, "yes phrase")

    # Strip words that may surround a command, and hesitation sounds.
    core = [word for word in words if word not in SOFT_TOKENS]
    had_hesitation = any(word in HESITATION_TOKENS for word in words)
    core_no_hesitation = [word for word in core if word not in HESITATION_TOKENS]

    if not core_no_hesitation:
        # "أمم…", "يعني…" on their own, or only polite/acknowledging words.
        if had_hesitation and not _all_in(words, BACKCHANNEL_TOKENS - HESITATION_TOKENS):
            return Reading(Act.HESITATION, "hesitation sound")
        return _backchannel_or_answer(words, bot_speaking, awaiting)

    if _all_in(core_no_hesitation, STOP_TOKENS):
        if not has_question and not negated_finished:
            return Reading(Act.STOP, "stop word")
    # "لا خلص" / "no, stop": a refusal plus a stop word is a stop.
    if not has_question and not negated_finished and _all_in(
        core_no_hesitation, STOP_TOKENS | NO_TOKENS | WAIT_TOKENS | STOP_COMPANIONS
    ) and any(
        word in STOP_TOKENS for word in core_no_hesitation
    ):
        return Reading(Act.STOP, "stop word with refusal")
    if _all_in(core_no_hesitation, WAIT_TOKENS):
        return Reading(Act.WAIT, "wait word")
    if _all_in(core_no_hesitation, REPEAT_TOKENS):
        return Reading(Act.REPEAT, "repeat word")
    if _all_in(core_no_hesitation, CONTINUE_TOKENS):
        return Reading(Act.CONTINUE, "continue word")
    if _all_in(core_no_hesitation, NO_TOKENS):
        return Reading(Act.NO, "no word")
    if _all_in(core_no_hesitation, STRONG_YES):
        return Reading(Act.YES, "strong yes")
    if _all_in(core_no_hesitation, AMBIGUOUS_YES | BACKCHANNEL_TOKENS):
        return _backchannel_or_answer(core_no_hesitation, bot_speaking, awaiting)
    return Reading(Act.OTHER, "no rule")


def _backchannel_or_answer(
    words: list[str], bot_speaking: bool, awaiting: Awaiting
) -> Reading:
    """A bare "إيه/آه/تمام": an answer after a question, otherwise just listening noise."""

    if bot_speaking:
        return Reading(Act.BACKCHANNEL, "acknowledgement while Rita speaks")
    ambiguous = _all_in(words, AMBIGUOUS_YES | BACKCHANNEL_TOKENS)
    if awaiting in (Awaiting.YES_NO, Awaiting.CHOICE) and ambiguous:
        return Reading(Act.YES, f"bare yes after {awaiting.value}")
    if awaiting == Awaiting.OPEN and ambiguous:
        return Reading(Act.UNCLEAR, "bare yes after an open question")
    return Reading(Act.BACKCHANNEL, "acknowledgement")


# -------------------------------------------------- interruption decisions (Rita talks)

_INTERRUPTING = frozenset(
    {Act.STOP, Act.WAIT, Act.CORRECTION, Act.REPEAT, Act.NO, Act.UNDERSTOOD}
)


# Words that cannot be the start of a longer ordinary word, so an interim (not yet final)
# transcript of them may already stop Rita. "خلص" and "بس" start "خلصت" and "بس بدي…",
# so they wait for the final transcript unless said twice.
INTERIM_SAFE_STOP = _set("وقف", "وقفي", "اوقف", "اوقفي", "ستوب", "استوب", "stop", "كفايه", "stopp",
                         "halt", "enough", "genug", "بكفي")


def interrupts_speaking_bot(text: str, *, final: bool = True) -> tuple[bool, Reading]:
    """Should this transcript stop Rita while she is talking?

    Stop/wait/correction/repeat/no/"understood" interrupt (a single word is enough).
    Listening noises, hesitation, "yes", "continue" and "I don't know" do not. Any other
    utterance interrupts when it has two or more words (a real sentence) or is a question
    word such as "ليش"; one unknown word is ignored. `final=False` is a partial transcript:
    an ambiguous stop word then waits for the final one.
    """

    reading = classify(text, bot_speaking=True)
    words = tokens(text)
    if reading.act in _INTERRUPTING:
        if (
            not final
            and reading.act == Act.STOP
            and len(words) < 2
            and not all(word in INTERIM_SAFE_STOP for word in words)
        ):
            return False, Reading(Act.STOP, "ambiguous stop word, waiting for the final transcript")
        return True, reading
    if reading.act != Act.OTHER:
        return False, reading
    if len(words) >= 2:
        return True, Reading(Act.OTHER, "two or more words")
    if words and words[0] in QUESTION_INTERRUPTS:
        return True, Reading(Act.OTHER, "question word")
    return False, Reading(Act.OTHER, "one unknown word")


# ------------------------------------------------------------ Rita's own last question

_CHOICE_SPLIT = re.compile(r"\s*(?:[،,]|\bولا\b|\bأو\b|\bاو\b|\bor\b|\boder\b)\s*", re.IGNORECASE)
_WH_WORDS = _set(
    "شو", "ايش", "ليش", "كيف", "متى", "وين", "مين", "كم", "اي", "لماذا", "ماذا", "what", "why",
    "how", "when", "where", "who", "which", "was", "wie", "wo", "wann", "warum", "wer", "welche",
    "welcher", "welches",
)


@dataclass(frozen=True)
class Question:
    text: str
    awaiting: Awaiting
    options: tuple[str, ...] = ()


def parse_last_question(assistant_text: str) -> Question:
    """What did Rita last ask, and what kind of answer does it expect?

    CHOICE when the question lists two or more options ("نكمل ولا نغيّر الموضوع؟",
    "الأحداث، الشخصيات، ولا الأفكار؟"), OPEN for what/why/how questions, YES_NO for other
    questions, NONE when she did not ask anything.
    """

    spans = _question_spans(assistant_text or "")
    spans = [span for span in spans if span]
    if not spans:
        return Question("", Awaiting.NONE)
    question = spans[-1]
    body = question.rstrip("?؟").strip()
    structural_body = _without_quoted_text(body)
    # "حابب نكمل؟ أو في شي تاني؟": a second question that starts with "or" is one choice.
    if len(spans) >= 2 and re.match(r"^(?:ولا|أو|او|or|oder)\b", body, re.IGNORECASE):
        previous = spans[-2].rstrip("?؟").strip()
        rest = re.sub(r"^(?:ولا|أو|او|or|oder)\s+", "", body, flags=re.IGNORECASE)
        options = tuple(_clean_option(x)[:80] for x in (previous, rest) if _clean_option(x))
        if len(options) == 2:
            return Question(f"{previous}؟ {body}؟"[:200], Awaiting.CHOICE, options)

    parts = [part.strip() for part in _CHOICE_SPLIT.split(structural_body) if part.strip()]
    first_word = tokens(body)[:1]
    asks_what = bool(first_word) and first_word[0] in _WH_WORDS
    if asks_what and len(parts) >= 3:
        parts = parts[1:]  # "شو بتحب أكتر، القهوة ولا الشاي؟": the first part is the question
    elif asks_what and not _OR_WORD.search(body):
        parts = []  # "شو بتحب تاكل، بيتزا؟" is an open question, not a list of options
    # A list of options is short phrases; the first part may carry the question verb.
    if len(parts) >= 2 and all(len(part.split()) <= 6 for part in parts):
        options = tuple(_clean_option(part) for part in parts if _clean_option(part))
        if len(options) >= 2:
            return Question(question[:160], Awaiting.CHOICE, options[:4])
    first = tokens(body)[:1]
    if first and first[0] in _WH_WORDS:
        return Question(question[:160], Awaiting.OPEN)
    return Question(question[:160], Awaiting.YES_NO)


_QUOTE_PAIRS = {'"': '"', "“": "”", "‘": "’", "«": "»"}


def _question_spans(text: str) -> list[str]:
    """Split questions while ignoring question marks inside quoted examples."""

    spans: list[str] = []
    start = 0
    closing: str | None = None
    for index, char in enumerate(text):
        if closing is not None:
            if char == closing:
                closing = None
            continue
        if char in _QUOTE_PAIRS:
            closing = _QUOTE_PAIRS[char]
            continue
        if char in "?؟":
            span = text[start : index + 1].strip()
            if span:
                spans.append(span)
            start = index + 1
        elif char in ".!\n":
            start = index + 1
    return spans


def _without_quoted_text(text: str) -> str:
    """Remove quoted teaching examples before looking for choice separators."""

    output: list[str] = []
    closing: str | None = None
    for char in text:
        if closing is not None:
            if char == closing:
                closing = None
            continue
        if char in _QUOTE_PAIRS:
            closing = _QUOTE_PAIRS[char]
            output.append(" ")
        else:
            output.append(char)
    return "".join(output)


_OPTION_LEADS = re.compile(
    r"^(?:هل\s+)?(?:بدك|بتحب|بتفضل|حابب|تحب|تفضل|do you want to|would you like to|do you prefer)\s+",
    re.I,
)
_OR_WORD = re.compile(r"(?:\bولا\b|\bأو\b|\bاو\b|\bor\b|\boder\b)", re.IGNORECASE)


_OPTION_FILLERS = re.compile(r"^(?:(?:أها|اها|آه|اه|طيب|يعني|ممتاز|تمام|حلو|okay|ok|so|well)[\s،,]+)+", re.I)


def _clean_option(part: str) -> str:
    part = _OPTION_FILLERS.sub("", part.strip())
    part = _OPTION_LEADS.sub("", part).strip(" ،,")
    return " ".join(part.split()[:6])


def clarify_choice(question: Question, language: str) -> str:
    """The one short question Rita asks after a bare "yes" to a choice."""

    options = list(question.options[:3])
    if language == "ar" or any("؀" <= ch <= "ۿ" for ch in "".join(options)):
        joined = " ولا ".join(options)
        return f"أي واحد: {joined}؟"
    if language == "de":
        return f"Welches: {' oder '.join(options)}?"
    return f"Which one: {' or '.join(options)}?"
