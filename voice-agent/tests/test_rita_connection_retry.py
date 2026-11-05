import asyncio
import unittest
from unittest.mock import AsyncMock, Mock

from rita_connection_retry import open_with_retry


class ConnectionRetryTests(unittest.IsolatedAsyncioTestCase):
    async def test_timeout_retries_once_then_returns_socket(self):
        socket = object()
        connect = AsyncMock(side_effect=[TimeoutError("opening handshake"), socket])
        retry = Mock()
        result = await open_with_retry(connect, on_retry=retry, delay_seconds=0)
        self.assertIs(result, socket)
        self.assertEqual(connect.await_count, 2)
        retry.assert_called_once_with(1, "TimeoutError")

    async def test_persistent_timeout_stops_after_two_attempts(self):
        connect = AsyncMock(side_effect=TimeoutError("slow provider"))
        with self.assertRaises(TimeoutError):
            await open_with_retry(connect, delay_seconds=0)
        self.assertEqual(connect.await_count, 2)

    async def test_authentication_failure_is_not_retried(self):
        connect = AsyncMock(side_effect=ValueError("authentication rejected"))
        with self.assertRaises(ValueError):
            await open_with_retry(connect, delay_seconds=0)
        connect.assert_awaited_once()

    async def test_cancellation_is_not_retried(self):
        connect = AsyncMock(side_effect=asyncio.CancelledError())
        with self.assertRaises(asyncio.CancelledError):
            await open_with_retry(connect, delay_seconds=0)
        connect.assert_awaited_once()

    async def test_temporary_network_failure_retries_once(self):
        connect = AsyncMock(side_effect=[OSError("network unavailable"), "socket"])
        self.assertEqual(await open_with_retry(connect, delay_seconds=0), "socket")
        self.assertEqual(connect.await_count, 2)
