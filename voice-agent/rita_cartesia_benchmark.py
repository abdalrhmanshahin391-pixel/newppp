"""Bounded Cartesia WebSocket TTFA benchmark for Rita.

The benchmark intentionally bypasses Daily, Soniox, Groq, and Pipecat.  It
measures one thing only: first text sent on an already-open Cartesia WebSocket
to first audio chunk / first non-silent PCM from the same monotonic clock.
Audio, transcripts, and credentials are never returned or logged.
"""

from __future__ import annotations

import asyncio
import base64
import itertools
import json
import math
import os
import re
import statistics
import time
import unicodedata
import uuid
from array import array
from typing import Any

from rita_leading_silence import LeadingSilenceTrimmer

CARTESIA_WS_URL = "wss://api.cartesia.ai/tts/websocket"
CARTESIA_VERSION = "2026-08-14"
MODEL_ID = "sonic-3.6"
VOICE_ID = "64a941ac-07ac-462c-a81c-008e353dd83e"
SAMPLE_RATE = 24_000
BUFFER_DELAYS: tuple[int | None, ...] = (None, 0, 50, 100, 200)
TOKEN_DELAY_SECS = 0.015
SAMPLES_PER_LANGUAGE = 3
TRIM_PREROLL_CANDIDATES = (20, 30, 40)
TRIM_REQUIRED_SAFETY_MARGIN_MS = 20.0
ENERGY_THRESHOLDS: tuple[tuple[int, int], ...] = (
    (2, 8),
    (4, 16),
    (8, 32),
    (16, 64),
    (32, 128),
    (64, 256),
    (125, 500),
    (250, 1000),
)
SONIOX_STT_URL = "wss://stt-rt.eu.soniox.com/transcribe-websocket"
TRIM_THRESHOLD_CANDIDATES: tuple[tuple[int, int], ...] = (
    (8, 32),
    (16, 64),
    (32, 128),
    (64, 256),
    (125, 500),
)


class CartesiaBenchmarkError(RuntimeError):
    """Provider failure carrying only a safe machine-readable error code."""

    def __init__(self, code: str):
        super().__init__("cartesia_benchmark_error")
        self.code = code[:80]

TOKEN_STREAMS: dict[str, tuple[str, ...]] = {
    "ar": ("يسعدني ", "أساعدك ", "اليوم."),
    "de": ("Guten ", "Morgen, ", "wie geht es dir?"),
}

# High-risk first sounds: Arabic and German fricatives, breathy starts,
# plosives, vowels, short utterances, and mixed-language speech. Text and PCM
# stay inside the private benchmark and are never returned or logged.
TRIM_SAFETY_PROMPTS: dict[str, tuple[str, ...]] = {
    "ar": (
        "هلا، كيفك اليوم؟",
        "هذا مثال بسيط.",
        "حلو، خلينا نبدأ.",
        "خليك معي شوي.",
        "سلام، يسعد صباحك.",
        "شوي شوي بتتعلم.",
        "فهمت عليك تمام.",
        "ثواني وبشرحلك.",
        "أنا جاهزة أساعدك.",
        "إيش حابب تتدرب؟",
        "بدي أعطيك مثال.",
        "تفضل، احكي براحتك.",
        "كلمة اليوم سهلة.",
        "ممتاز، كمل هيك.",
        "نعم، جوابك صحيح.",
        "وين بدك نبلش؟",
        "لا، جرّب مرة ثانية.",
        "يسعدلي هالحكي.",
    ),
    "de": (
        "Hallo, wie geht es dir?",
        "Heute lernen wir zusammen.",
        "Freut mich, dich zu sehen.",
        "Fangen wir langsam an.",
        "Sehr gut, mach weiter.",
        "Schön, dass du da bist.",
        "Ich helfe dir gern.",
        "Sicher, das schaffen wir.",
        "Zuerst hören wir genau zu.",
        "Bitte sprich ganz ruhig.",
        "Danke, deine Antwort stimmt.",
        "Komm, wir üben gemeinsam.",
        "Guten Morgen, willkommen.",
        "Nein, versuch es noch einmal.",
        "Leise Töne sind wichtig.",
        "Richtig, das klingt besser.",
        "Was möchtest du lernen?",
        "Übung macht den Meister.",
    ),
    "en": (
        "Hello, let us begin.",
        "Fine, try that again.",
        "She speaks very softly.",
        "Think about the first sound.",
        "Start whenever you are ready.",
        "I can help you today.",
    ),
    "mixed": (
        "هلا، كلمة Hallo معناها مرحبا.",
        "شو معنى Schön بالألماني؟",
        "فهمت كلمة Ich بشكل صحيح.",
        "خلينا نحكي Guten Morgen.",
        "سلام، اليوم بنتعلم Deutsch.",
        "ثواني، كرر كلمة Freund.",
    ),
}


