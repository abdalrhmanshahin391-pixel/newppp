"""Uzyra's short spoken lines for the study circle, recorded once with her call voice.

Every action in the circle (lessons and books) has two short lines in Jordanian Arabic that
play the moment its result shows ("the cards are ready"), never the content itself. They are
made once with Cartesia (the same Layan voice and model as the live call) and kept as files in
the site (`public/sounds/uzyra/<action>-<n>.mp3`), so nothing is generated while learners use it.

Make them again: Actions > Rita content probe > Run workflow with task "voice-lines" on a branch;
the workflow writes the files and commits them to that branch.
"""

from __future__ import annotations

import asyncio
import base64
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
}


def line_files() -> list[tuple[str, str]]:
    """(file name, text) for every line, in a fixed order."""

    return [
        (f"{action}-{index + 1}.mp3", text)
        for action, texts in LINES.items()
        for index, text in enumerate(texts)
    ]


async def render_lines(api_key: str) -> dict[str, Any]:
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
        for name, text in line_files():
            body = {
                "model_id": MODEL,
                "transcript": text,
                "voice": {"mode": "id", "id": VOICE_ID},
                "output_format": {
                    "container": "mp3",
                    "sample_rate": 44100,
                    "bit_rate": 96000,
                },
                "language": "ar",
                "generation_config": {"speed": 1, "volume": 1},
            }
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
