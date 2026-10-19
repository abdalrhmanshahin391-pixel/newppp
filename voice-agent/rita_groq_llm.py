"""Groq streaming wrapper that records why a response ended without logging its text."""

from __future__ import annotations

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


class RitaGroqLLMService(GroqLLMService):
    """Observe the terminal stream chunk while preserving Pipecat's normal flow."""

    def __init__(self, *args, latency_recorder: RitaLatencyRecorder, **kwargs):
        super().__init__(*args, **kwargs)
        self._rita_latency = latency_recorder

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