def first_non_silent_sample_ms(
    audio: bytes, sample_rate: int = SAMPLE_RATE, threshold: int = 250
) -> float | None:
    """Return the first audible signed-16 PCM offset without retaining audio."""

    if sample_rate <= 0 or len(audio) < 2:
        return None
    samples = array("h")
    samples.frombytes(audio[: len(audio) - (len(audio) % 2)])
    for index, sample in enumerate(samples):
        if abs(sample) >= threshold:
            return index * 1000 / sample_rate
    return None


def conservative_acoustic_onset_ms(
    audio: bytes,
    *,
    sample_rate: int = SAMPLE_RATE,
    frame_ms: int = 5,
    confirmation_frames: int = 2,
) -> float | None:
    """Find the earliest sustained energy using a near-digital-silence floor."""

    usable = audio[: len(audio) - (len(audio) % 2)]
    samples = array("h")
    samples.frombytes(usable)
    frame_samples = max(1, round(sample_rate * frame_ms / 1000))
    run = 0
    run_start = 0
    for start in range(0, len(samples) - frame_samples + 1, frame_samples):
        window = samples[start : start + frame_samples]
        peak = max(abs(value) for value in window)
        rms = math.sqrt(sum(value * value for value in window) / len(window))
        active = rms >= 2.0 or peak >= 8
        if active:
            if run == 0:
                run_start = start
            run += 1
            if run >= confirmation_frames:
                return run_start * 1000 / sample_rate
        else:
            run = 0
    return None


def acoustic_onset_ms(
    audio: bytes,
    *,
    rms_floor: float,
    peak_floor: int,
    sample_rate: int = SAMPLE_RATE,
    frame_ms: int = 5,
    confirmation_frames: int = 2,
) -> float | None:
    """Return the first sustained frame above an explicit energy floor."""

    usable = audio[: len(audio) - (len(audio) % 2)]
    samples = array("h")
    samples.frombytes(usable)
    frame_samples = max(1, round(sample_rate * frame_ms / 1000))
    run = 0
    run_start = 0
    for start in range(0, len(samples) - frame_samples + 1, frame_samples):
        window = samples[start : start + frame_samples]
        peak = max(abs(value) for value in window)
        rms = math.sqrt(sum(value * value for value in window) / len(window))
        active = rms >= rms_floor or peak >= peak_floor
        if active:
            if run == 0:
                run_start = start
            run += 1
            if run >= confirmation_frames:
                return run_start * 1000 / sample_rate
        else:
            run = 0
    return None


def energy_onset_profile(audio: bytes) -> dict[str, float | None]:
    """Summarize onset across floors without retaining or returning PCM."""

    return {
        f"rms_{rms}_peak_{peak}": acoustic_onset_ms(
            audio, rms_floor=float(rms), peak_floor=peak
        )
        for rms, peak in ENERGY_THRESHOLDS
    }


def _normalized_transcript(tokens: list[str]) -> str:
    text = "".join(tokens).casefold()
    text = "".join(
        character
        for character in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(character)
    )
    return " ".join(re.findall(r"[\w]+", text, flags=re.UNICODE))


