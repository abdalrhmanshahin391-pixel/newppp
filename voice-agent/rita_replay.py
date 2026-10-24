"""Ask the current worker what it would say now to a past learner turn.

The review finds replies that were wrong; a fix is only a fix if Rita now answers those same turns
better. A replay rebuilds the session state the way the live call did (the same state calls for every
earlier message), builds the system prompt with the worker's own `build_prompt`, asks the same model
with the same settings, and cleans the reply with the same speech filter. The website then judges the
new reply against the reference reply (see src/lib/rita-replay.ts).

Only text goes through here: what the learner said and what Rita said. Nothing is stored, and the
Groq key stays in Modal's secret. Timing, listening and the voice are not part of a replay.
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Any

from rita_dialect import SpeechTextFilter, neutral_wording, scan_dialect
from rita_turn_ledger import build_id, fixed_prompt_hash

MAX_CASES = 12
MAX_SAMPLES = 3
MAX_HISTORY = 80
MAX_TEXT = 4000
LANGUAGES = {"automatic", "ar", "en", "de"}


@dataclass(frozen=True)
class ReplayCase:
    id: str
    text: str
    #: (role, content) of every message before the learner's last one, oldest first
    history: tuple[tuple[str, str], ...] = ()
    #: the session's language when it started ("automatic" unless the profile said otherwise)
    language: str = "automatic"
    dialect: str = "ar-JO"
    #: set when the turn's language came from the website's "Rita explains in" choice
    site_language: str | None = None
    #: the language being learned: {"code", "name", "speechCode"}
    target: dict[str, str] | None = None
    #: hash of the fixed part of the prompt when the reply was first given
    prompt_hash_then: str | None = None


def _text(value: Any, limit: int = MAX_TEXT) -> str:
    return str(value or "").strip()[:limit]


def parse_cases(payload: dict[str, Any]) -> list[ReplayCase]:
    """Validate the request: bounded in count and size, roles limited to user and assistant."""

    raw = payload.get("cases")
    if not isinstance(raw, list):
        return []
    cases: list[ReplayCase] = []
    for item in raw[:MAX_CASES]:
        if not isinstance(item, dict):
            continue
        text = _text(item.get("text"))
        case_id = _text(item.get("id"), 80)
        if not text or not case_id:
            continue
        history: list[tuple[str, str]] = []
        for message in (item.get("history") or [])[-MAX_HISTORY:]:
            if not isinstance(message, dict):
                continue
            role = message.get("role")
            content = _text(message.get("content"))
            if role in {"user", "assistant"} and content:
                history.append((str(role), content))
        language = str(item.get("language") or "automatic")
        site = item.get("siteLanguage")
        target = item.get("target")
        cases.append(
            ReplayCase(
                id=case_id,
                text=text,
                history=tuple(history),
                language=language if language in LANGUAGES else "automatic",
                dialect=_text(item.get("dialect") or "ar-JO", 32) or "ar-JO",
                site_language=str(site) if site in LANGUAGES else None,
                target=(
                    {key: _text(target.get(key), 32) for key in ("code", "name", "speechCode")}
                    if isinstance(target, dict) and target.get("code")
                    else None
                ),
                prompt_hash_then=_text(item.get("promptHash"), 16) or None,
            )
        )
    return cases


def build_case(case: ReplayCase):
    """The state, system prompt and extra model settings the live worker would have for this turn."""

    import bot
    from rita_state import RitaSessionState
    from rita_turn_router import RouterMode, router_mode

    state = RitaSessionState(active_language=case.language, active_dialect=case.dialect)
    if case.site_language:
        state.set_site_language(case.site_language)
    # The calls the live pipeline makes: every learner turn and every finished reply of Rita's.
    for role, content in case.history:
        if role == "user":
            state.observe_user_turn(content)
        else:
            state.observe_assistant_turn(content)
    state.observe_user_turn(case.text)
    body: dict[str, Any] = {"language": case.language, "dialect": case.dialect, "mode": "free_conversation"}
    if case.target:
        body["targetLanguage"] = case.target
    prompt = bot.build_prompt(body, state, dialogue=router_mode() == RouterMode.ON)
    return state, prompt, bot.explain_options(state), bot


def messages_for(case: ReplayCase, prompt: str, bot) -> list[dict[str, str]]:
    """System prompt, the bounded saved history, then the learner's turn (as the worker does)."""

    saved = bot.saved_conversation_history(
        {"conversationHistory": [{"role": role, "content": content} for role, content in case.history]}
    )
    return [{"role": "system", "content": prompt}, *saved, {"role": "user", "content": case.text}]


def clean_reply(raw: str) -> str:
    """What the learner would have heard and read: markdown dropped, gendered "tell me" swapped."""

    speech = SpeechTextFilter()
    return neutral_wording(speech.feed(raw) + speech.pending).strip()


async def replay_case(client, case: ReplayCase, samples: int) -> dict[str, Any]:
    state, prompt, options, bot = build_case(case)
    messages = messages_for(case, prompt, bot)
    params: dict[str, Any] = {
        "model": bot.LLM_MODEL,
        "temperature": 0.45,
        "top_p": 0.9,
        "max_completion_tokens": bot.LLM_MAX_COMPLETION_TOKENS,
        "reasoning_effort": "low",
        "messages": messages,
    }
    if options:
        params.update(options)

    async def one() -> dict[str, Any]:
        try:
            response = await client.chat.completions.create(**params)
        except Exception as error:  # a network or quota problem is reported, never faked as a pass
            return {"error": type(error).__name__}
        reply = clean_reply(response.choices[0].message.content or "")
        return {"reply": reply, "watch": scan_dialect(reply)} if reply else {"error": "empty reply"}

    results = await asyncio.gather(*(one() for _ in range(max(1, min(samples, MAX_SAMPLES)))))
    now_hash = fixed_prompt_hash(prompt)
    return {
        "id": case.id,
        "samples": results,
        "promptHash": now_hash,
        # None when the request did not say what the prompt was then
        "promptChanged": (now_hash != case.prompt_hash_then) if case.prompt_hash_then else None,
        "replyLanguage": state.reply_language(),
    }


async def run_replay(payload: dict[str, Any]) -> dict[str, Any]:
    """The Modal endpoint's work: replay every case and report which build answered."""

    cases = parse_cases(payload)
    result: dict[str, Any] = {"build": build_id(), "cases": []}
    if not cases:
        return result
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return {**result, "error": "secret_missing"}
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
    samples = int(payload.get("samples") or 2)
    result["cases"] = list(await asyncio.gather(*(replay_case(client, case, samples) for case in cases)))
    return result
