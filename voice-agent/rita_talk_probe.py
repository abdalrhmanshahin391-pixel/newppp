"""Hold whole free conversations with the real model and measure how long Uzyra talks.

One question at a time (rita_content_probe.py) cannot show whether replies stay short over a real
chat. This probe plays a few fixed conversations turn by turn, the way a learner would: every reply
of Uzyra's goes back into the conversation and into the session state, exactly as the live worker
does, and the next learner line follows. Each reply is split at the sheet marker: the part before it
is what the learner hears, the part after it is the written sheet (tables and rules) on the page.

What is checked, per reply (plain rules, no grading model):
- the spoken part is short (words and sentences), with at most one question;
- a turn that asks for rules, a comparison or a list gets a sheet; chat, thanks and stop words do not;
- the sheet stays within its limits.

    GROQ_API_KEY=... python rita_talk_probe.py --runs 2      # from voice-agent/
    modal run modal_app.py::talk_probe                        # the key stays in Modal's secret

The learner lines are fixed and synthetic, so the full replies are printed for reading.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
from dataclasses import dataclass
from statistics import mean
from typing import Any

SENTENCE_END = re.compile(r"[.!?؟]+(?:[\"'”»]?)(?:\s|$)")
QUESTION = re.compile(r"[?؟]")
WORD = re.compile(r"\S+")

#: A normal reply: at most this many spoken words and sentences. Length is measured in words; a short
#: reaction ("ممتاز!"), the corrected sentence, a question and a phrase to answer with are four short
#: sentences in about 20 words.
MAX_WORDS = 30
MAX_SENTENCES = 4
#: "I did not understand": one plain sentence and one example may need a little more.
MAX_WORDS_SIMPLIFY = 40
MAX_SENTENCES_SIMPLIFY = 5
MAX_SHEET_LINES = 12


@dataclass(frozen=True)
class Turn:
    text: str
    #: "yes": this turn needs a sheet; "no": it must not have one; "any": either is fine
    sheet: str = "any"
    simplify: bool = False


@dataclass(frozen=True)
class Talk:
    id: str
    site_language: str
    target: dict[str, str]
    turns: tuple[Turn, ...]


EN = {"code": "en", "name": "English", "speechCode": "en"}
DE = {"code": "de", "name": "German", "speechCode": "de"}

TALKS: tuple[Talk, ...] = (
    Talk(
        "english-beginner-ar",
        "ar",
        EN,
        (
            Turn("مرحبا، بدي أتعلم إنجليزي", sheet="no"),
            Turn("بعرف شوي إنجليزي", sheet="no"),
            Turn("I'm Abdulrahman", sheet="no"),
            Turn("طب شو معنى هاد الحكي؟"),
            Turn("I'm Abdulrahman, I'm from Jordan", sheet="no"),
            Turn("تعلمت من المدرسة", sheet="no"),
            Turn("I'm learning English just to have fun", sheet="no"),
            Turn("اشرحلي متى بستعمل am و is و are", sheet="yes"),
            Turn("ما فهمت ولا اشي", simplify=True),
            Turn("آه هلأ فهمت، شكراً", sheet="no"),
            Turn("I like play football with my friends", sheet="no"),
            Turn("كيف بقول بحب أطبخ مع أمي؟", sheet="no"),
        ),
    ),
    Talk(
        "german-ar",
        "ar",
        DE,
        (
            Turn("بدي أحكي ألماني شوي", sheet="no"),
            Turn("Ich heiße Abdulrahman", sheet="no"),
            Turn("Ich komme aus Jordanien", sheet="no"),
            Turn("شو الفرق بين der و die و das؟", sheet="yes"),
            Turn("اوكي", sheet="no"),
            Turn("Ich habe gestern Fußball gespielt", sheet="no"),
            Turn("اشرحلي الـ Perfekt", sheet="yes"),
            Turn("خلص كفاية", sheet="no"),
            Turn("شو أحسن مطعم بعمان؟", sheet="no"),
            Turn("أعطيني خمس كلمات عن المطبخ", sheet="yes"),
        ),
    ),
    Talk(
        "english-en",
        "en",
        EN,
        (
            Turn("Hi, I want to practise speaking English", sheet="no"),
            Turn("I am work in a bank", sheet="no"),
            Turn("Can you explain when to use the present perfect and the past simple?", sheet="yes"),
            Turn("ok thanks", sheet="no"),
            Turn("I have been to London last year", sheet="no"),
            Turn("What does 'break a leg' mean?", sheet="no"),
        ),
    ),
)


def split_reply(raw: str) -> tuple[str, str]:
    """(spoken part, sheet) of a reply."""

    from rita_sheet import MARKER_LINE

    at = raw.lower().find(MARKER_LINE.lower())
    if at < 0:
        return raw.strip(), ""
    return raw[:at].strip(), raw[at + len(MARKER_LINE) :].strip()


def heard(spoken: str) -> str:
    """What the voice says: the same cleaner as the worker (markdown marks dropped)."""

    from rita_dialect import SpeechTextFilter

    speech = SpeechTextFilter()
    return (speech.feed(spoken) + speech.pending).strip()


#: A phrase in quotes ("I'm from …") is the learner's line to say, not one of Uzyra's sentences.
QUOTED = re.compile(r"[\"“„«][^\"“”„«»]{1,120}[\"”“»]")


def count_sentences(text: str) -> int:
    """Uzyra's own sentences; a quoted phrase counts as part of the sentence around it."""

    bare = QUOTED.sub("PHRASE", text.strip())
    parts = [part for part in SENTENCE_END.split(bare) if part.strip() and part.strip() != "PHRASE"]
    return len(parts) or (1 if text.strip() else 0)


