import asyncio
from types import SimpleNamespace

import pytest

import rita_replay
from rita_replay import (
    MAX_CASES,
    MAX_HISTORY,
    ReplayCase,
    build_case,
    clean_reply,
    messages_for,
    parse_cases,
    replay_case,
)
from rita_turn_ledger import fixed_prompt_hash

TARGET = {"code": "de", "name": "German", "speechCode": "de"}


def case(**over):
    base = dict(
        id="r1",
        text="كيف بقول جوعان بالألماني",
        history=(("user", "مرحبا"), ("assistant", "أهلين! كيف الحال؟")),
        language="automatic",
        dialect="ar-JO",
        target=TARGET,
    )
    base.update(over)
    return ReplayCase(**base)


def test_the_prompt_is_the_one_the_live_worker_builds_for_the_same_turns():
    """Same state calls, same builder: the replay must not drift from a real call."""

    import bot
    from rita_state import RitaSessionState
    from rita_turn_router import RouterMode, router_mode

    c = case()
    _, replay_prompt, options, _ = build_case(c)

    live = RitaSessionState(active_language="automatic", active_dialect="ar-JO")
    live.observe_user_turn("مرحبا")
    live.observe_assistant_turn("أهلين! كيف الحال؟")
    live.observe_user_turn(c.text)
    body = {"language": "automatic", "dialect": "ar-JO", "mode": "free_conversation", "targetLanguage": TARGET}
    expected = bot.build_prompt(body, live, dialogue=router_mode() == RouterMode.ON)
    assert replay_prompt == expected
    assert options == bot.explain_options(live)
    assert "REPLY LANGUAGE" in replay_prompt


def test_the_history_changes_the_state_like_a_real_call():
    plain = build_case(case(history=()))[1]
    with_history = build_case(case())[1]
    assert plain != with_history  # the earlier turns are part of the session state


def test_a_site_language_choice_is_applied():
    _, prompt, _, _ = build_case(case(site_language="en", history=()))
    assert "REPLY LANGUAGE" in prompt
    english = prompt.split("REPLY LANGUAGE", 1)[1]
    assert "English" in english


def test_the_model_gets_the_prompt_the_bounded_history_and_the_turn():
    import bot

    c = case()
    _, prompt, _, _ = build_case(c)
    messages = messages_for(c, prompt, bot)
    assert messages[0] == {"role": "system", "content": prompt}
    assert [m["role"] for m in messages[1:]] == ["user", "assistant", "user"]
    assert messages[-1]["content"] == c.text


def test_requests_are_bounded_and_validated():
    cases = parse_cases(
        {
            "cases": [
                {"id": f"c{i}", "text": "hallo", "history": [{"role": "system", "content": "x"}] * 3}
                for i in range(MAX_CASES + 5)
            ]
            + [{"id": "", "text": "no id"}, {"id": "x", "text": "  "}, "junk"]
        }
    )
    assert len(cases) == MAX_CASES
    assert all(not c.history for c in cases)  # the "system" role is not accepted
    long = parse_cases(
        {"cases": [{"id": "a", "text": "t", "history": [{"role": "user", "content": str(i)} for i in range(MAX_HISTORY + 20)]}]}
    )
    assert len(long[0].history) == MAX_HISTORY
    assert parse_cases({"cases": "no"}) == []
    odd = parse_cases({"cases": [{"id": "a", "text": "t", "language": "klingon", "siteLanguage": "xx"}]})[0]
    assert odd.language == "automatic" and odd.site_language is None and odd.target is None


def test_the_reply_is_cleaned_like_the_live_voice_path():
    assert "**" not in clean_reply("حلو **كثير**")
    assert "خبريني" not in clean_reply("خبريني شو بدك")


class FakeClient:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **params):
        self.calls.append(params)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=reply))])


def test_samples_are_asked_with_the_workers_model_settings_and_failures_are_reported():
    import bot

    client = FakeClient(['"Ich habe Hunger". حرفياً عندي جوع.', RuntimeError("quota")])
    result = asyncio.run(replay_case(client, case(prompt_hash_then="deadbeef"), samples=2))
    assert len(client.calls) == 2
    params = client.calls[0]
    assert params["model"] == bot.LLM_MODEL and params["temperature"] == 0.45 and params["top_p"] == 0.9
    assert result["promptChanged"] is True
    assert result["promptHash"] == fixed_prompt_hash(build_case(case())[1])
    texts = [s for s in result["samples"] if "reply" in s]
    errors = [s for s in result["samples"] if "error" in s]
    assert len(texts) == 1 and len(errors) == 1 and errors[0]["error"] == "RuntimeError"
    same = asyncio.run(replay_case(FakeClient(["حلو"]), case(prompt_hash_then=result["promptHash"]), samples=1))
    assert same["promptChanged"] is False
    unknown = asyncio.run(replay_case(FakeClient(["حلو"]), case(), samples=1))
    assert unknown["promptChanged"] is None


def test_known_wrong_phrases_are_flagged_on_the_replayed_reply():
    result = asyncio.run(replay_case(FakeClient(["شو حابب نتعلم؟"]), case(), samples=1))
    assert result["samples"][0]["watch"]


def test_without_the_groq_key_nothing_is_faked(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    out = asyncio.run(rita_replay.run_replay({"cases": [{"id": "a", "text": "hallo"}]}))
    assert out["error"] == "secret_missing" and out["cases"] == []
    empty = asyncio.run(rita_replay.run_replay({"cases": []}))
    assert empty["cases"] == [] and "build" in empty