async def _soniox_transcribe_pcm(
    audio: bytes, *, api_key: str, language_hints: list[str]
) -> tuple[str, str]:
    """Transcribe synthetic PCM privately; return normalized full/first text."""

    import aiohttp

    headers = {"Authorization": f"Bearer {api_key}"}
    timeout = aiohttp.ClientTimeout(total=30)
    async with (
        aiohttp.ClientSession(timeout=timeout) as session,
        session.ws_connect(SONIOX_STT_URL, headers=headers, heartbeat=20) as websocket,
    ):
        await websocket.send_json(
            {
                "model": "stt-rt-v5",
                "audio_format": "pcm_s16le",
                "sample_rate": SAMPLE_RATE,
                "num_channels": 1,
                "language_hints": language_hints,
                "language_hints_strict": False,
                "enable_endpoint_detection": False,
            }
        )
        # Keep frames realistic and add the 200 ms tail recommended by Soniox
        # before finalization so the comparison itself does not clip speech.
        padded = audio + (b"\x00\x00" * round(SAMPLE_RATE * 0.2))
        for offset in range(0, len(padded), 3840):
            await websocket.send_bytes(padded[offset : offset + 3840])
        await websocket.send_str("")

        final_tokens: list[str] = []
        while True:
            message = await asyncio.wait_for(websocket.receive(), timeout=25)
            if message.type is not aiohttp.WSMsgType.TEXT:
                if message.type in {
                    aiohttp.WSMsgType.CLOSED,
                    aiohttp.WSMsgType.CLOSE,
                }:
                    break
                continue
            payload = json.loads(message.data)
            if payload.get("error_type"):
                raise CartesiaBenchmarkError(
                    f"soniox_{payload.get('error_type', 'provider_error')}"
                )
            for token in payload.get("tokens", []):
                if token.get("is_final") and token.get("text") not in {"<fin>", ""}:
                    final_tokens.append(str(token.get("text", "")))
            if payload.get("finished"):
                break

    normalized = _normalized_transcript(final_tokens)
    first = normalized.split(maxsplit=1)[0] if normalized else ""
    return normalized, first


async def compare_raw_and_trimmed_with_soniox(
    raw: bytes,
    trimmed: bytes,
    *,
    api_key: str,
    language: str,
) -> dict[str, Any]:
    """Return only equivalence signals; never expose transcripts or PCM."""

    hints = ["ar", "de", "en"] if language == "mixed" else [language]
    raw_full, raw_first = await _soniox_transcribe_pcm(
        raw, api_key=api_key, language_hints=hints
    )
    trimmed_full, trimmed_first = await _soniox_transcribe_pcm(
        trimmed, api_key=api_key, language_hints=hints
    )
    return {
        "raw_has_text": bool(raw_full),
        "trimmed_has_text": bool(trimmed_full),
        "first_token_equal": bool(raw_first) and raw_first == trimmed_first,
        "full_text_equal": bool(raw_full) and raw_full == trimmed_full,
    }


def build_ws_message(
    *,
    context_id: str,
    transcript: str,
    language: str,
    continue_transcript: bool,
    max_buffer_delay_ms: int | None,
    add_timestamps: bool = False,
    add_phoneme_timestamps: bool = False,
) -> dict[str, Any]:
    """Build the same raw-PCM Sonic 3.6 request contract used by Rita."""

    message: dict[str, Any] = {
        "transcript": transcript,
        "continue": continue_transcript,
        "context_id": context_id,
        "model_id": MODEL_ID,
        "voice": {"mode": "id", "id": VOICE_ID},
        "output_format": {
            "container": "raw",
            "encoding": "pcm_s16le",
            "sample_rate": SAMPLE_RATE,
        },
        "add_timestamps": False,
        "language": language,
    }
    if max_buffer_delay_ms is not None:
        message["max_buffer_delay_ms"] = max_buffer_delay_ms
    if add_timestamps:
        message["add_timestamps"] = True
    if add_phoneme_timestamps:
        message["add_phoneme_timestamps"] = True
    return message


def evaluate_trim_candidate(
    chunks: list[bytes],
    *,
    first_phoneme_ms: float | None,
    preroll_ms: int,
) -> dict[str, Any]:
    """Evaluate one streaming trim setting without returning provider audio."""

    raw = b"".join(chunks)
    trimmer = LeadingSilenceTrimmer(
        sample_rate=SAMPLE_RATE,
        preroll_ms=preroll_ms,
        max_hold_ms=250,
    )
    trimmed = b"".join(trimmer.process(chunk) for chunk in chunks) + trimmer.finish()
    decision = trimmer.decision
    trimmed_ms = decision.trimmed_ms if decision else 0.0
    expected_offset = round(trimmed_ms * SAMPLE_RATE / 1000) * 2
    exact_suffix = trimmed == raw[expected_offset:]
    safety_margin_ms = (
        first_phoneme_ms - trimmed_ms if first_phoneme_ms is not None else None
    )
    safe = (
        exact_suffix
        and safety_margin_ms is not None
        and safety_margin_ms >= TRIM_REQUIRED_SAFETY_MARGIN_MS
    )
    return {
        "preroll_ms": preroll_ms,
        "bypassed": bool(decision.bypassed) if decision else True,
        "trimmed_ms": round(trimmed_ms, 2),
        "onset_ms": (
            round(decision.onset_ms, 2)
            if decision and decision.onset_ms is not None
            else None
        ),
        "first_phoneme_ms": (
            round(first_phoneme_ms, 2) if first_phoneme_ms is not None else None
        ),
        "safety_margin_ms": (
            round(safety_margin_ms, 2) if safety_margin_ms is not None else None
        ),
        "exact_suffix": exact_suffix,
        "safe": safe,
    }


