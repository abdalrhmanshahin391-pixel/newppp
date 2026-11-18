"""A provider-backed, absolute voice deadline. Never trusts browser clocks or durations."""
from __future__ import annotations
import asyncio
import os
import re
import time
from datetime import datetime
from urllib.parse import urlsplit


def deadline_seconds(grant: dict, now: float | None = None) -> float:
    now = time.time() if now is None else now
    if not re.fullmatch(r"uzq-[0-9a-f]{32}", str(grant.get("roomName", ""))):
        raise ValueError("invalid_quota_room")
    expires = datetime.fromisoformat(str(grant.get("deadline", "")).replace("Z", "+00:00")).timestamp()
    remaining = expires - now
    if remaining <= 0 or remaining > 3601:
        raise ValueError("invalid_quota_deadline")
    return remaining


def control_url(value: str) -> str:
    url = urlsplit(value)
    host = url.hostname or ""
    if url.scheme != "https" or url.username or url.password or url.port not in (None,443) or not (host in {"ritajet.com", "www.ritajet.com"}):
        raise ValueError("invalid_quota_control_origin")
    if url.path != "/api/rita-v3/session/end" or url.query or url.fragment:
        raise ValueError("invalid_quota_control_path")
    return value


async def control(grant: dict, action: str, **kwargs):
    import aiohttp
    url = control_url(str(grant.get("controlUrl", "")))
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=12)) as http:
        async with http.post(url, json={"sessionId":grant["sessionId"],"action":action,**kwargs}, headers={"Authorization":"Bearer "+os.environ["RITA_MODAL_TOKEN"],"x-uzyra-voice-control":"1"}) as response:
            if response.status != 200:
                raise RuntimeError("quota_control_rejected")
            result = await response.json()
            if result.get("quotaProtocol") != 1:
                raise RuntimeError("quota_control_version")
            return result


async def delete_room(room_name: str):
    import aiohttp
    if not re.fullmatch(r"uzq-[0-9a-f]{32}",room_name):
        raise ValueError("invalid_quota_room")
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=12)) as http:
        async with http.delete("https://api.daily.co/v1/rooms/"+room_name, headers={"Authorization":"Bearer "+os.environ["DAILY_API_KEY"]}) as response:
            if response.status not in (200,404):
                raise RuntimeError("quota_room_stop_unconfirmed")


async def run_with_deadline(run, cancel, grant: dict):
    """Independent expiry closes the room before cancellation; Daily also enforces expiry itself."""
    duration = deadline_seconds(grant)
    running = asyncio.create_task(run())
    timer = asyncio.create_task(asyncio.sleep(duration))
    try:
        done, _ = await asyncio.wait({running,timer},return_when=asyncio.FIRST_COMPLETED)
        if running in done:
            await running
        else:
            # Eject access first. A blocked pipeline cancellation must not extend a call.
            try:
                await delete_room(grant["roomName"])
            finally:
                try:
                    await asyncio.wait_for(cancel(), timeout=3)
                except (TimeoutError, asyncio.CancelledError):
                    pass
    finally:
        timer.cancel()
        running.cancel()
        try:
            await asyncio.wait_for(asyncio.gather(running,return_exceptions=True),timeout=3)
        except (TimeoutError,asyncio.CancelledError):
            pass
        # Refund is authorized only after provider access is gone. A failed cleanup keeps the hold.
        try:
            await delete_room(grant["roomName"])
            await control(grant,"settle")
        except Exception:
            pass
