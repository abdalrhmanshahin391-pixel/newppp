"""Groq streaming wrapper that records why a response ended without logging its text."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from pipecat.services.groq.llm import GroqLLMService

from rita_latency import RitaLatencyRecorder


def finish_reason_name(chunk: Any) -> str | None:
    """Return the provider finish reason from an OpenAI-compatible stream chunk."""

    choices = getattr(chunk, "choices", None)
    if not choices:
        return None
    reason = getattr(choices[0], "finish_reason", None)
    if reason is None:
        return None
    value = getattr(reason, "value", reason)
    clean = str(value).strip().casefold()
    return clean or None


def is_parse_failure(error: BaseException) -> bool:
    """Groq's "Parsing failed" error: the model's output could not be read (now and then with
    gpt-oss). A fresh request almost always succeeds, so it is worth one retry."""

    return "parsing failed" in str(error).casefold() or "failed_generation" in str(error).casefold()


def chunk_has_text(chunk: Any) -> bool:
    choices = getattr(chunk, "choices", None)
    if not choices:
        return False
    delta = getattr(choices[0], "delta", None)
    return bool(getattr(delta, "content", None))


def apply_turn_options(params: dict[str, Any], options: dict[str, Any] | None) -> dict[str, Any]:
    """Overlay one turn's reply budget (`max_completion_tokens`, `reasoning_effort`) on the request."""

    if options:
        params.update({key: value for key, value in options.items() if value is not None})
    return params


class RitaGroqLLMService(GroqLLMService):
    """Observe the terminal stream chunk while preserving Pipecat's normal flow.

    `turn_options` is asked once per request and may return a different reply budget for this turn
    (an explanation needs more room, and a little more thinking, than a quick answer).
    """

    def __init__(
        self,
        *args,
        latency_recorder: RitaLatencyRecorder,
        turn_options: Callable[[], dict[str, Any] | None] | None = None,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self._rita_latency = latency_recorder
        self._turn_options = turn_options

    def build_chat_completion_params(self, params_from_context):
        params = super().build_chat_completion_params(params_from_context)
        return apply_turn_options(params, self._turn_options() if self._turn_options else None)

    async def get_chat_completions(self, *args, **kwargs):
        open_stream = super().get_chat_completions
        retried = False

        async def reopen(error: BaseException):
            nonlocal retried
            if retried or not is_parse_failure(error):
                raise error
            retried = True
            self._rita_latency.mark("groq_retry", reason="parse_failed")
            return await open_stream(*args, **kwargs)

        try:
            stream = await open_stream(*args, **kwargs)
        except Exception as error:  # noqa: BLE001 - only Groq's parse failure is retried
            stream = await reopen(error)

        async def observed_stream():
            nonlocal stream
            spoke = False
            try:
                while True:
                    try:
                        async for chunk in stream:
                            reason = finish_reason_name(chunk)
                            if reason:
                                self._rita_latency.mark(
                                    "groq_finish_reason",
                                    finish_reason=reason,
                                    truncated=reason == "length",
                                )
                            spoke = spoke or chunk_has_text(chunk)
                            yield chunk
                        return
                    except Exception as error:  # noqa: BLE001 - re-raised unless retried
                        # A retry is safe only before any words went out to the voice.
                        if spoke:
                            raise
                        await _close(stream)
                        stream = await reopen(error)
            finally:
                await _close(stream)

        return observed_stream()


async def _close(stream: Any) -> None:
    close = getattr(stream, "aclose", None)
    if close is not None:
        await close()
