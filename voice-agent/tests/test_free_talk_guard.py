import asyncio
import time
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from free_talk_guard import control_url, deadline_seconds, run_with_deadline


def grant(seconds=0.03):
    return {"sessionId":"123", "roomName":"uzq-"+"a"*32, "deadline":datetime.fromtimestamp(time.time()+seconds, timezone.utc).isoformat()}


def test_rejects_expired_overlong_and_forged_rooms():
    for data in [grant(-1), grant(4000), {**grant(),"roomName":"someone-elses-room"}]:
        with pytest.raises(ValueError):
            deadline_seconds(data)


def test_control_accepts_only_our_https_endpoint():
    for origin in ["https://ritajet.com", "https://www.ritajet.com"]:
        assert control_url(origin+"/api/rita-v3/session/end")
    for url in ["https://untrusted.lovable.app/api/rita-v3/session/end","https://unrelated.lovable.app/api/rita-v3/session/end","http://ritajet.com/api/rita-v3/session/end", "https://ritajet.com.attacker.test/api/rita-v3/session/end", "https://ritajet.com/other", "https://user:password@ritajet.com/api/rita-v3/session/end", "https://ritajet.com:8080/api/rita-v3/session/end", "https://ritajet.com/api/rita-v3/session/end?redirect=1"]:
        with pytest.raises(ValueError):
            control_url(url)


def test_deadline_ejects_before_cancelling_and_then_settles():
    async def scenario():
        events=[]
        async def run():
            await asyncio.Event().wait()
        async def stop():
            events.append("cancel")
        async def remove(_):
            events.append("eject")
        async def settle(*_):
            events.append("settle")
        with patch("free_talk_guard.delete_room",side_effect=remove), patch("free_talk_guard.control",side_effect=settle):
            await asyncio.wait_for(run_with_deadline(run,stop,grant()), 1)
        assert events[0:2]==["eject","cancel"]
        assert events[-1]=="settle"
    asyncio.run(scenario())


def test_failed_provider_cleanup_never_refunds():
    async def scenario():
        settle=AsyncMock()
        with patch("free_talk_guard.delete_room",side_effect=RuntimeError("network")),patch("free_talk_guard.control",settle):
            with pytest.raises(RuntimeError):
                await run_with_deadline(lambda: asyncio.Event().wait(),AsyncMock(),grant())
        settle.assert_not_called()
    asyncio.run(scenario())


def test_early_worker_exit_closes_provider_before_refund():
    async def scenario():
        events=[]
        async def remove(_): events.append("eject")
        async def settle(*_): events.append("settle")
        with patch("free_talk_guard.delete_room",side_effect=remove),patch("free_talk_guard.control",side_effect=settle):
            await run_with_deadline(AsyncMock(),AsyncMock(),grant(30))
        assert events==["eject","settle"]
    asyncio.run(scenario())