async def _run_sample(
    websocket: Any,
    *,
    language: str,
    max_buffer_delay_ms: int | None,
    sample_index: int,
    phase: str = "warm",
) -> dict[str, Any]:
    import aiohttp

    context_id = uuid.uuid4().hex
    tokens = TOKEN_STREAMS[language]
    first_text_sent_at = time.perf_counter()

    for token in tokens:
        await websocket.send_json(
            build_ws_message(
                context_id=context_id,
                transcript=token,
                language=language,
                continue_transcript=True,
                max_buffer_delay_ms=max_buffer_delay_ms,
            )
        )
        await asyncio.sleep(TOKEN_DELAY_SECS)

    await websocket.send_json(
        build_ws_message(
            context_id=context_id,
            transcript="",
            language=language,
            continue_transcript=False,
            max_buffer_delay_ms=max_buffer_delay_ms,
        )
    )

    first_chunk_ms: float | None = None
    first_non_silent_ms: float | None = None
    first_audible_playout_estimate_ms: float | None = None
    leading_silence_ms: float | None = None
    completed_ms: float | None = None
    chunk_count = 0
    pcm_bytes = 0
    chunk_times: list[float] = []

    while completed_ms is None:
        message = await asyncio.wait_for(websocket.receive(), timeout=12)
        if message.type is not aiohttp.WSMsgType.TEXT:
            raise RuntimeError(f"unexpected_websocket_message_{message.type.name.lower()}")
        payload = json.loads(message.data)
        if payload.get("context_id") != context_id:
            continue

        message_type = payload.get("type")
        now = time.perf_counter()
        elapsed_ms = (now - first_text_sent_at) * 1000
        if message_type == "chunk":
            audio = base64.b64decode(payload.get("data", ""))
            chunk_count += 1
            pcm_bytes += len(audio)
            chunk_times.append(now)
            if first_chunk_ms is None:
                first_chunk_ms = elapsed_ms
            if first_non_silent_ms is None:
                offset_ms = first_non_silent_sample_ms(audio)
                if offset_ms is not None:
                    # The non-silent bytes arrived with this chunk. Playback
                    # reaches them only after consuming the leading samples,
                    # so expose both facts instead of conflating them.
                    first_non_silent_ms = elapsed_ms
                    leading_silence_ms = offset_ms
                    first_audible_playout_estimate_ms = elapsed_ms + offset_ms
        elif message_type == "done":
            completed_ms = elapsed_ms
        elif message_type == "error":
            # Do not include the provider message; it can echo request details.
            raise RuntimeError("cartesia_context_error")

    gaps_ms = [
        (current - previous) * 1000
        for previous, current in itertools.pairwise(chunk_times)
    ]
    return {
        "phase": phase,
        "language": language,
        "buffer_ms": max_buffer_delay_ms,
        "sample_index": sample_index,
        "first_chunk_ms": round(first_chunk_ms, 2) if first_chunk_ms is not None else None,
        "first_non_silent_pcm_ms": (
            round(first_non_silent_ms, 2) if first_non_silent_ms is not None else None
        ),
        "first_audible_playout_estimate_ms": (
            round(first_audible_playout_estimate_ms, 2)
            if first_audible_playout_estimate_ms is not None
            else None
        ),
        "leading_silence_ms": (
            round(leading_silence_ms, 2) if leading_silence_ms is not None else None
        ),
        "complete_ms": round(completed_ms, 2),
        "chunk_count": chunk_count,
        "pcm_bytes": pcm_bytes,
        "max_inter_chunk_gap_ms": round(max(gaps_ms), 2) if gaps_ms else 0.0,
    }


