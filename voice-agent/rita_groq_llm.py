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
        stream = await super().get_chat_completions(*args, **kwargs)

        async def observed_stream():
            try:
                async for chunk in stream:
                    reason = finish_reason_name(chunk)
                    if reason:
                        self._rita_latency.mark(
                            "groq_finish_reason",
                            finish_reason=reason,
                            truncated=reason == "length",
                        )
                    yield chunk
            finally:
                close = getattr(stream, "aclose", None)
                if close is not None:
                    await close()

        return observed_stream()
