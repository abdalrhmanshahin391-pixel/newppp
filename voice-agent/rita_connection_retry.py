"""Bounded retries for transient provider socket opening failures only."""
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


async def open_with_retry(
    connect: Callable[[], Awaitable[T]],
    *,
    on_retry: Callable[[int, str], None] | None = None,
    delay_seconds: float = 0.5,
) -> T:
    # At most two handshakes. Authentication/configuration errors and cancellation
    # are deliberately not retried, and no request text is replayed.
    for attempt in range(2):
        try:
            return await connect()
        except (TimeoutError, OSError) as error:
            if attempt == 1:
                raise
            if on_retry:
                on_retry(attempt + 1, type(error).__name__)
            await asyncio.sleep(delay_seconds)
    raise AssertionError("unreachable")