async def _run_trim_safety_sample(
    websocket: Any,
    *,
    category: str,
    transcript: str,
    sample_index: int,
    soniox_api_key: str | None = None,
    validation_rms_floor: int = 32,
    validation_peak_floor: int = 128,
) -> dict[str, Any]:
    """Generate one private sample and return only trim-safety measurements."""

    import aiohttp

    context_id = uuid.uuid4().hex
    language = "ar" if category == "mixed" else category
    request_phoneme_timestamps = category == "en"
    words = transcript.split()
    first_text_sent_at = time.perf_counter()
    for index, word in enumerate(words):
        token = word if index == len(words) - 1 else f"{word} "
        await websocket.send_json(
            build_ws_message(
                context_id=context_id,
                transcript=token,
                language=language,
                continue_transcript=True,
                max_buffer_delay_ms=0,
                add_timestamps=True,
                add_phoneme_timestamps=request_phoneme_timestamps,
            )
        )
        await asyncio.sleep(TOKEN_DELAY_SECS)
    await websocket.send_json(
        build_ws_message(
            context_id=context_id,
            transcript="",
            language=language,
            continue_transcript=False,
            max_buffer_delay_ms=0,
            add_timestamps=True,
            add_phoneme_timestamps=request_phoneme_timestamps,
        )
    )

    chunks: list[bytes] = []
    first_chunk_ms: float | None = None
    first_phoneme_ms: float | None = None
    first_word_ms: float | None = None
    done = False
    while not done:
        message = await asyncio.wait_for(websocket.receive(), timeout=12)
        if message.type is not aiohttp.WSMsgType.TEXT:
            raise RuntimeError(f"unexpected_websocket_message_{message.type.name.lower()}")
        payload = json.loads(message.data)
        if payload.get("context_id") != context_id:
            continue
        message_type = payload.get("type")
        if message_type == "chunk":
            if first_chunk_ms is None:
                first_chunk_ms = (time.perf_counter() - first_text_sent_at) * 1000
            chunks.append(base64.b64decode(payload.get("data", "")))
        elif message_type == "phoneme_timestamps":
            starts = payload.get("phoneme_timestamps", {}).get("start", [])
            usable = [float(value) * 1000 for value in starts if value is not None]
            if usable:
                value = min(usable)
                first_phoneme_ms = value if first_phoneme_ms is None else min(first_phoneme_ms, value)
        elif message_type == "timestamps":
            starts = payload.get("word_timestamps", {}).get("start", [])
            usable = [float(value) * 1000 for value in starts if value is not None]
            if usable:
                value = min(usable)
                first_word_ms = value if first_word_ms is None else min(first_word_ms, value)
        elif message_type == "done":
            done = True
        elif message_type == "error":
            raise CartesiaBenchmarkError(str(payload.get("error_code") or "provider_error"))

    raw_audio = b"".join(chunks)
    acoustic_onset_ms = conservative_acoustic_onset_ms(raw_audio)
    onset_profile = energy_onset_profile(raw_audio)
    references = [
        value
        for value in (first_phoneme_ms, acoustic_onset_ms)
        if value is not None
    ]
    reference_onset_ms = min(references) if references else first_word_ms
    candidates = [
        evaluate_trim_candidate(
            chunks,
            first_phoneme_ms=reference_onset_ms,
            preroll_ms=preroll_ms,
        )
        for preroll_ms in TRIM_PREROLL_CANDIDATES
    ]
    soniox_validation: dict[str, Any] | None = None
    production_candidate: dict[str, Any] | None = None
    if soniox_api_key:
        trimmer = LeadingSilenceTrimmer(
            sample_rate=SAMPLE_RATE,
            preroll_ms=40,
            max_hold_ms=250,
            low_rms_floor=float(validation_rms_floor),
            low_peak_floor=validation_peak_floor,
        )
        trimmed_audio = b"".join(trimmer.process(chunk) for chunk in chunks)
        trimmed_audio += trimmer.finish()
        decision = trimmer.decision
        production_candidate = {
            "rms_floor": validation_rms_floor,
            "peak_floor": validation_peak_floor,
            "preroll_ms": 40,
            "trimmed_ms": round(decision.trimmed_ms, 2) if decision else 0.0,
            "bypassed": bool(decision.bypassed) if decision else True,
            "exact_suffix": trimmed_audio
            == raw_audio[
                (round((decision.trimmed_ms if decision else 0.0) * SAMPLE_RATE / 1000) * 2) :
            ],
        }
        soniox_validation = await compare_raw_and_trimmed_with_soniox(
            raw_audio,
            trimmed_audio,
            api_key=soniox_api_key,
            language=category,
        )
    return {
        "category": category,
        "sample_index": sample_index,
        "first_chunk_ms": round(first_chunk_ms, 2) if first_chunk_ms is not None else None,
        "timestamp_source": (
            "phoneme+acoustic"
            if first_phoneme_ms is not None and acoustic_onset_ms is not None
            else "acoustic"
            if acoustic_onset_ms is not None
            else "word"
            if first_word_ms is not None
            else None
        ),
        "energy_onset_ms": {
            key: round(value, 2) if value is not None else None
            for key, value in onset_profile.items()
        },
        "first_phoneme_ms": (
            round(first_phoneme_ms, 2) if first_phoneme_ms is not None else None
        ),
        "first_word_ms": round(first_word_ms, 2) if first_word_ms is not None else None,
        "production_candidate": production_candidate,
        "soniox_validation": soniox_validation,
        "candidates": candidates,
    }


