"""Modal deployment for the Rita realtime voice worker.

A warm, memory-snapshotted container removes the multi-second cold start of the
Pipecat Cloud worker. The website calls `start_session`; it creates the Daily room,
spawns the bot in the background and returns the room credentials immediately, so the
learner joins the room while Rita is still connecting.

Deploy: `modal deploy voice-agent/modal_app.py` (from the repository root).
Secret `ritajet-voice` must contain SONIOX_API_KEY, GROQ_API_KEY, GOOGLE_API_KEY,
DAILY_API_KEY and RITA_MODAL_TOKEN (shared with the website as MODAL_START_TOKEN).
"""

from __future__ import annotations

import hmac
import os
import time
import uuid
from typing import Any

import modal

APP_NAME = "ritajet-voice"
SECRET_NAME = "ritajet-voice"
ROOM_LIFETIME_SECS = 60 * 60
DAILY_API = "https://api.daily.co/v1"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "pipecat-ai[daily,groq,runner,silero,soniox]==0.0.105",
        "google-genai[aiohttp]>=2.25.0,<3",
        "python-dotenv>=1.1.0,<2",
        "fastapi[standard]",
    )
    .add_local_python_source(
        "bot", "rita_gemini_tts", "rita_interruption", "rita_latency", "rita_state"
    )
)

app = modal.App(APP_NAME, image=image)
secrets = [modal.Secret.from_name(SECRET_NAME)]


@app.cls(
    secrets=secrets,
    min_containers=1,
    scaledown_window=300,
    timeout=ROOM_LIFETIME_SECS + 300,
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=6)
class RitaWorker:
    @modal.enter(snap=True)
    def preload(self) -> None:
        """Runs once before the snapshot: heavy imports and model files, no sockets."""
        import bot  # noqa: F401  (imports pipecat, google-genai and every provider module)
        from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
        from pipecat.audio.vad.silero import SileroVADAnalyzer

        SileroVADAnalyzer()
        LocalSmartTurnAnalyzerV3()

    @modal.method()
    async def run_session(
        self, room_url: str, token: str, session_id: str, body: dict[str, Any]
    ) -> None:
        import bot

        await bot.run_bot(room_url=room_url, token=token, session_id=session_id, body=body)


async def _daily_post(session, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ["DAILY_API_KEY"].strip()
    async with session.post(
        f"{DAILY_API}{path}",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
    ) as response:
        data = await response.json()
        if response.status >= 400:
            raise RuntimeError(f"Daily {path} failed with HTTP {response.status}")
        return data


@app.function(secrets=secrets, min_containers=1, scaledown_window=300)
@modal.fastapi_endpoint(method="POST", docs=False)
async def start_session(payload: dict[str, Any]):
    """Create a Daily room, start Rita in the background and return the learner's token."""
    import aiohttp
    from fastapi import HTTPException

    expected = os.environ.get("RITA_MODAL_TOKEN", "").strip()
    supplied = str(payload.get("token") or "").strip()
    if not expected or not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="unauthorized")

    body = payload.get("body") if isinstance(payload.get("body"), dict) else {}
    session_id = str(body.get("appSessionId") or uuid.uuid4())
    expires = int(time.time()) + ROOM_LIFETIME_SECS

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as http:
        room = await _daily_post(
            http,
            "/rooms",
            {
                "privacy": "private",
                "properties": {"exp": expires, "eject_at_room_exp": True, "max_participants": 2},
            },
        )
        learner = await _daily_post(
            http,
            "/meeting-tokens",
            {"properties": {"room_name": room["name"], "exp": expires, "is_owner": False}},
        )
        bot_token = await _daily_post(
            http,
            "/meeting-tokens",
            {"properties": {"room_name": room["name"], "exp": expires, "is_owner": True}},
        )

    call = await RitaWorker().run_session.spawn.aio(
        room["url"], bot_token["token"], session_id, body
    )
    return {
        "dailyRoom": room["url"],
        "dailyToken": learner["token"],
        "sessionId": call.object_id,
    }
