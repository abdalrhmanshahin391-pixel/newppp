import asyncio
import json
from unittest.mock import AsyncMock, Mock, patch

from rita_cartesia_tts import RitaCartesiaTTSService


def _connection_service():
    service = object.__new__(RitaCartesiaTTSService)
    service._websocket = None
    service._api_key = "synthetic-test-key"
    service._url = "wss://example.invalid/tts"
    service._cartesia_version = "2026-08-14"
    service._latency_recorder = Mock()
    service._call_event_handler = AsyncMock()
    service.push_error = AsyncMock()
    return service


def test_cartesia_retries_transient_handshake_before_reporting_error():
    service = _connection_service()
    socket = Mock()
    connect = AsyncMock(side_effect=[TimeoutError("opening handshake"), socket])
    with patch("rita_cartesia_tts.websocket_connect", connect):
        asyncio.run(service._connect_websocket())
    assert service._websocket is socket
    assert connect.await_count == 2
    assert connect.call_args.kwargs["open_timeout"] == 15
    service.push_error.assert_not_awaited()
    service._call_event_handler.assert_awaited_once_with("on_connected")


def test_cartesia_final_failure_is_named_and_does_not_expose_provider_credentials():
    service = _connection_service()
    connect = AsyncMock(side_effect=TimeoutError("opening handshake ?api_key=private"))
    with patch("rita_cartesia_tts.websocket_connect", connect):
        asyncio.run(service._connect_websocket())
    assert service._websocket is None
    assert connect.await_count == 2
    service.push_error.assert_awaited_once()
    message = service.push_error.call_args.kwargs["error_msg"]
    assert "Cartesia" in message
    assert "timeout" in message
    assert "private" not in message
    service._call_event_handler.assert_awaited_once_with("on_connection_error", "timeout")


def test_turn_language_is_conservative_and_never_switches_to_an_unknown_locale():
    service = object.__new__(RitaCartesiaTTSService)
    service._rita_language = "ar"

    service.set_turn_language("de")
    assert service._rita_language == "de"

    service.set_turn_language("en")
    assert service._rita_language == "en"

    service.set_turn_language("automatic")
    assert service._rita_language == "ar"


def _message_service(*messages: dict) -> RitaCartesiaTTSService:
    service = object.__new__(RitaCartesiaTTSService)

    async def websocket_messages():
        for message in messages:
            yield json.dumps(message)

    service._get_websocket = websocket_messages
    service.audio_context_available = Mock(return_value=True)
    service.stop_ttfb_metrics = AsyncMock()
    service.add_word_timestamps = AsyncMock()
    service.remove_audio_context = AsyncMock()
    service.append_to_audio_context = AsyncMock()
    service.push_frame = AsyncMock()
    service.stop_all_metrics = AsyncMock()
    service.push_error = AsyncMock()
    service.reset_active_audio_context = Mock()
    return service


def test_flush_done_is_a_boundary_acknowledgement_not_a_terminal_event():
    service = _message_service(
        {
            "type": "flush_done",
            "context_id": "turn-1",
            "status_code": 206,
            "done": False,
            "flush_id": "flush-1",
        }
    )

    asyncio.run(service._process_messages())

    service.push_error.assert_not_awaited()
    service.stop_ttfb_metrics.assert_not_awaited()
    service.add_word_timestamps.assert_not_awaited()
    service.remove_audio_context.assert_not_awaited()
    service.push_frame.assert_not_awaited()


def test_done_after_flush_done_still_closes_the_same_context_once():
    service = _message_service(
        {"type": "flush_done", "context_id": "turn-1", "done": False},
        {"type": "done", "context_id": "turn-1"},
    )

    asyncio.run(service._process_messages())

    service.push_error.assert_not_awaited()
    service.stop_ttfb_metrics.assert_awaited_once_with()
    service.add_word_timestamps.assert_awaited_once_with(
        [("TTSStoppedFrame", 0), ("Reset", 0)], "turn-1"
    )
    service.remove_audio_context.assert_awaited_once_with("turn-1")


def test_cartesia_error_keeps_pipecat_0105_failure_semantics():
    service = _message_service(
        {"type": "error", "context_id": "turn-1", "message": "synthetic failure"}
    )

    asyncio.run(service._process_messages())

    service.push_frame.assert_awaited_once()
    service.stop_all_metrics.assert_awaited_once_with()
    service.push_error.assert_awaited_once()
    service.reset_active_audio_context.assert_called_once_with()
