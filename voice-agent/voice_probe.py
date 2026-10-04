"""One bounded, synthetic Daily audio probe for Rita v3.

This is an acoustic transport test, not a human judgment of dialect or an iPad
speaker measurement. It never prints the Daily token or provider key.
"""

from __future__ import annotations

import argparse
import json
import os
import threading
import time
import urllib.error
import urllib.request
import uuid
import wave
from array import array
from pathlib import Path

SAMPLE_RATE = 16000
FRAME_SAMPLES = 320
MAX_SECONDS = 90
PROBE_FILES = (
    "01-meaning.wav",
    "02-switch.wav",
    "03-general.wav",
    "04-interrupt.wav",
)


def first_non_silent_offset_ms(audio: bytes, sample_rate: int, threshold: int = 500) -> float | None:
    if sample_rate <= 0 or len(audio) < 2:
        return None
    samples = array("h")
    samples.frombytes(audio[: len(audio) - len(audio) % 2])
    for index, sample in enumerate(samples):
        if abs(sample) >= threshold:
            return index * 1000 / sample_rate
    return None


def read_wav(path: Path) -> bytes:
    with wave.open(str(path), "rb") as source:
        if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (1, 2, SAMPLE_RATE):
            raise ValueError(f"{path.name}: expected mono PCM16 at {SAMPLE_RATE} Hz")
        return source.readframes(source.getnframes())


def start_session(key: str, agent: str) -> tuple[str, str, str, float]:
    address = f"https://api.pipecat.daily.co/v1/public/{agent}/start"
    body = json.dumps({
        "createDailyRoom": True,
        "body": {
            "appSessionId": str(uuid.uuid4()),
            "language": "automatic",
            "dialect": "ar-JO",
            "mode": "free_conversation",
            "personality": "kind",
        },
    }).encode("utf-8")
    request = urllib.request.Request(
        address,
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=55) as response:
            data = json.load(response)
    except urllib.error.HTTPError as exc:
        # Do not echo response bodies; providers can include sensitive details.
        raise RuntimeError(f"Pipecat start returned HTTP {exc.code}") from None
    if not data.get("dailyRoom") or not data.get("dailyToken"):
        raise RuntimeError("Pipecat start omitted Daily room or token")
    return data["dailyRoom"], data["dailyToken"], str(data.get("sessionId", "")), time.monotonic() - started


class AudioCapture:
    def __init__(self, speaker, output: Path):
        self.speaker = speaker
        self.output = output
        self.stop = threading.Event()
        self.lock = threading.Lock()
        self.first_after_input: float | None = None
        self.input_end: float | None = None
        self.last_audio: float | None = None
        self.thread = threading.Thread(target=self._run, daemon=True)

    def _run(self):
        with wave.open(str(self.output), "wb") as sink:
            sink.setnchannels(1)
            sink.setsampwidth(2)
            sink.setframerate(SAMPLE_RATE)
            while not self.stop.is_set():
                chunk = self.speaker.read_frames(FRAME_SAMPLES)
                if not chunk:
                    continue
                now = time.monotonic()
                sink.writeframes(chunk)
                if first_non_silent_offset_ms(chunk, SAMPLE_RATE) is not None:
                    with self.lock:
                        self.last_audio = now
                        if self.input_end is not None and self.first_after_input is None:
                            self.first_after_input = now


def send_wav(mic, wav: bytes, deadline: float):
    chunk_size = FRAME_SAMPLES * 2
    for offset in range(0, len(wav), chunk_size):
        if time.monotonic() > deadline:
            raise TimeoutError("90-second probe limit reached")
        chunk = wav[offset:offset + chunk_size]
        if len(chunk) < chunk_size:
            chunk += b"\0" * (chunk_size - len(chunk))
        mic.write_frames(chunk)
        time.sleep(FRAME_SAMPLES / SAMPLE_RATE)


