"""Grade Uzyra's free conversations on Jordanian learners' questions, with any Groq model.

The talk probe (rita_talk_probe.py) checks a few fixed chats for length. This evaluation plays the
larger set in rita_talk_eval_corpus.py the same way (every reply goes back into the conversation and
the session state, with the worker's real prompt and its speech cleaner) and adds:
- the expected content of each turn (`must`: the right German word, the right correction);
- the time to the first written word of each reply, which is what the learner waits for in a call
  (text only: no voice service is called, so no Cartesia or Soniox cost);
- any Groq model and thinking level, to compare models on the same lines;
- every reply in a JSON file, so a person can read and grade them (the corpus says what a good reply
  does, per turn).

    modal run modal_app.py::talk_eval --split dev                                  # the live model
    modal run modal_app.py::talk_eval --model llama-3.3-70b-versatile --split all
    GROQ_API_KEY=... python rita_talk_eval.py --model openai/gpt-oss-120b --effort medium

Plain checks only: the score says what broke a rule, the reading says whether the reply is good.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from statistics import mean, median
from typing import Any

from rita_talk_probe import Talk, check_turn, measure, phrases, repeated_phrase, turn_request

#: Parallel conversations; Groq's per-minute token limits are the bottleneck, not the network.
CONCURRENCY = int(os.getenv("RITA_EVAL_CONCURRENCY", "4"))
RETRIES = 4


def family(model: str) -> str:
    if model.startswith("openai/gpt-oss"):
        return "gpt-oss"
    if "qwen3" in model:
        return "qwen3"
    return "plain"


def model_params(params: dict[str, Any], model: str, effort: str) -> dict[str, Any]:
    """The worker's request, for another model or thinking level.

    gpt-oss keeps the worker's own levels (low, medium for explanations) unless `effort` is given;
    qwen3 thinks only when asked; other models take no thinking setting at all.
    """

    out = dict(params)
    if not model:
        if effort:
            out["reasoning_effort"] = effort
        return out
    out["model"] = model
    kind = family(model)
    if kind == "gpt-oss":
        if effort:
            out["reasoning_effort"] = effort
    elif kind == "qwen3":
        thinking = effort not in ("", "none", "low")
        out["reasoning_effort"] = "default" if thinking else "none"
        if thinking:
            out["reasoning_format"] = "hidden"
    else:
        out.pop("reasoning_effort", None)
    return out


async def ask(client, params: dict[str, Any]) -> dict[str, Any]:
    """One streamed reply with its timing; rate limits are waited out, other errors returned."""

    import openai

    for attempt in range(RETRIES):
        started = time.perf_counter()
        first = 0.0
        parts: list[str] = []
        finish = None
        try:
            stream = await client.chat.completions.create(**params, stream=True)
            async for chunk in stream:
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                text = getattr(choice.delta, "content", None)
                if text:
                    first = first or time.perf_counter()
                    parts.append(text)
                finish = choice.finish_reason or finish
        except openai.RateLimitError as error:
            wait = 4.0 * (attempt + 1)
            try:
                wait = max(wait, float(error.response.headers.get("retry-after", 0)))
            except (AttributeError, TypeError, ValueError):
                pass
            await asyncio.sleep(min(wait, 60))
            continue
        except openai.APIError as error:
            return {"raw": "", "error": f"{type(error).__name__}: {str(error)[:160]}"}
        done = time.perf_counter()
        return {
            "raw": "".join(parts).strip(),
            "finish": str(finish or ""),
            "first_ms": round((first - started) * 1000) if first else None,
            "total_ms": round((done - started) * 1000),
        }
    return {"raw": "", "error": "rate limited after retries"}


async def play(client, talk: Talk, split: str, model: str, effort: str, gate: asyncio.Semaphore):
    history: list[tuple[str, str]] = []
    earlier: set[str] = set()
    out: list[dict[str, Any]] = []
    async with gate:
        for index, turn in enumerate(talk.turns, 1):
            params, state = turn_request(talk, history, turn.text)
            reply = await ask(client, model_params(params, model, effort))
            raw = reply["raw"]
            row: dict[str, Any] = {
                "talk": talk.id,
                "split": split,
                "turn": index,
                "text": turn.text,
                "type": str(getattr(state.response_type, "value", state.response_type)),
                "first_ms": reply.get("first_ms"),
                "total_ms": reply.get("total_ms"),
            }
            if reply.get("error"):
                out.append({**row, "problems": [f"request error: {reply['error']}"]})
                break
            m = measure(raw)
            problems = check_turn(turn, raw, talk.site_language) + repeated_phrase(turn, m["spoken"], earlier)
            if not raw:
                problems.append(f"empty reply (finish: {reply.get('finish')})")
            out.append({**row, "problems": problems, **m})
            history.extend([("user", turn.text), ("assistant", raw)])
            earlier.update(phrases(m["spoken"]))
    return out


def summarize(rows: list[dict[str, Any]], expected: int) -> dict[str, Any]:
    answered = [row for row in rows if "spoken" in row]
    failed = sum(bool(row["problems"]) for row in rows) + (expected - len(rows))
    firsts = sorted(row["first_ms"] for row in answered if row.get("first_ms"))
    words = [row["words"] for row in answered]
    p90 = firsts[min(len(firsts) - 1, int(len(firsts) * 0.9))] if firsts else 0
    return {
        "total": expected,
        "passed": expected - failed,
        "failed": failed,
        "pass_rate": round((expected - failed) / expected, 3) if expected else 0,
        "first_word_ms_median": round(median(firsts)) if firsts else 0,
        "first_word_ms_p90": p90,
        "words_mean": round(mean(words), 1) if words else 0,
        "words_max": max(words) if words else 0,
    }


async def run_eval(model: str = "", effort: str = "", split: str = "dev", runs: int = 1) -> dict[str, Any]:
    """Play the chosen part `runs` times; a serializable, secret-free report."""

    import bot
    from rita_talk_eval_corpus import DEV, HOLDOUT

    parts = {"dev": [("dev", t) for t in DEV], "holdout": [("holdout", t) for t in HOLDOUT]}
    chosen = parts["dev"] + parts["holdout"] if split == "all" else parts.get(split, parts["dev"])
    jobs = [(name, talk) for name, talk in chosen for _ in range(max(1, min(runs, 3)))]
    expected = sum(len(talk.turns) for _, talk in jobs)
    used = model or bot.LLM_MODEL
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return {"outcome": "secret_missing", "model": used, "summary": summarize([], expected), "rows": []}
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1", max_retries=0)
    try:
        available = sorted(m.id for m in (await client.models.list()).data)
    except Exception:  # the list is a convenience; the run does not depend on it
        available = []
    gate = asyncio.Semaphore(CONCURRENCY)
    played = await asyncio.gather(*(play(client, talk, name, model, effort, gate) for name, talk in jobs))
    rows = [row for talk_rows in played for row in talk_rows]
    by_split = {
        name: summarize(
            [row for row in rows if row["split"] == name],
            sum(len(talk.turns) for n, talk in jobs if n == name),
        )
        for name in sorted({name for name, _ in jobs})
    }
    return {
        "outcome": "ok",
        "model": used,
        "effort": effort or ("worker default" if family(used) == "gpt-oss" else ""),
        "split": split,
        "runs": runs,
        "summary": summarize(rows, expected),
        "by_split": by_split,
        "available_models": available,
        "rows": rows,
    }


def print_eval(result: dict[str, Any]) -> int:
    """Every reply on a few lines, then the totals; return the failure count."""

    if result.get("outcome") == "secret_missing":
        print("GROQ_API_KEY is not set", file=sys.stderr)
        return int(result["summary"]["failed"]) or 1
    for row in result.get("rows", []):
        mark = "FAIL" if row["problems"] else "ok  "
        timing = f"{row.get('first_ms') or '-'}ms"
        print(f"{mark} {row['talk']}#{row['turn']} [{row['type']}] {timing} L: {row['text']}")
        if "spoken" in row:
            print(f"     S: {row['spoken']}")
            for line in row["sheet"].splitlines()[:8]:
                if line.strip():
                    print(f"     | {line}")
        for problem in row["problems"]:
            print(f"     - {problem}")
    print(f"\nmodel {result.get('model')} (thinking: {result.get('effort') or '-'}), part {result.get('split')}")
    for name, s in result.get("by_split", {}).items():
        print(
            f"{name}: {s['passed']}/{s['total']} passed ({s['pass_rate']:.0%}); first word median"
            f" {s['first_word_ms_median']}ms, p90 {s['first_word_ms_p90']}ms; words mean {s['words_mean']}"
        )
    if result.get("available_models"):
        print("groq models:", ", ".join(result["available_models"]))
    return int(result["summary"]["failed"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model", default="")
    parser.add_argument("--effort", default="")
    parser.add_argument("--split", default="dev", choices=("dev", "holdout", "all"))
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--out", default="")
    args = parser.parse_args()
    result = asyncio.run(run_eval(args.model, args.effort, args.split, args.runs))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(result, handle, ensure_ascii=False, indent=1)
    print_eval(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
