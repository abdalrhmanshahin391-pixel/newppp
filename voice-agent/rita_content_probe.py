"""Ask the real model a fixed set of questions and check what it says, not how fast.

The timing and language rules are tested offline; what the model *writes* (a wrong German rule, a
numbered list, the wrong language, a forced follow-up question) can only be seen by asking it. Run
this after any change to the prompt or the turn state:

    GROQ_API_KEY=... python rita_content_probe.py            # from voice-agent/

It builds the same system prompt the worker would send for each case and uses the same model and
reply budget. Replies are checked with plain rules (see `check_reply`); nothing is graded by a model.
The exit code is the number of failed cases, so it can also run as a manual GitHub workflow.
"""

from __future__ import annotations

import asyncio
import os
import re
import sys
from dataclasses import dataclass, field

LETTERS = re.compile(r"[A-Za-zÄÖÜäöüß؀-ۿ]")
LATIN = re.compile(r"[A-Za-zÄÖÜäöüß]")
ARABIC = re.compile(r"[؀-ۿ]")
SENTENCE_END = re.compile(r"[.!?؟]+(?:\s|$)")


@dataclass(frozen=True)
class Case:
    id: str
    text: str
    site_language: str = "automatic"  # what "Rita explains in" is set to: automatic | ar | en
    forbid: tuple[str, ...] = ()
    require: tuple[str, ...] = ()
    max_sentences: int | None = None
    language: str | None = None  # "latin" or "arabic": the language most of the reply is written in
    notes: str = field(default="", compare=False)


GRAMMAR_TERMS = r"(?i)\b(?:dativ|akkusativ|nominativ|genitiv|dative|accusative|nominative)\b|داتيف|أكوزاتيف|اكوزاتيف"
NUMBERED_OR_BULLET = r"(?m)^\s*(?:\d+[.)]|[-*•])\s"
FORCED_FOLLOW_UP = r"بدك أكمل|بدنا نكمل|بدك نكمل"

CASES: tuple[Case, ...] = (
    Case(
        "dative-rule-en",
        "What is the dative case, and when do I use it?",
        site_language="en",
        forbid=(
            r"(?i)\balways\b[^.]{0,40}\bdative\b",
            r"(?i)\b(?:every|all) prepositions?\b[^.]{0,40}\bdative\b",
        ),
        language="latin",
        notes="Not every preposition takes the dative.",
    ),
    Case(
        "dative-rule-ar",
        "اشرحلي الداتيف بعد حروف الجر",
        site_language="ar",
        forbid=(r"دائم[اًا]?[^.]{0,40}(?:داتيف|Dativ)", r"كل حروف الجر[^.]{0,40}(?:داتيف|Dativ)"),
        language="arabic",
    ),
    Case(
        "hoffen-vs-helfen",
        "Is it 'ich hoffe dir' or 'ich helfe dir'? Why?",
        site_language="en",
        forbid=(r"(?i)hoffen[^.]{0,50}\bdative\b", r"(?i)hoffe[^.]{0,50}\bdative\b"),
        require=(r"(?i)\bauf\b",),
        notes="helfen takes the dative; hoffen takes auf + accusative.",
    ),
    Case(
        "how-to-say-english-reply",
        "How do I say I want to order pizza in German?",
        site_language="en",
        require=(r"(?i)pizza",),
        language="latin",
        notes="The explanation is English because the site says so; only the phrase is German.",
    ),
    Case(
        "how-to-say-arabic-reply",
        "كيف بقول بدي أطلب بيتزا بالألماني؟",
        site_language="ar",
        require=(r"(?i)pizza",),
        language="arabic",
    ),
    Case(
        "i-did-not-understand",
        "ما فهمت ولا كلمة",
        site_language="ar",
        forbid=(GRAMMAR_TERMS, FORCED_FOLLOW_UP),
        max_sentences=5,
        notes="A new way, one concrete example, no grammar terms.",
    ),
    Case(
        "complaint",
        "You don't understand what I say.",
        site_language="en",
        forbid=(GRAMMAR_TERMS,),
        max_sentences=3,
        language="latin",
        notes="Acknowledge it; do not teach or defend.",
    ),
    Case(
        "no-list-in-speech",
        "Give me five German verbs for the kitchen.",
        site_language="en",
        forbid=(NUMBERED_OR_BULLET, r"\*\*"),
        language="latin",
    ),
    Case(
        "no-forced-follow-up",
        "شو عاصمة ألمانيا؟",
        site_language="ar",
        forbid=(FORCED_FOLLOW_UP,),
        max_sentences=3,
        language="arabic",
    ),
    Case(
        "no-gendered-command",
        "احكيلي عن يومك",
        site_language="ar",
        forbid=(r"خبريني|خبرني",),
        language="arabic",
    ),
)