def run(input_dir: Path, output_dir: Path, key: str, agent: str) -> dict:
    from daily import CallClient, Daily

    wavs = [read_wav(input_dir / name) for name in PROBE_FILES]
    output_dir.mkdir(parents=True, exist_ok=True)
    room, token, session_id, start_seconds = start_session(key, agent)
    Daily.init()
    mic = Daily.create_microphone_device("rita-qa-mic", sample_rate=SAMPLE_RATE, channels=1)
    speaker = Daily.create_speaker_device("rita-qa-speaker", sample_rate=SAMPLE_RATE, channels=1)
    Daily.select_speaker_device("rita-qa-speaker")
    client = CallClient()
    client.update_subscription_profiles({"base": {"camera": "unsubscribed", "microphone": "subscribed"}})
    joined = threading.Event()
    join_error = []

    def on_joined(_data, error):
        if error:
            join_error.append(str(error))
        joined.set()

    started = time.monotonic()
    deadline = started + MAX_SECONDS
    joined_at = None
    capture = AudioCapture(speaker, output_dir / "rita-response.wav")
    turns: list[dict] = []
    try:
        client.join(
            room,
            meeting_token=token,
            client_settings={
                "inputs": {
                    "camera": False,
                    "microphone": {"isEnabled": True, "settings": {"deviceId": "rita-qa-mic"}},
                }
            },
            completion=on_joined,
        )
        if not joined.wait(min(30, max(0, deadline - time.monotonic()))):
            raise TimeoutError("Daily join timed out")
        if join_error:
            raise RuntimeError("Daily join failed")
        joined_at = time.monotonic()
        capture.thread.start()
        # Wait briefly for the worker to join without assuming room creation == bot readiness.
        time.sleep(min(3, max(0, deadline - time.monotonic())))
        for index, (name, wav) in enumerate(zip(PROBE_FILES, wavs)):
            if time.monotonic() >= deadline - 5:
                break
            with capture.lock:
                capture.input_end = None
                capture.first_after_input = None
            send_wav(mic, wav, deadline)
            end = time.monotonic()
            with capture.lock:
                capture.input_end = end
            # Allow STT to endpoint and the first answer to arrive. Turn four is a
            # deliberate interruption after three seconds of the preceding answer.
            wait_limit = min(deadline, end + (3 if index == 2 else 12))
            while time.monotonic() < wait_limit:
                with capture.lock:
                    first = capture.first_after_input
                    last = capture.last_audio
                if first and (index == 2 or (last and time.monotonic() - last > 0.9)):
                    break
                time.sleep(0.05)
            with capture.lock:
                first = capture.first_after_input
            turns.append({
                "prompt_file": name,
                "input_duration_ms": round(len(wav) / 2 / SAMPLE_RATE * 1000),
                "first_non_silent_audio_after_input_ms": round((first - end) * 1000) if first else None,
                "observed_answer": first is not None,
            })
        time.sleep(min(2, max(0, deadline - time.monotonic())))
    finally:
        capture.stop.set()
        if capture.thread.is_alive():
            capture.thread.join(timeout=3)
        done = threading.Event()
        try:
            client.leave(completion=lambda *_: done.set())
            done.wait(3)
        finally:
            client.release()
    return {
        "provider_session_id": session_id,
        "pipecat_start_ms": round(start_seconds * 1000),
        "daily_join_ms": round((joined_at - started) * 1000) if joined_at else None,
        "probe_limit_seconds": MAX_SECONDS,
        "turns": turns,
        "notes": [
            "Synthetic voice; not a dialect-quality or iPad speaker measurement.",
            "First non-silent received PCM is not proof that a person heard the sound.",
            "No retry; a failed/empty turn remains visible as a failure.",
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--agent", default="ritajet-voice-v3")
    args = parser.parse_args()
    key = os.environ.get("PIPECAT_PUBLIC_API_KEY", "").strip()
    if not key:
        raise SystemExit("PIPECAT_PUBLIC_API_KEY is missing")
    result = run(args.input_dir, args.output_dir, key, args.agent)
    (args.output_dir / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