def measure(raw: str) -> dict[str, Any]:
    spoken, sheet = split_reply(raw)
    voice = heard(spoken)
    sheet_lines = [line for line in sheet.splitlines() if line.strip()]
    return {
        "words": len(WORD.findall(voice)),
        "sentences": count_sentences(voice),
        "questions": len(QUESTION.findall(voice)),
        "sheet_lines": len(sheet_lines),
        "spoken": voice,
        "sheet": sheet,
    }


def check_turn(turn: Turn, raw: str) -> list[str]:
    """What is wrong with this reply (an empty list means it passes)."""

    if not raw.strip():
        return ["empty reply"]
    m = measure(raw)
    words = MAX_WORDS_SIMPLIFY if turn.simplify else MAX_WORDS
    sentences = MAX_SENTENCES_SIMPLIFY if turn.simplify else MAX_SENTENCES
    problems: list[str] = []
    if m["words"] > words:
        problems.append(f"spoken {m['words']} words (at most {words})")
    if m["sentences"] > sentences:
        problems.append(f"spoken {m['sentences']} sentences (at most {sentences})")
    if m["questions"] > 1:
        problems.append(f"{m['questions']} questions in one reply")
    if turn.sheet == "yes" and not m["sheet_lines"]:
        problems.append("no sheet where rules or a list were asked for")
    if turn.sheet == "no" and m["sheet_lines"]:
        problems.append("a sheet on a chat turn")
    if m["sheet_lines"] > MAX_SHEET_LINES:
        problems.append(f"sheet has {m['sheet_lines']} lines (at most {MAX_SHEET_LINES})")
    return problems


def turn_request(talk: Talk, history: list[tuple[str, str]], text: str):
    """System prompt, messages and extra settings the live worker would use for this turn."""

    import bot
    from rita_state import RitaSessionState
    from rita_turn_router import RouterMode, router_mode

    state = RitaSessionState(active_language=talk.site_language, active_dialect="ar-JO")
    state.set_site_language(talk.site_language)
    for role, content in history:
        if role == "user":
            state.observe_user_turn(content)
        else:
            state.observe_assistant_turn(content)
    state.observe_user_turn(text)
    body = {
        "language": talk.site_language,
        "dialect": "ar-JO",
        "mode": "free_conversation",
        "targetLanguage": talk.target,
    }
    prompt = bot.build_prompt(body, state, dialogue=router_mode() == RouterMode.ON)
    messages = [
        {"role": "system", "content": prompt},
        {"role": "assistant", "content": bot.FREE_CONVERSATION_OPENER},
        *({"role": role, "content": content} for role, content in history),
        {"role": "user", "content": text},
    ]
    params: dict[str, Any] = {
        "model": bot.LLM_MODEL,
        "temperature": 0.45,
        "top_p": 0.9,
        "max_completion_tokens": bot.LLM_MAX_COMPLETION_TOKENS,
        "reasoning_effort": "low",
        "messages": messages,
    }
    options = bot.explain_options(state)
    if options:
        params.update(options)
    return params, state


