"""Measure choppy Cartesia speech: interior silent gaps for token versus word versus sentence input.

Run: `modal run voice-agent/modal_cartesia_chop.py`

Streams the same reply to one warm Cartesia WebSocket in several shapes (sub-word
fragments like an LLM emits, whole words, one sentence at a time, one blob) with
several max_buffer_delay_ms values, then counts silent gaps *inside* the speech.
Natural speech has few; per-fragment synthesis produces many. Only numbers are
printed; no audio or transcript leaves Modal.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import statistics
import time
import uuid
from array import array
from typing import Any

import modal

image = modal.Image.debian_slim(python_version="3.12").pip_install("aiohttp>=3.9")
app = modal.App("ritajet-cartesia-chop", image=image)
secrets = [modal.Secret.from_name("ritajet-voice")]

WS_URL = "wss://api.cartesia.ai/tts/websocket"
VERSION = "2026-08-14"
MODEL = "sonic-3.6"
VOICE = "64a941ac-07ac-462c-a81c-008e353dd83e"
RATE = 24_000
FRAME_MS = 10
SILENCE_RMS = 120  # int16 RMS under which a 10 ms frame counts as silent
MIN_GAP_MS = 70  # interior silence at least this long reads as a stutter

TEXTS = {
    "ar": "أهلاً! أنا ريتا، سعيدة إني بحكي معك. كيف حالك اليوم؟ شو بدك نتدرب عليه؟",
    "en": "Hello! I'm doing great, thank you for asking. What would you like to practise today?",
}
LANG_TAG = {"ar": "ar", "en": "en"}

# (name, shaper, buffer_ms)
VARIANTS: list[tuple[str, str, int | None]] = [
    ("fragments_buf0 (current)", "fragments", 0),
    ("fragments_buf30", "fragments", 30),
    ("fragments_buf50", "fragments", 50),
    ("fragments_buf100", "fragments", 100),
    ("fragments_buf150", "fragments", 150),
    ("fragments_buf250", "fragments", 250),
    ("fragments_default", "fragments", None),
    ("words_buf0", "words", 0),
    ("words_buf100", "words", 100),
    ("clauses_buf0", "clauses", 0),
    ("sentence_buf0", "sentences", 0),
    ("whole_once", "whole", 0),
]


def shape(text: str, mode: str) -> list[str]:
    if mode == "whole":
        return [text]
    if mode == "sentences":
        parts = re.findall(r".+?(?:[.!?؟]+\s*|$)", text)
        return [p for p in parts if p]
    if mode == "clauses":
        parts = re.findall(r".+?(?:[.!?؟,،]+\s*|$)", text)
        return [p for p in parts if p]
    if mode == "words":
        return re.findall(r"\S+\s*", text)
    # fragments: split each word into ~3 character pieces like a sub-word tokenizer
    pieces: list[str] = []
    for word in re.findall(r"\S+\s*", text):
        core = word.rstrip()
        tail = word[len(core):]
        chunks = [core[i : i + 3] for i in range(0, len(core), 3)] or [core]
        chunks[-1] += tail
        pieces.extend(chunks)
    return pieces


def analyse(pcm: bytes) -> dict[str, Any]:
    samples = array("h")
    samples.frombytes(pcm[: len(pcm) // 2 * 2])
    frame = RATE * FRAME_MS // 1000
    flags: list[bool] = []
    for start in range(0, len(samples) - frame + 1, frame):
        window = samples[start : start + frame]
        rms = (sum(s * s for s in window) / frame) ** 0.5
        flags.append(rms >= SILENCE_RMS)
    if True not in flags:
        return {"audio_ms": 0, "gaps": 0, "gap_total_ms": 0, "longest_gap_ms": 0}
    first = flags.index(True)
    last = len(flags) - 1 - flags[::-1].index(True)
    gaps: list[int] = []
    run = 0
    for flag in flags[first : last + 1]:
        if flag:
            if run * FRAME_MS >= MIN_GAP_MS:
                gaps.append(run * FRAME_MS)
            run = 0
        else:
            run += 1
    return {
        "audio_ms": (last - first + 1) * FRAME_MS,
        "gaps": len(gaps),
        "gap_total_ms": sum(gaps),
        "longest_gap_ms": max(gaps) if gaps else 0,
    }


async def synth(session: Any, lang: str, pieces: list[str], buffer_ms: int | None) -> dict[str, Any]:
    import aiohttp

    context_id = uuid.uuid4().hex

    async with session.ws_connect(
        f"{WS_URL}?cartesia_version={VERSION}",
        headers={"X-API-Key": os.environ["CARTESIA_API_KEY"]},
    ) as ws:
        started = time.perf_counter()  # after connect: measures text-to-audio, like a warm socket

        def message(text: str, more: bool) -> dict[str, Any]:
            body: dict[str, Any] = {
                "transcript": text,
                "continue": more,
                "context_id": context_id,
                "model_id": MODEL,
                "voice": {"mode": "id", "id": VOICE},
                "output_format": {"container": "raw", "encoding": "pcm_s16le", "sample_rate": RATE},
                "language": LANG_TAG[lang],
            }
            if buffer_ms is not None:
                body["max_buffer_delay_ms"] = buffer_ms
            return body

        # ~5 ms between tokens: Groq streams a few hundred tokens a second.
        for piece in pieces:
            await ws.send_json(message(piece, True))
            await asyncio.sleep(0.005)
        await ws.send_json(message("", False))

        pcm = bytearray()
        first_chunk_ms: float | None = None
        while True:
            msg = await asyncio.wait_for(ws.receive(), timeout=20)
            if msg.type is not aiohttp.WSMsgType.TEXT:
                raise RuntimeError(f"ws_{msg.type.name}")
            payload = json.loads(msg.data)
            if payload.get("context_id") != context_id:
                continue
            kind = payload.get("type")
            if kind == "chunk":
                if first_chunk_ms is None:
                    first_chunk_ms = (time.perf_counter() - started) * 1000
                pcm.extend(base64.b64decode(payload["data"]))
            elif kind == "done":
                break
            elif kind == "error":
                raise RuntimeError("cartesia_error")

    result = analyse(bytes(pcm))
    result["first_chunk_ms"] = round(first_chunk_ms or 0)
    return result


@app.function(secrets=secrets, timeout=600, region="eu")
async def run() -> list[dict[str, Any]]:
    import aiohttp

    rows: list[dict[str, Any]] = []
    only = {n.strip() for n in os.environ.get("CHOP_ONLY", "").split(",") if n.strip()}
    repeats = int(os.environ.get("CHOP_RUNS", "3"))
    async with aiohttp.ClientSession() as session:
        for lang, text in TEXTS.items():
            for name, mode, buffer_ms in VARIANTS:
                if only and name.split(" ")[0] not in only:
                    continue
                runs = []
                for _ in range(repeats):
                    try:
                        runs.append(await synth(session, lang, shape(text, mode), buffer_ms))
                    except aiohttp.WSServerHandshakeError as exc:
                        # Status only: the exception text carries the request URL.
                        return [{"error": f"handshake_status_{exc.status}", "after_rows": len(rows)}]
                rows.append(
                    {
                        "lang": lang,
                        "variant": name,
                        "pieces": len(shape(text, mode)),
                        "first_chunk_ms": round(statistics.median(r["first_chunk_ms"] for r in runs)),
                        "audio_ms": round(statistics.median(r["audio_ms"] for r in runs)),
                        "gaps": round(statistics.median(r["gaps"] for r in runs), 1),
                        "gap_total_ms": round(statistics.median(r["gap_total_ms"] for r in runs)),
                        "longest_gap_ms": round(statistics.median(r["longest_gap_ms"] for r in runs)),
                    }
                )
    return rows


@app.local_entrypoint()
def main() -> None:
    rows = run.remote()
    if rows and "error" in rows[0]:
        print(rows)
        return
    header = f"{'lang':4} {'variant':26} {'pieces':>6} {'ttfa':>6} {'audio':>6} {'gaps':>5} {'gap_ms':>7} {'max':>5}"
    print(header)
    for r in rows:
        print(
            f"{r['lang']:4} {r['variant']:26} {r['pieces']:>6} {r['first_chunk_ms']:>6} "
            f"{r['audio_ms']:>6} {r['gaps']:>5} {r['gap_total_ms']:>7} {r['longest_gap_ms']:>5}"
        )