def summarize_trim_safety(samples: list[dict[str, Any]]) -> dict[str, Any]:
    """Choose the fastest candidate only when every safety gate passes."""

    candidate_summaries: list[dict[str, Any]] = []
    for preroll_ms in TRIM_PREROLL_CANDIDATES:
        candidates = [
            candidate
            for sample in samples
            for candidate in sample.get("candidates", [])
            if candidate.get("preroll_ms") == preroll_ms
        ]
        missing_reference = sum(
            candidate.get("first_phoneme_ms") is None for candidate in candidates
        )
        unsafe = sum(not candidate.get("safe", False) for candidate in candidates)
        suffix_failures = sum(not candidate.get("exact_suffix", False) for candidate in candidates)
        bypassed = sum(candidate.get("bypassed", True) for candidate in candidates)
        margins = [
            candidate.get("safety_margin_ms")
            for candidate in candidates
            if candidate.get("safety_margin_ms") is not None
        ]
        trimmed = [candidate.get("trimmed_ms") for candidate in candidates]
        candidate_summaries.append(
            {
                "preroll_ms": preroll_ms,
                "samples": len(candidates),
                "missing_reference": missing_reference,
                "unsafe_samples": unsafe,
                "exact_suffix_failures": suffix_failures,
                "bypassed_samples": bypassed,
                "minimum_safety_margin_ms": round(min(margins), 2) if margins else None,
                "median_trimmed_ms": _median(trimmed),
                "qualified": bool(candidates)
                and missing_reference == 0
                and unsafe == 0
                and suffix_failures == 0
                and bypassed / len(candidates) <= 0.05,
            }
        )

    qualified = [item for item in candidate_summaries if item["qualified"]]
    # Maximum safe trimming wins. On an exact tie, prefer more pre-roll.
    winner = max(
        qualified,
        key=lambda item: (item.get("median_trimmed_ms") or 0, item["preroll_ms"]),
        default=None,
    )
    energy_profiles: list[dict[str, Any]] = []
    for rms, peak in ENERGY_THRESHOLDS:
        key = f"rms_{rms}_peak_{peak}"
        values = [
            sample.get("energy_onset_ms", {}).get(key)
            for sample in samples
            if sample.get("energy_onset_ms", {}).get(key) is not None
        ]
        energy_profiles.append(
            {
                "rms_floor": rms,
                "peak_floor": peak,
                "samples_with_onset": len(values),
                "minimum_onset_ms": round(min(values), 2) if values else None,
                "median_onset_ms": _median(values),
                "maximum_onset_ms": round(max(values), 2) if values else None,
            }
        )
    english_phoneme_gates: list[dict[str, Any]] = []
    english_samples = [
        sample
        for sample in samples
        if sample.get("category") == "en" and sample.get("first_phoneme_ms") is not None
    ]
    for rms, peak in TRIM_THRESHOLD_CANDIDATES:
        key = f"rms_{rms}_peak_{peak}"
        margins: list[float] = []
        trims: list[float] = []
        for sample in english_samples:
            onset = sample.get("energy_onset_ms", {}).get(key)
            if onset is None:
                continue
            trimmed_ms = max(0.0, float(onset) - 40.0)
            margins.append(float(sample["first_phoneme_ms"]) - trimmed_ms)
            trims.append(trimmed_ms)
        english_phoneme_gates.append(
            {
                "rms_floor": rms,
                "peak_floor": peak,
                "samples": len(margins),
                "minimum_margin_ms": round(min(margins), 2) if margins else None,
                "median_margin_ms": _median(margins),
                "median_trimmed_ms": _median(trims),
                "qualified": bool(margins)
                and min(margins) >= TRIM_REQUIRED_SAFETY_MARGIN_MS,
            }
        )
    return {
        "required_safety_margin_ms": TRIM_REQUIRED_SAFETY_MARGIN_MS,
        "selected_preroll_ms": winner["preroll_ms"] if winner else None,
        "safe_to_enable": winner is not None,
        "candidates": candidate_summaries,
        "energy_profiles": energy_profiles,
        "english_phoneme_gates": english_phoneme_gates,
    }


