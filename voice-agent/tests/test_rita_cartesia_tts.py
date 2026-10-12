import asyncio
import json
from unittest.mock import AsyncMock, Mock

from rita_cartesia_tts import RitaCartesiaTTSService


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
