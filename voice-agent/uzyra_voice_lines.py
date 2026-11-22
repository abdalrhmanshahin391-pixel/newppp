"""Uzyra's short spoken lines for the study circle, recorded once with her call voice.

Every action in the circle (lessons and books) has two short lines in Jordanian Arabic that
play the moment its result shows ("the cards are ready"), never the content itself. They are
made once with Cartesia (the same Layan voice and model as the live call) and kept as files in
the site (`public/sounds/uzyra/<action>-<n>.mp3`), so nothing is generated while learners use it.

Make them again: Actions > Rita content probe > Run workflow with task "voice-lines" on a branch;
the workflow writes the files and commits them to that branch. "only" (action names, comma
separated) records just those actions, so the lines already in the site keep their takes.
"""

from __future__ import annotations

import asyncio
import base64
import os
from typing import Any

MODEL = "sonic-3.6"
VOICE_ID = "64a941ac-07ac-462c-a81c-008e353dd83e"
CARTESIA_VERSION = "2026-08-14"

# action -> its lines. Kept short (one or two seconds), with no "you" endings that would
# need a masculine or feminine form, and never reading the answer itself.
LINES: dict[str, tuple[str, ...]] = {
    "make_cards": ("البطاقات جاهزة.", "تمام، البطاقات جاهزة. يلّا نبلّش."),
    "make_mcq": ("الأسئلة جاهزة.", "تمام، الأسئلة جاهزة. خلّينا نشوف."),
    "explain": ("هاي الفكرة ببساطة.", "خلّيني أوضّحها."),
    "meaning": ("هاد معناها، وهيك بتنلفظ.", "المعنى والنطق جاهزين."),
    "word_by_word": ("هاي الجملة، جزء جزء.", "فكّكت الجملة."),
    "why_form": ("هاد السبب.", "في سبب حلو، خلّيني أوضّحه."),
    "compare_arabic": ("هيك بتنقال بالعربي.", "قارنتها بالعربي."),
    "simplify": ("هاد مثال بسيط.", "بسّطتها بمثال."),
    "common_mistake": ("هاي غلطة كثير ناس بيقعوا فيها.", "هون الغلطة الشائعة."),
    "summarize_section": ("هاد الملخّص.", "لخّصت القسم."),
    "explain_reply": ("بشكل أبسط.", "خلّيني أبسّطها أكثر."),
    "report": ("وصلت الملاحظة، شكراً.", "سجّلت الملاحظة، شكراً."),
    "translate": ("هاي الترجمة.", "ترجمتها كاملة."),
}


def only_actions(only: str = "") -> set[str]:
    """The actions named in "only" (comma separated); every action when it is empty."""

    named = {part.strip() for part in only.split(",") if part.strip()}
    unknown = named - set(LINES)
    if unknown:
        raise ValueError(f"unknown actions: {', '.join(sorted(unknown))}")
    return named or set(LINES)


def line_files(only: str = "") -> list[tuple[str, str]]:
    """(file name, text) for every line (or only those actions' lines), in a fixed order."""

    wanted = only_actions(only)
    return [
        (f"{action}-{index + 1}.mp3", text)
        for action, texts in LINES.items()
        if action in wanted
        for index, text in enumerate(texts)
    ]


def _speech_body(text: str, language: str, voice_id: str) -> dict[str, Any]:
    return {
        "model_id": MODEL,
        "transcript": text,
        "voice": {"mode": "id", "id": voice_id},
        "output_format": {
            "container": "mp3",
            "sample_rate": 44100,
            "bit_rate": 96000,
        },
        "language": language,
        "generation_config": {"speed": 1, "volume": 1},
    }


async def narrate_board_step(text: str, language: str) -> str | None:
    """One authorized whiteboard step, spoken with the live tutor's voice."""
    import aiohttp

    key = os.environ.get("CARTESIA_API_KEY", "").strip()
    if not key:
        return None
    headers = {"Cartesia-Version": CARTESIA_VERSION, "X-API-Key": key}
    voice = os.environ.get("RITA_CARTESIA_VOICE_ID") or VOICE_ID
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=12)) as http:
        async with http.post("https://api.cartesia.ai/tts/bytes", headers=headers,
                             json=_speech_body(text, language, voice)) as response:
            if response.status != 200:
                return None
            audio = await response.read()
            return base64.b64encode(audio).decode("ascii") if 0 < len(audio) <= 1_000_000 else None


async def render_lines(api_key: str, only: str = "") -> dict[str, Any]:
    """Every line as MP3 (base64), made with Uzyra's call voice; never returns the key."""

    import aiohttp

    headers = {
        "Cartesia-Version": CARTESIA_VERSION,
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    }
    files: dict[str, str] = {}
    problems: list[str] = []
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60)) as http:
        for name, text in line_files(only):
            body = _speech_body(text, "ar", VOICE_ID)
            for attempt in range(3):
                async with http.post(
                    "https://api.cartesia.ai/tts/bytes", headers=headers, json=body
                ) as response:
                    audio = await response.read()
                    if response.status == 200 and len(audio) > 1000:
                        files[name] = base64.b64encode(audio).decode("ascii")
                        break
                    if attempt == 2:
                        problems.append(f"{name}: HTTP {response.status}")
                await asyncio.sleep(1 + attempt)
    return {"files": files, "problems": problems, "model": MODEL, "voice_id": VOICE_ID}