def language_share(text: str, script: re.Pattern[str]) -> float:
    letters = LETTERS.findall(text)
    return len(script.findall(text)) / len(letters) if letters else 0.0


def count_sentences(text: str) -> int:
    return len([part for part in SENTENCE_END.split(text.strip()) if part.strip()]) or (1 if text.strip() else 0)


def check_reply(case: Case, reply: str) -> list[str]:
    """What is wrong with `reply` for this case (an empty list means it passes)."""

    problems: list[str] = []
    if not reply.strip():
        return ["empty reply"]
    for pattern in case.forbid:
        found = re.search(pattern, reply)
        if found:
            problems.append(f"forbidden: {found.group(0).strip()[:60]!r}")
    for pattern in case.require:
        if not re.search(pattern, reply):
            problems.append(f"missing: {pattern}")
    if case.max_sentences is not None and count_sentences(reply) > case.max_sentences:
        problems.append(f"{count_sentences(reply)} sentences (at most {case.max_sentences})")
    if case.language == "latin" and language_share(reply, LATIN) < 0.7:
        problems.append("not written mostly in Latin letters")
    if case.language == "arabic" and language_share(reply, ARABIC) < 0.3:
        problems.append("not written mostly in Arabic")
    return problems


def case_prompt_and_options(case: Case):
    """The system prompt and reply budget the worker would use for this case."""

    import bot
    from rita_state import RitaSessionState

    state = RitaSessionState(active_language=case.site_language, active_dialect="ar-JO")
    state.observe_user_turn(case.text)
    body = {
        "language": case.site_language,
        "dialect": "ar-JO",
        "mode": "free_conversation",
        "targetLanguage": {"code": "de", "name": "German", "speechCode": "de"},
    }
    prompt = bot.build_prompt(body, state, dialogue=True)
    return prompt, bot.explain_options(state), bot


async def ask(client, case: Case) -> str:
    prompt, options, bot = case_prompt_and_options(case)
    params = {
        "model": bot.LLM_MODEL,
        "temperature": 0.45,
        "top_p": 0.9,
        "max_completion_tokens": bot.LLM_MAX_COMPLETION_TOKENS,
        "reasoning_effort": "low",
        "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": case.text}],
    }
    if options:
        params.update(options)
    response = await client.chat.completions.create(**params)
    return (response.choices[0].message.content or "").strip()


async def run_probe() -> dict[str, object]:
    """Run every fixed case and return a serializable, secret-free report."""

    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return {
            "outcome": "secret_missing",
            "passed": 0,
            "failed": len(CASES),
            "total": len(CASES),
            "cases": [],
        }
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
    results: list[dict[str, object]] = []
    for case in CASES:
        try:
            reply = await ask(client, case)
        except Exception as error:  # a network or quota problem is a failure of the run, not a pass
            results.append(
                {
                    "id": case.id,
                    "passed": False,
                    "problems": [f"request error: {type(error).__name__}"],
                }
            )
            continue
        problems = check_reply(case, reply)
        result: dict[str, object] = {
            "id": case.id,
            "passed": not problems,
            "problems": problems,
        }
        if problems:
            # These probes use only the fixed synthetic prompts above. A short preview
            # makes failures actionable without sending real learner content to CI.
            result["reply_preview"] = reply[:240]
        results.append(result)

    failed = sum(not bool(result["passed"]) for result in results)
    return {
        "outcome": "ok" if failed == 0 else "failed",
        "passed": len(CASES) - failed,
        "failed": failed,
        "total": len(CASES),
        "cases": results,
    }


def print_result(result: dict[str, object]) -> int:
    """Print the stable human-readable report and return its failure count."""

    if result.get("outcome") == "secret_missing":
        print("GROQ_API_KEY is not set in the Modal secret", file=sys.stderr)
        return int(result.get("failed", 1))
    for item in result.get("cases", []):
        case = dict(item)
        print(f"{'PASS' if case.get('passed') else 'FAIL'} {case.get('id')}")
        for problem in case.get("problems", []):
            print(f"     - {problem}")
        if case.get("reply_preview"):
            print(f"     reply: {case['reply_preview']!r}")
    print(f"\n{result.get('passed', 0)} of {result.get('total', len(CASES))} cases passed")
    return int(result.get("failed", 1))


async def main() -> int:
    return print_result(await run_probe())


if __name__ == "__main__":
    sys.exit(min(asyncio.run(main()), 125))