def _median(values: list[float | int | None]) -> float | None:
    usable = [float(value) for value in values if value is not None]
    return round(statistics.median(usable), 2) if usable else None


def summarize_samples(samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return compact medians; never include text, audio, or connection secrets."""

    summaries: list[dict[str, Any]] = []
    for buffer_delay in BUFFER_DELAYS:
        for language in TOKEN_STREAMS:
            group = [
                sample
                for sample in samples
                if sample.get("phase") == "warm"
                and sample.get("buffer_ms") == buffer_delay
                and sample.get("language") == language
                and "error_type" not in sample
            ]
            errors = [
                sample
                for sample in samples
                if sample.get("phase") == "warm"
                and sample.get("buffer_ms") == buffer_delay
                and sample.get("language") == language
                and "error_type" in sample
            ]
            summaries.append(
                {
                    "buffer_ms": buffer_delay,
                    "language": language,
                    "successful_samples": len(group),
                    "failed_samples": len(errors),
                    "first_chunk_median_ms": _median(
                        [sample.get("first_chunk_ms") for sample in group]
                    ),
                    "first_non_silent_pcm_median_ms": _median(
                        [sample.get("first_non_silent_pcm_ms") for sample in group]
                    ),
                    "first_audible_playout_estimate_median_ms": _median(
                        [
                            sample.get("first_audible_playout_estimate_ms")
                            for sample in group
                        ]
                    ),
                    "leading_silence_median_ms": _median(
                        [sample.get("leading_silence_ms") for sample in group]
                    ),
                    "complete_median_ms": _median(
                        [sample.get("complete_ms") for sample in group]
                    ),
                    "max_inter_chunk_gap_median_ms": _median(
                        [sample.get("max_inter_chunk_gap_ms") for sample in group]
                    ),
                }
            )
    return summaries


async def run_cartesia_ws_benchmark(api_key: str) -> dict[str, Any]:
    """Run one cold-after-connect sample plus the bounded warm matrix."""

    import aiohttp

    headers = {"X-API-Key": api_key, "Cartesia-Version": CARTESIA_VERSION}
    connect_started_at = time.perf_counter()
    timeout = aiohttp.ClientTimeout(total=180)
    async with (
        aiohttp.ClientSession(timeout=timeout) as session,
        session.ws_connect(CARTESIA_WS_URL, headers=headers, heartbeat=30) as websocket,
    ):
            connected_at = time.perf_counter()
            first_after_connect = await _run_sample(
                websocket,
                language="ar",
                max_buffer_delay_ms=100,
                sample_index=0,
                phase="first_after_connect",
            )

            samples: list[dict[str, Any]] = []
            for buffer_delay in BUFFER_DELAYS:
                for sample_index in range(SAMPLES_PER_LANGUAGE):
                    for language in TOKEN_STREAMS:
                        try:
                            result = await _run_sample(
                                websocket,
                                language=language,
                                max_buffer_delay_ms=buffer_delay,
                                sample_index=sample_index,
                            )
                        except Exception as error:  # noqa: BLE001 - benchmark must finish matrix
                            result = {
                                "phase": "warm",
                                "language": language,
                                "buffer_ms": buffer_delay,
                                "sample_index": sample_index,
                                "error_type": type(error).__name__,
                            }
                        samples.append(result)

    return {
        "outcome": "ok",
        "model": MODEL_ID,
        "voice_id": VOICE_ID,
        "sample_rate": SAMPLE_RATE,
        "token_delay_ms": round(TOKEN_DELAY_SECS * 1000),
        "modal_region": os.environ.get("MODAL_REGION", "unknown"),
        "modal_cloud_provider": os.environ.get("MODAL_CLOUD_PROVIDER", "unknown"),
        "websocket_connect_ms": round((connected_at - connect_started_at) * 1000, 2),
        "first_after_connect": first_after_connect,
        "summaries": summarize_samples(samples),
        "samples": samples,
    }


async def run_cartesia_trim_safety_benchmark(api_key: str) -> dict[str, Any]:
    """Validate leading-silence trimming against Cartesia timing metadata."""

    import aiohttp

    headers = {"X-API-Key": api_key, "Cartesia-Version": CARTESIA_VERSION}
    timeout = aiohttp.ClientTimeout(total=300)
    samples: list[dict[str, Any]] = []
    async with (
        aiohttp.ClientSession(timeout=timeout) as session,
        session.ws_connect(CARTESIA_WS_URL, headers=headers, heartbeat=30) as websocket,
    ):
        sample_index = 0
        for repetition in range(2):
            for category, prompts in TRIM_SAFETY_PROMPTS.items():
                for transcript in prompts:
                    try:
                        result = await _run_trim_safety_sample(
                            websocket,
                            category=category,
                            transcript=transcript,
                            sample_index=sample_index,
                        )
                    except Exception as error:  # noqa: BLE001 - complete the safety matrix
                        result = {
                            "category": category,
                            "sample_index": sample_index,
                            "error_type": type(error).__name__,
                            "error_code": getattr(error, "code", None),
                            "candidates": [],
                        }
                    result["repetition"] = repetition
                    samples.append(result)
                    sample_index += 1

    successful = [sample for sample in samples if "error_type" not in sample]
    error_types: dict[str, int] = {}
    for sample in samples:
        error_type = sample.get("error_type")
        if error_type:
            error_types[error_type] = error_types.get(error_type, 0) + 1
    return {
        "outcome": "ok" if len(successful) == len(samples) else "partial",
        "model": MODEL_ID,
        "voice_id": VOICE_ID,
        "sample_rate": SAMPLE_RATE,
        "modal_region": os.environ.get("MODAL_REGION", "unknown"),
        "modal_cloud_provider": os.environ.get("MODAL_CLOUD_PROVIDER", "unknown"),
        "successful_samples": len(successful),
        "failed_samples": len(samples) - len(successful),
        "error_types": error_types,
        "summary": summarize_trim_safety(successful),
        # Per-sample output contains timing numbers and categories only. It
        # deliberately excludes transcript text and PCM.
        "samples": samples,
    }


async def run_cartesia_trim_safety_batch(
    api_key: str,
    *,
    category: str,
    repetition: int,
    soniox_api_key: str | None = None,
) -> dict[str, Any]:
    """Run one bounded language batch so a stalled context cannot hide all results."""

    import aiohttp

    if category not in TRIM_SAFETY_PROMPTS:
        raise ValueError("unknown trim safety category")
    headers = {"X-API-Key": api_key, "Cartesia-Version": CARTESIA_VERSION}
    timeout = aiohttp.ClientTimeout(total=120)
    samples: list[dict[str, Any]] = []
    async with (
        aiohttp.ClientSession(timeout=timeout) as session,
        session.ws_connect(CARTESIA_WS_URL, headers=headers, heartbeat=30) as websocket,
    ):
        for sample_index, transcript in enumerate(TRIM_SAFETY_PROMPTS[category]):
            try:
                result = await _run_trim_safety_sample(
                    websocket,
                    category=category,
                    transcript=transcript,
                    sample_index=sample_index,
                    soniox_api_key=soniox_api_key,
                )
            except Exception as error:  # noqa: BLE001 - report the bounded batch
                result = {
                    "category": category,
                    "sample_index": sample_index,
                    "error_type": type(error).__name__,
                    "error_code": getattr(error, "code", None),
                    "candidates": [],
                }
            result["repetition"] = repetition
            samples.append(result)
    successful = [sample for sample in samples if "error_type" not in sample]
    error_types: dict[str, int] = {}
    for sample in samples:
        error_type = sample.get("error_type")
        error_code = sample.get("error_code")
        if error_type:
            label = f"{error_type}:{error_code}" if error_code else error_type
            error_types[label] = error_types.get(label, 0) + 1
    return {
        "category": category,
        "repetition": repetition,
        "successful_samples": len(successful),
        "failed_samples": len(samples) - len(successful),
        "error_types": error_types,
        "soniox_validation": {
            "samples": sum(
                sample.get("soniox_validation") is not None for sample in successful
            ),
            "raw_has_text": sum(
                bool(sample.get("soniox_validation", {}).get("raw_has_text"))
                for sample in successful
            ),
            "trimmed_has_text": sum(
                bool(sample.get("soniox_validation", {}).get("trimmed_has_text"))
                for sample in successful
            ),
            "first_token_equal": sum(
                bool(sample.get("soniox_validation", {}).get("first_token_equal"))
                for sample in successful
            ),
            "full_text_equal": sum(
                bool(sample.get("soniox_validation", {}).get("full_text_equal"))
                for sample in successful
            ),
            "exact_suffix": sum(
                bool(sample.get("production_candidate", {}).get("exact_suffix"))
                for sample in successful
            ),
            "median_trimmed_ms": _median(
                [
                    sample.get("production_candidate", {}).get("trimmed_ms")
                    for sample in successful
                ]
            ),
        },
        "samples": samples,
    }
