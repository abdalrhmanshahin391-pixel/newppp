"""Provider API is fully mocked; these tests create no calls, tokens or rooms."""
import asyncio
import sys
import time
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
import modal_app


class FakeHttp:
    async def __aenter__(self): return self
    async def __aexit__(self, *_): pass


def fixture():
    session="00000000-0000-4000-8000-000000000001"
    room="uzq-"+session.replace("-","")
    grant={"sessionId":session,"roomName":room,"deadline":datetime.fromtimestamp(time.time()+60,timezone.utc).isoformat(),"controlUrl":"https://ritajet.com/api/rita-v3/session/end"}
    body={"mode":"free_conversation","appSessionId":session,"freeTalk":grant}
    http=SimpleNamespace(ClientSession=lambda **_:FakeHttp(),ClientTimeout=lambda **_:None)
    worker=SimpleNamespace(run_session=SimpleNamespace(spawn=SimpleNamespace(aio=AsyncMock(return_value=SimpleNamespace(object_id="test-call")))))
    return body,grant,http,worker


def test_room_and_both_tokens_use_the_same_trusted_deadline():
    async def scenario():
        body,grant,http,worker=fixture()
        daily=AsyncMock(side_effect=[{"name":grant["roomName"],"url":"https://example.invalid/test"},{"token":"test-learner"},{"token":"test-bot"}])
        control=AsyncMock(side_effect=[{"grant":grant},{"bound":True}])
        with patch.dict(sys.modules,{"aiohttp":http}),patch("modal_app._daily_post",daily),patch("modal_app.RitaWorker",return_value=worker),patch("free_talk_guard.control",control):
            result=await modal_app._create_session(body)
        properties=[c.args[2]["properties"] for c in daily.await_args_list]
        assert properties[0]["eject_at_room_exp"] is True
        assert all(p["exp"]==properties[0]["exp"] for p in properties)
        assert all(p["eject_at_token_exp"] for p in properties[1:])
        assert properties[0]["max_participants"]==2
        assert properties[1]["is_owner"] is False
        assert result["quotaEnforced"] is True
        assert [c.args[1] for c in control.await_args_list]==["claim","bind"]
    asyncio.run(scenario())


def test_failed_bind_stops_worker_and_room_before_settling():
    async def scenario():
        body,grant,http,worker=fixture()
        control=AsyncMock(side_effect=[{"grant":grant},{"bound":False},{"settled":True}])
        stop=AsyncMock()
        with patch.dict(sys.modules,{"aiohttp":http}),patch("modal_app._daily_post",AsyncMock(side_effect=[{"name":grant["roomName"],"url":"https://example.invalid/test"},{"token":"fixture"},{"token":"fixture"}])),patch("modal_app.RitaWorker",return_value=worker),patch("free_talk_guard.control",control),patch("modal_app._stop_quota_session",stop):
            with pytest.raises(RuntimeError,match="free_talk_start_cancelled"):
                await modal_app._create_session(body)
        stop.assert_awaited_once()
        assert control.await_args_list[-1].args[1]=="settle"
    asyncio.run(scenario())


def test_failed_cleanup_does_not_refund_or_return_credentials():
    async def scenario():
        body,grant,http,worker=fixture()
        control=AsyncMock(side_effect=[{"grant":grant},{"bound":False}])
        with patch.dict(sys.modules,{"aiohttp":http}),patch("modal_app._daily_post",AsyncMock(side_effect=[{"name":grant["roomName"],"url":"https://example.invalid/test"},{"token":"fixture"},{"token":"fixture"}])),patch("modal_app.RitaWorker",return_value=worker),patch("free_talk_guard.control",control),patch("modal_app._stop_quota_session",AsyncMock(side_effect=RuntimeError("provider_unavailable"))):
            with pytest.raises(RuntimeError): await modal_app._create_session(body)
        assert control.await_count==2
    asyncio.run(scenario())


def test_missing_lease_cannot_create_a_free_call():
    async def scenario():
        _,_,http,_=fixture()
        daily=AsyncMock()
        with patch.dict(sys.modules,{"aiohttp":http}),patch("modal_app._daily_post",daily):
            with pytest.raises(RuntimeError,match="free_talk_lease_required"):
                await modal_app._create_session({"mode":"free_conversation"})
        daily.assert_not_awaited()
    asyncio.run(scenario())
