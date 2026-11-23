"""Groq's "Parsing failed" error is retried once, and only before any word was spoken."""

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipecat.services.groq.llm import GroqLLMService

from rita_groq_llm import RitaGroqLLMService, is_parse_failure
from rita_latency import RitaLatencyRecorder

PARSE = RuntimeError("Parsing failed. The model generated output that could not be parsed.")


def chunk(text=None, finish=None):
    delta = SimpleNamespace(content=text)
    return SimpleNamespace(choices=[SimpleNamespace(delta=delta, finish_reason=finish)])


class Stream:
    def __init__(self, items):
        self.items = list(items)
        self.closed = False

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.items:
            raise StopAsyncIteration
        item = self.items.pop(0)
        if isinstance(item, BaseException):
            raise item
        return item

    async def aclose(self):
        self.closed = True


def service(streams):
    llm = RitaGroqLLMService(
        api_key="test",
        latency_recorder=RitaLatencyRecorder(session_id="t"),
        settings=GroqLLMService.Settings(model="m"),
    )
    calls = []

    async def fake_open(*_args, **_kwargs):
        calls.append(1)
        item = streams.pop(0)
        if isinstance(item, BaseException):
            raise item
        return item

    return llm, calls, fake_open


def collect(llm, fake_open, monkeypatch):
    monkeypatch.setattr(GroqLLMService, "get_chat_completions", lambda self, *a, **k: fake_open(*a, **k))

    async def run():
        stream = await llm.get_chat_completions()
        return [c.choices[0].delta.content async for c in stream]

    return asyncio.run(run())


def test_the_parse_error_is_recognised():
    assert is_parse_failure(PARSE)
    assert not is_parse_failure(RuntimeError("rate limited"))


def test_a_parse_failure_before_any_word_is_retried_once(monkeypatch):
    first = Stream([chunk(None), PARSE])
    second = Stream([chunk("أهلين"), chunk(None, "stop")])
    llm, calls, fake_open = service([first, second])
    assert collect(llm, fake_open, monkeypatch) == [None, "أهلين", None]
    assert len(calls) == 2 and first.closed and second.closed


def test_a_parse_failure_when_opening_is_retried_once(monkeypatch):
    llm, calls, fake_open = service([PARSE, Stream([chunk("تمام")])])
    assert collect(llm, fake_open, monkeypatch) == ["تمام"]
    assert len(calls) == 2


def test_it_is_not_retried_twice_or_after_words_were_spoken(monkeypatch):
    llm, _, fake_open = service([Stream([PARSE]), Stream([PARSE])])
    with pytest.raises(RuntimeError, match="Parsing failed"):
        collect(llm, fake_open, monkeypatch)
    llm, calls, fake_open = service([Stream([chunk("نص"), PARSE]), Stream([chunk("x")])])
    with pytest.raises(RuntimeError, match="Parsing failed"):
        collect(llm, fake_open, monkeypatch)
    assert len(calls) == 1


def test_other_errors_are_not_retried(monkeypatch):
    llm, calls, fake_open = service([Stream([RuntimeError("boom")]), Stream([chunk("x")])])
    with pytest.raises(RuntimeError, match="boom"):
        collect(llm, fake_open, monkeypatch)
    assert len(calls) == 1


def test_the_retry_samples_differently(monkeypatch):
    from rita_groq_llm import RETRY_OVERRIDES

    llm, _, _ = service([])
    seen = []
    base = {"model": "m", "temperature": 0.45}
    monkeypatch.setattr(GroqLLMService, "build_chat_completion_params", lambda self, p: dict(base))
    seen.append(llm.build_chat_completion_params({}))
    llm._retrying = True
    seen.append(llm.build_chat_completion_params({}))
    assert seen[0]["temperature"] == 0.45
    assert seen[1]["temperature"] == RETRY_OVERRIDES["temperature"]