async def play(client, talk: Talk) -> list[dict[str, Any]]:
    """One whole conversation; every reply goes back into the next turn."""

    history: list[tuple[str, str]] = []
    out: list[dict[str, Any]] = []
    for turn in talk.turns:
        params, state = turn_request(talk, history, turn.text)
        try:
            response = await client.chat.completions.create(**params)
            choice = response.choices[0]
            raw = (choice.message.content or "").strip()
        except Exception as error:  # a network or quota problem fails the turn, never passes it
            out.append({"text": turn.text, "problems": [f"request error: {type(error).__name__}"]})
            break
        m = measure(raw)
        out.append(
            {
                "text": turn.text,
                "type": str(getattr(state.response_type, "value", state.response_type)),
                "problems": check_turn(turn, raw)
                + (
                    []
                    if raw
                    else [
                        f"stopped: {choice.finish_reason}, used"
                        f" {getattr(response.usage, 'completion_tokens', '?')} of"
                        f" {params['max_completion_tokens']} tokens"
                    ]
                ),
                **m,
            }
        )
        history.extend([("user", turn.text), ("assistant", raw)])
    return out


async def run_probe(runs: int = 2) -> dict[str, Any]:
    """Play every conversation `runs` times; a serializable, secret-free report."""

    total_turns = sum(len(talk.turns) for talk in TALKS) * runs
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return {"outcome": "secret_missing", "passed": 0, "failed": total_turns, "talks": []}
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
    jobs = [(talk, run) for talk in TALKS for run in range(1, runs + 1)]
    played = await asyncio.gather(*(play(client, talk) for talk, _ in jobs))
    talks = [{"id": talk.id, "run": run, "turns": turns} for (talk, run), turns in zip(jobs, played)]
    replies = [turn for talk in talks for turn in talk["turns"]]
    failed = sum(bool(turn["problems"]) for turn in replies) + (total_turns - len(replies))
    words = [turn["words"] for turn in replies if "words" in turn]
    return {
        "outcome": "ok" if failed == 0 else "failed",
        "passed": total_turns - failed,
        "failed": failed,
        "total": total_turns,
        "words_mean": round(mean(words), 1) if words else 0,
        "words_max": max(words) if words else 0,
        "talks": talks,
    }


def print_result(result: dict[str, Any]) -> int:
    """Print every conversation with its replies, then the totals; return the failure count."""

    if result.get("outcome") == "secret_missing":
        print("GROQ_API_KEY is not set", file=sys.stderr)
        return int(result.get("failed", 1))
    for talk in result.get("talks", []):
        print(f"\n=== {talk['id']} (run {talk['run']}) ===")
        for turn in talk["turns"]:
            mark = "FAIL" if turn["problems"] else "ok  "
            print(f"\n{mark} learner: {turn['text']}")
            if "spoken" in turn:
                print(
                    f"     [{turn['type']}] {turn['words']} words, {turn['sentences']} sentences,"
                    f" sheet {turn['sheet_lines']} lines"
                )
                print(f"     says: {turn['spoken']}")
                if turn["sheet"]:
                    for line in turn["sheet"].splitlines():
                        print(f"     | {line}")
            for problem in turn["problems"]:
                print(f"     - {problem}")
    print(
        f"\n{result.get('passed', 0)} of {result.get('total', 0)} replies passed;"
        f" spoken words: mean {result.get('words_mean')}, max {result.get('words_max')}"
    )
    return int(result.get("failed", 1))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--runs", type=int, default=2)
    args = parser.parse_args()
    return print_result(asyncio.run(run_probe(max(1, min(args.runs, 5)))))


if __name__ == "__main__":
    sys.exit(min(main(), 125))
