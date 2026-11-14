"""Ask the real model what a learner asks on the lesson page, and check what Uzyra writes.

The lesson page has the guide on the right and Uzyra on the left (voice and text). This probe builds
exactly the system prompt the worker builds there (`bot.build_prompt` with the study block), sends
the same user line the worker adds for a request from the circle ("[اشرحلي] «…»") or a spoken
question, with the same model and settings, and checks the reply with plain rules. Nothing is
graded by a model, so a run costs only the replies and the rules are the same every time.

    GROQ_API_KEY=... python rita_lesson_probe.py           # from voice-agent/
    GROQ_API_KEY=... python rita_lesson_probe.py --runs 3  # each case three times (replies vary)

The reply is split at [[SHEET]]: the spoken part (what Uzyra says) and the sheet (shown under it).
Rules are checked on each part separately, like the learner meets them. The exit code is the number
of failed runs.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
import uuid
from dataclasses import dataclass, field

MARKER = "[[SHEET]]"
LETTERS = re.compile(r"[A-Za-zÄÖÜäöüß؀-ۿ]")
LATIN = re.compile(r"[A-Za-zÄÖÜäöüß]")
ARABIC = re.compile(r"[؀-ۿ]")
SENTENCE_END = re.compile(r"[.!?؟]+(?:\s|$)")

# Not Jordanian: Egyptian, Lebanese/Syrian-only, Gulf/Iraqi, or formal question words.
NOT_JORDANIAN = (
    r"(?:^|\s)(?:إزاي|ازاي|عايز|عايزة|دلوقتي|كده|مش كده|ليه)(?:\s|[.،؟!]|$)"
    r"|(?:^|\s)(?:هيدا|هيدي|هلق|شلون|شنو|وايد|زين|فيك)(?:\s|[.،؟!]|$)"
)
# Commands and words aimed at the learner that show a gender, masculine as much as feminine.
GENDERED_TO_LEARNER = (
    r"(?:^|\s)(?:خدي|خذي|خد|اسمعي|ركّزي|ركزي|جربي|جرّبي|جرّب|جرب|قولي|احكيلي|جاهزة|شاطرة|فاهمة|شوف|شوفي"
    r"|لا تنسى|لا تنسي|لا تخلط|لا تقول|احرص|تذكّر|تذكر|انتبه|انتبهي|حط|إنتِ|إنتَ|انتِ)(?:\s|[.،؟!:]|$)"
)
# In the sheet only commands count: an adjective there usually describes a word ("الجملة جاهزة").
SHEET_COMMANDS = (
    r"(?:^|\s)(?:خدي|خذي|خد|شوف|شوفي|جربي|جرّبي|جرّب|جرب|لا تنسى|لا تنسي|لا تخلط|لا تقول|احرص|تذكّر|تذكر"
    r"|انتبه|انتبهي|حط|إنتِ|إنتَ|انتِ)(?:\s|[.،؟!:]|$)"
)
POINTS_BELOW = r"تحت|below"
CLAIMS_SAVED = r"(?i)(?:حفظت(?:ها|لك|لك)?|انحفظت|ضفتها|أضفتها|سجلتها|saved it|i(?:'ve| have) saved|added it to)"
GRAMMAR_TERMS = r"(?i)\b(?:partizip|präteritum|dativ|akkusativ|auxiliary|participle)\b|فعل مساعد|اسم مفعول|تصريف"
QUIZ_OR_FOLLOW_UP = r"[?؟]"


@dataclass(frozen=True)
class Case:
    id: str
    what: str
    # A request from the circle (action + quote + context) or, without action, a spoken question.
    text: str = ""
    action: str = ""
    quote: str = ""
    context: str = ""
    site_language: str = "ar"  # what "Uzyra explains in" is set to: automatic | ar | en
    state: str = "reading"
    # Rules on the spoken part
    spoken_max_sentences: int | None = 2
    spoken_language: str | None = None  # "arabic" | "latin"
    spoken_forbid: tuple[str, ...] = ()
    spoken_require: tuple[str, ...] = ()
    # Rules on the sheet
    sheet: str = "any"  # "none" | "required" | "any"
    sheet_max_points: int | None = None
    sheet_max_examples: int | None = None
    sheet_max_rows: int | None = None
    sheet_min_points: int | None = None
    sheet_max_lines: int | None = None
    sheet_no_table: bool = False
    sheet_require: tuple[str, ...] = ()
    # Rules on the whole reply
    forbid: tuple[str, ...] = ()
    require: tuple[str, ...] = ()
    notes: str = field(default="", compare=False)


GUIDE_TITLE = "Das Perfekt: über die Vergangenheit sprechen"
GUIDE_SECTIONS = [
    {"id": "s1", "heading": "Wann benutzt man das Perfekt?", "terms": ["Perfekt", "gestern"]},
    {"id": "s2", "heading": "haben oder sein", "terms": ["haben", "sein", "Bewegung"]},
    {"id": "s3", "heading": "Das Partizip II", "terms": ["ge-", "-t", "-en"]},
    {"id": "s4", "heading": "Die Satzklammer", "terms": ["Position 2", "Ende"]},
]
GUIDE_GOALS = [
    "Über gestern und letzte Woche mit dem Perfekt sprechen",
    "haben oder sein richtig wählen",
    "das Partizip II von regelmäßigen Verben bilden",
]
CTX_PERFEKT = (
    "Das Perfekt benutzt man, wenn man über die Vergangenheit spricht, besonders im Gespräch. "
    "Es hat zwei Teile: haben oder sein an Position 2 und das Partizip II am Ende des Satzes. "
    "Beispiel: Ich habe gestern Fußball gespielt. Wir haben am Wochenende Pizza gegessen."
)
CTX_SEIN = (
    "Die meisten Verben bilden das Perfekt mit haben. Verben der Bewegung von einem Ort zu einem "
    "anderen (gehen, fahren, fliegen, kommen) und Verben der Veränderung (aufstehen, einschlafen) "
    "benutzen sein. Beispiel: Wir sind nach Berlin gefahren. Ich bin um 7 Uhr aufgestanden."
)
CTX_PARTIZIP = (
    "Regelmäßige Verben: ge- + Stamm + -t. spielen → gespielt, machen → gemacht, kaufen → gekauft. "
    "Viele unregelmäßige Verben enden auf -en: essen → gegessen, fahren → gefahren."
)


def circle(cid: str, what: str, action: str, quote: str, context: str, **rules) -> Case:
    return Case(cid, what, action=action, quote=quote, context=context, **rules)


CASES: tuple[Case, ...] = (
    circle(
        "explain-ar",
        "Explain a guide sentence in Arabic: one short spoken sentence, a tiny sheet, no quiz.",
        "explain",
        "Ich habe gestern Fußball gespielt.",
        CTX_PERFEKT,
        spoken_language="arabic",
        spoken_forbid=(QUIZ_OR_FOLLOW_UP, NOT_JORDANIAN, GENDERED_TO_LEARNER),
        sheet_max_points=2,
        sheet_max_examples=2,
        forbid=(r"(?i)\b(?:präteritum|plusquamperfekt)\b",),
    ),
    circle(
        "explain-en",
        "The same request when the site says English: the explanation is English.",
        "explain",
        "Ich habe gestern Fußball gespielt.",
        CTX_PERFEKT,
        site_language="en",
        spoken_language="latin",
        spoken_forbid=(QUIZ_OR_FOLLOW_UP,),
        sheet_max_points=2,
        sheet_max_examples=2,
    ),
    circle(
        "simplify-ar",
        "Simplify: the simplest words, then one solved example in two or three steps.",
        "simplify",
        "Verben der Bewegung benutzen sein.",
        CTX_SEIN,
        spoken_language="arabic",
        spoken_forbid=(QUIZ_OR_FOLLOW_UP, NOT_JORDANIAN),
        sheet="required",
        sheet_min_points=1,
        sheet_max_points=4,
        sheet_require=(r"(?i)\bsind\b|\bbin\b|\bist\b",),
    ),
    circle(
        "why-form-sein",
        "Why 'sind ... gefahren': movement takes sein; one sentence, no sheet, no guessing.",
        "why_form",
        "sind",
        "Wir sind nach Berlin gefahren. " + CTX_SEIN,
        spoken_language="arabic",
        spoken_max_sentences=2,
        spoken_forbid=(QUIZ_OR_FOLLOW_UP,),
        sheet="none",
        require=(r"حرك|انتقال|بنتقل|بننتقل|مكان|Bewegung|fahren",),
    ),
    circle(
        "common-mistake",
        "One preventive mistake: a sheet with Wrong / Correct / Why, nothing more.",
        "common_mistake",
        "Wir sind nach Berlin gefahren.",
        CTX_SEIN,
        spoken_language="arabic",
        spoken_forbid=(QUIZ_OR_FOLLOW_UP,),
        sheet="required",
        sheet_require=(r"الغلط|Wrong", r"الصح|Correct", r"السبب|Why"),
        forbid=(r"(?i)wir haben nach berlin gefahren[^.\n]{0,30}(?:صح|correct|richtig)",),
    ),
    circle(
        "word-by-word",
        "Word by word: a table of at most 8 parts, verb group kept together, no quiz.",
        "word_by_word",
        "Ich habe gestern Fußball gespielt.",
        CTX_PERFEKT,
        spoken_language="arabic",
        spoken_forbid=(QUIZ_OR_FOLLOW_UP,),
        sheet="required",
        sheet_max_rows=9,
    ),
    circle(
        "compare-arabic",
        "Compare with Arabic: one sentence, then a small Arabic | German table.",
        "compare_arabic",
        "Ich habe gestern Fußball gespielt.",
        CTX_PERFEKT,
        spoken_language="arabic",
        spoken_forbid=(QUIZ_OR_FOLLOW_UP,),
        sheet="required",
        sheet_max_rows=7,
    ),
    circle(
        "summarize",
        "Summarize the section: one sentence, then 3 to 5 short points.",
        "summarize_section",
        "Das Partizip II",
        CTX_PARTIZIP,
        spoken_language="arabic",
        spoken_forbid=(QUIZ_OR_FOLLOW_UP,),
        sheet="required",
        sheet_min_points=2,
        sheet_max_points=6,
    ),
    Case(
        "voice-question-on-lesson",
        "A spoken question about the lesson: a short answer, no second lesson.",
        text="ليش بنقول ich habe gespielt مش ich bin gespielt؟",
        spoken_language="arabic",
        spoken_max_sentences=3,
        spoken_forbid=(NOT_JORDANIAN, GENDERED_TO_LEARNER),
        require=(r"(?i)haben|habe|حركة|بنتقل|مكان",),
    ),
    Case(
        "voice-off-topic",
        "Off topic during the lesson: answer in one sentence and come back to the lesson.",
        text="شو أحسن مطعم منسف بعمان؟",
        spoken_language="arabic",
        spoken_max_sentences=3,
        sheet="none",
        spoken_forbid=(NOT_JORDANIAN,),
        spoken_require=(r"درس|نرجع|نكمل",),
        forbid=(r"مطعم\s*[\"«“]|[\"«“][^\"»”]{2,30}[\"»”]\s*(?:و|،)",),
    ),
    Case(
        "voice-save-word",
        "Asked to save a word: never claim it was saved (only the website can confirm).",
        text="احفظلي كلمة gefahren بالبطاقات",
        spoken_language="arabic",
        spoken_max_sentences=3,
        sheet="none",
        forbid=(CLAIMS_SAVED, NOT_JORDANIAN),
        require=(r"بطاقات|الدائرة",),
    ),
    Case(
        "voice-did-not-understand",
        "'I did not understand': a new way, one concrete example, no grammar terms.",
        text="ما فهمت ولا اشي من هاد الدرس",
        spoken_language="arabic",
        spoken_max_sentences=3,
        spoken_forbid=(GRAMMAR_TERMS, NOT_JORDANIAN, GENDERED_TO_LEARNER),
        sheet="none",
        forbid=(GRAMMAR_TERMS,),
    ),
    Case(
        "voice-not-in-guide",
        "A rule the guide does not cover: say so briefly, never invent a rule.",
        text="طيب وكيف بعمل Plusquamperfekt؟",
        spoken_language="arabic",
        spoken_max_sentences=3,
        sheet="none",
        require=(r"درس",),
        forbid=(r"(?i)hatte\s+\w+\s+(?:gespielt|gemacht)[^\n]{0,20}(?:دائماً|always)",),
    ),
    Case(
        "voice-thanks",
        "A short thanks: one brief acknowledgement, no new lesson, no sheet.",
        text="تمام شكراً",
        spoken_language="arabic",
        spoken_max_sentences=2,
        sheet="none",
        spoken_forbid=(GRAMMAR_TERMS,),
    ),
)


def split_reply(reply: str) -> tuple[str, str]:
    if MARKER in reply:
        spoken, sheet = reply.split(MARKER, 1)
        return spoken.strip(), sheet.strip()
    return reply.strip(), ""


def language_share(text: str, script: re.Pattern[str]) -> float:
    letters = LETTERS.findall(text)
    return len(script.findall(text)) / len(letters) if letters else 0.0


def count_sentences(text: str) -> int:
    return len([part for part in SENTENCE_END.split(text.strip()) if part.strip()]) or (1 if text.strip() else 0)


def sheet_lines(sheet: str, prefix: str) -> list[str]:
    return [line for line in sheet.splitlines() if line.strip().startswith(prefix)]


def table_rows(sheet: str) -> int:
    rows = [line for line in sheet.splitlines() if line.strip().startswith("|")]
    # The header row and the |---| line are not content rows.
    return max(0, len([row for row in rows if not re.fullmatch(r"\|[\s:|-]+\|?", row.strip())]) - 1)


def check_reply(case: Case, reply: str) -> list[str]:
    """What is wrong with `reply` for this case (an empty list means it passes)."""

    problems: list[str] = []
    if not reply.strip():
        return ["empty reply"]
    spoken, sheet = split_reply(reply)
    if not spoken:
        problems.append("nothing to say before the sheet")
    if case.spoken_max_sentences is not None and count_sentences(spoken) > case.spoken_max_sentences:
        problems.append(f"spoken: {count_sentences(spoken)} sentences (at most {case.spoken_max_sentences})")
    if case.spoken_language == "latin" and language_share(spoken, LATIN) < 0.7:
        problems.append("spoken: not mostly English/German letters")
    if case.spoken_language == "arabic" and language_share(spoken, ARABIC) < 0.4:
        problems.append("spoken: not mostly Arabic")
    # Bold marks are removed before speaking (rita_dialect.SpeechTextFilter); lists and tables are not.
    if re.search(r"(?m)^\s*(?:\d+[.)]|[-•#|])", spoken):
        problems.append("spoken: list, heading or table (it is read aloud)")
    for pattern in case.spoken_forbid:
        found = re.search(pattern, spoken)
        if found:
            problems.append(f"spoken has {found.group(0).strip()[:50]!r}")
    for pattern in case.spoken_require:
        if not re.search(pattern, spoken):
            problems.append(f"spoken misses {pattern}")
    if not sheet and re.search(POINTS_BELOW, spoken):
        problems.append("points below, but there is no sheet")
    if case.spoken_language == "arabic":
        found = re.search(GENDERED_TO_LEARNER, spoken)
        if found and GENDERED_TO_LEARNER not in case.spoken_forbid:
            problems.append(f"spoken speaks to a gender: {found.group(0).strip()!r}")
    if case.sheet == "none" and sheet:
        problems.append("a sheet where none belongs")
    if case.sheet == "required" and not sheet:
        problems.append("no sheet")
    if sheet:
        points = len(sheet_lines(sheet, "- "))
        examples = len(sheet_lines(sheet, "= "))
        if case.sheet_max_points is not None and points > case.sheet_max_points:
            problems.append(f"sheet: {points} points (at most {case.sheet_max_points})")
        items = points + examples + table_rows(sheet)
        if case.sheet_min_points is not None and items < case.sheet_min_points:
            problems.append(f"sheet: {items} points/rows/examples (at least {case.sheet_min_points})")
        content = [line for line in sheet.splitlines() if line.strip() and not line.strip().startswith("#")]
        if case.sheet_max_lines is not None and len(content) > case.sheet_max_lines:
            problems.append(f"sheet: {len(content)} lines (at most {case.sheet_max_lines})")
        if case.sheet_no_table and table_rows(sheet) > 0:
            problems.append("sheet: a table where none belongs")
        if case.spoken_language == "arabic":
            found = re.search(SHEET_COMMANDS, sheet)
            if found:
                problems.append(f"sheet speaks to a gender: {found.group(0).strip()!r}")
        if case.sheet_max_examples is not None and examples > case.sheet_max_examples:
            problems.append(f"sheet: {examples} examples (at most {case.sheet_max_examples})")
        if case.sheet_max_rows is not None and table_rows(sheet) > case.sheet_max_rows:
            problems.append(f"sheet: {table_rows(sheet)} table rows (at most {case.sheet_max_rows})")
        if len([line for line in sheet.splitlines() if line.strip()]) > 14:
            problems.append("sheet: longer than 14 lines")
        for pattern in case.sheet_require:
            if not re.search(pattern, sheet):
                problems.append(f"sheet misses {pattern}")
    for pattern in case.forbid:
        found = re.search(pattern, reply)
        if found:
            problems.append(f"has {found.group(0).strip()[:50]!r}")
    for pattern in case.require:
        if not re.search(pattern, reply):
            problems.append(f"misses {pattern}")
    return problems


def case_messages(case: Case):
    """The system prompt, the conversation and the reply budget the worker would use."""

    import bot
    from rita_state import RitaSessionState
    from rita_study_voice import StudyVoice

    body = {
        "language": case.site_language,
        "dialect": "ar-JO",
        "mode": "study",
        "targetLanguage": {"code": "de", "name": "German", "speechCode": "de"},
        "study": {
            "lessonId": "00000000-0000-4000-8000-000000000001",
            "title": GUIDE_TITLE,
            "sections": GUIDE_SECTIONS,
            "objectives": GUIDE_GOALS,
        },
    }
    voice = StudyVoice.from_body(body)
    voice.set_state({"state": case.state})
    state = RitaSessionState(active_language=case.site_language, active_dialect="ar-JO")
    if case.action:
        request = voice.take_action(
            {"request_id": str(uuid.uuid4()), "action": case.action, "quote": case.quote, "context": case.context}
        )
        assert request is not None, case.id
        user = voice.user_line()
    else:
        state.observe_user_turn(case.text)
        user = case.text
    prompt = bot.build_prompt(body, state, dialogue=True, study_voice=voice)
    return prompt, [{"role": "user", "content": user}], bot.explain_options(state), bot


async def ask(client, case: Case) -> str:
    prompt, messages, options, bot = case_messages(case)
    params = {
        "model": bot.LLM_MODEL,
        "temperature": 0.45,
        "top_p": 0.9,
        "max_completion_tokens": bot.LLM_MAX_COMPLETION_TOKENS,
        "reasoning_effort": "low",
        "messages": [{"role": "system", "content": prompt}, *messages],
    }
    if options:
        params.update(options)
    response = await client.chat.completions.create(**params)
    return (response.choices[0].message.content or "").strip()


async def run_probe(runs: int = 1, only: str = "") -> dict[str, object]:
    key = os.getenv("GROQ_API_KEY", "").strip()
    cases = [case for case in CASES if not only or only in case.id]
    if not key:
        return {"outcome": "secret_missing", "passed": 0, "failed": len(cases) * runs, "cases": []}
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
    results: list[dict[str, object]] = []
    for case in cases:
        for run in range(runs):
            try:
                reply = await ask(client, case)
            except Exception as error:  # a network or quota problem fails the run
                results.append({"id": case.id, "run": run + 1, "passed": False,
                                "problems": [f"request error: {type(error).__name__}: {str(error)[:120]}"], "reply": ""})
                continue
            problems = check_reply(case, reply)
            results.append({"id": case.id, "run": run + 1, "passed": not problems, "problems": problems, "reply": reply})
    failed = sum(not bool(r["passed"]) for r in results)
    return {"outcome": "ok" if not failed else "failed", "passed": len(results) - failed, "failed": failed,
            "total": len(results), "cases": results}


def print_result(result: dict[str, object], show_all: bool = False) -> int:
    if result.get("outcome") == "secret_missing":
        print("GROQ_API_KEY is not set", file=sys.stderr)
        return int(result.get("failed", 1))
    for item in result.get("cases", []):
        mark = "PASS" if item.get("passed") else "FAIL"
        print(f"{mark} {item.get('id')} #{item.get('run')}")
        for problem in item.get("problems", []):
            print(f"     - {problem}")
        if show_all or not item.get("passed"):
            print("     reply: " + str(item.get("reply", "")).replace("\n", "\n            "))
    print(f"\n{result.get('passed', 0)} of {result.get('total', 0)} runs passed")
    return int(result.get("failed", 1))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--only", default="")
    parser.add_argument("--all", action="store_true", help="print passing replies too")
    args = parser.parse_args()
    return print_result(asyncio.run(run_probe(args.runs, args.only)), args.all)


if __name__ == "__main__":
    sys.exit(min(main(), 125))
