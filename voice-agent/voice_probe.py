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
from datetime import datetime, timezone
import urllib.error
import urllib.request
import uuid
import wave
from array import array
from pathlib import Path

SAMPLE_RATE = 16000
FRAME_SAMPLES = 320
MAX_STARTUP_SECONDS = 120
MAX_VOICE_SECONDS = 60
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


def is_remote_participant(participant: dict) -> bool:
    return bool(participant.get("id")) and participant.get("info", {}).get("isLocal") is False


def probe_succeeded(result: dict) -> bool:
    turns = result.get("turns", [])
    return (
        not result.get("error")
        and len(turns) == len(PROBE_FILES)
        and all(
            turn.get("candidate_audio") is True
            and isinstance(turn.get("first_candidate_audio_after_input_ms"), (int, float))
            and turn["first_candidate_audio_after_input_ms"] >= 0
            for turn in turns
        )
        and result.get("interrupt_sent_during_audio") is True
    )


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


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
        self.onsets: list[float] = []
        self.last_audio: float | None = None
        self.error: str | None = None
        self.thread = threading.Thread(target=self._run, daemon=True)

    def _run(self):
        try:
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
                            if self.last_audio is None or now - self.last_audio >= 0.4:
                                self.onsets.append(now)
                            self.last_audio = now
        except Exception as exc:
            # Preserve a sanitized failure instead of silently producing a green run.
            self.error = type(exc).__name__


def wait_for_quiet(capture: AudioCapture, deadline: float, quiet_seconds: float = 0.9) -> bool:
    while time.monotonic() < deadline:
        if capture.error:
            return False
        with capture.lock:
            last_audio = capture.last_audio
        if last_audio is None or time.monotonic() - last_audio >= quiet_seconds:
            return True
        time.sleep(0.05)
    return False


def wait_for_onset(capture: AudioCapture, baseline: int, earliest: float, deadline: float) -> float | None:
    while time.monotonic() < deadline:
        if capture.error:
            return None
        with capture.lock:
            for onset in capture.onsets[baseline:]:
                if onset >= earliest:
                    return onset
        time.sleep(0.05)
    return None


def send_wav(mic, wav: bytes, deadline: float):
    chunk_size = FRAME_SAMPLES * 2
    for offset in range(0, len(wav), chunk_size):
        if time.monotonic() > deadline:
            raise TimeoutError("Voice probe limit reached")
        chunk = wav[offset:offset + chunk_size]
        if len(chunk) < chunk_size:
            chunk += b"\0" * (chunk_size - len(chunk))
        mic.write_frames(chunk)
        time.sleep(FRAME_SAMPLES / SAMPLE_RATE)


def run(input_dir: Path, output_dir: Path, key: str, agent: str) -> dict:
    from daily import CallClient, Daily, EventHandler

    wavs = [read_wav(input_dir / name) for name in PROBE_FILES]
    output_dir.mkdir(parents=True, exist_ok=True)
    session_started_utc = utc_now()
    session_started_at = time.monotonic()
    room, token, session_id, start_seconds = start_session(key, agent)
    Daily.init()
    mic = Daily.create_microphone_device("rita-qa-mic", sample_rate=SAMPLE_RATE, channels=1)
    speaker = Daily.create_speaker_device("rita-qa-speaker", sample_rate=SAMPLE_RATE, channels=1)
    Daily.select_speaker_device("rita-qa-speaker")
    class ParticipantHandler(EventHandler):
        def __init__(self):
            super().__init__()
            self.bot_joined = threading.Event()
            self.bot_joined_at: float | None = None

        def on_participant_joined(self, participant):
            if is_remote_participant(participant) and not self.bot_joined.is_set():
                self.bot_joined_at = time.monotonic()
                self.bot_joined.set()

    participant_handler = ParticipantHandler()
    client = CallClient(event_handler=participant_handler)
    client.update_subscription_profiles({"base": {"camera": "unsubscribed", "microphone": "subscribed"}})
    joined = threading.Event()
    join_error = []

    def on_joined(_data, error):
        if error:
            join_error.append(str(error))
        joined.set()

    started = time.monotonic()
    startup_deadline = session_started_at + MAX_STARTUP_SECONDS
    joined_at = None
    capture = AudioCapture(speaker, output_dir / "rita-response.wav")
    turns: list[dict] = []
    error: str | None = None
    interrupt_sent_during_audio = False
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
        if not joined.wait(min(30, max(0, startup_deadline - time.monotonic()))):
            raise TimeoutError("Daily join timed out")
        if join_error:
            raise RuntimeError("Daily join failed")
        joined_at = time.monotonic()
        # The bot may already be in the room before the join callback returns.
        for participant in client.participants().values():
            if is_remote_participant(participant) and not participant_handler.bot_joined.is_set():
                participant_handler.bot_joined_at = time.monotonic()
                participant_handler.bot_joined.set()
        if not participant_handler.bot_joined.wait(max(0, startup_deadline - time.monotonic())):
            raise TimeoutError("Rita bot did not join Daily within 120 seconds")
        ready_at = participant_handler.bot_joined_at or time.monotonic()
        deadline = min(ready_at + MAX_VOICE_SECONDS, session_started_at + MAX_STARTUP_SECONDS + MAX_VOICE_SECONDS)
        capture.thread.start()
        time.sleep(min(0.5, max(0, deadline - time.monotonic())))
        # Any unsolicited greeting must finish before the first prompt.
        if not wait_for_quiet(capture, min(deadline, time.monotonic() + 5)):
            raise TimeoutError("Bot audio did not become quiet before first prompt")
        for index, (name, wav) in enumerate(zip(PROBE_FILES, wavs)):
            if time.monotonic() >= deadline - 5:
                break
            if index < 3 and not wait_for_quiet(capture, min(deadline, time.monotonic() + 5)):
                raise TimeoutError("Prior bot audio did not finish before next prompt")
            with capture.lock:
                baseline = len(capture.onsets)
                was_speaking = (
                    capture.last_audio is not None
                    and time.monotonic() - capture.last_audio < 0.15
                )
            if index == 3:
                interrupt_sent_during_audio = was_speaking
                if not interrupt_sent_during_audio:
                    raise RuntimeError("Interruption was not sent during bot audio")
            input_started_utc = utc_now()
            send_wav(mic, wav, deadline)
            end = time.monotonic()
            input_ended_utc = utc_now()
            first = wait_for_onset(capture, baseline, end, min(deadline, end + 12))
            turns.append({
                "prompt_file": name,
                "input_duration_ms": round(len(wav) / 2 / SAMPLE_RATE * 1000),
                "input_started_utc": input_started_utc,
                "input_ended_utc": input_ended_utc,
                "first_candidate_audio_after_input_ms": round((first - end) * 1000) if first else None,
                "candidate_audio": first is not None,
            })
            if first is None:
                raise TimeoutError(f"No received audio candidate for prompt {index + 1}")
            if index == 2:
                # The next prompt is the barge-in: send it immediately while
                # answer audio is active, not after an arbitrary fixed delay.
                continue
            if index < 2 and not wait_for_quiet(capture, min(deadline, end + 12)):
                raise TimeoutError(f"Received audio did not finish for prompt {index + 1}")
        time.sleep(min(2, max(0, deadline - time.monotonic())))
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
    finally:
        capture.stop.set()
        try:
            done = threading.Event()
            client.leave(completion=lambda *_: done.set())
            done.wait(3)
        finally:
            client.release()
            if capture.thread.is_alive():
                capture.thread.join(timeout=3)
    if capture.error and error is None:
        error = f"AudioCaptureError: {capture.error}"
    return {
        "provider_session_id": session_id,
        "session_started_utc": session_started_utc,
        "pipecat_start_ms": round(start_seconds * 1000),
        "daily_join_ms": round((joined_at - started) * 1000) if joined_at else None,
        "bot_join_after_session_start_ms": (
            round((participant_handler.bot_joined_at - session_started_at) * 1000)
            if participant_handler.bot_joined_at else None
        ),
        "startup_limit_seconds": MAX_STARTUP_SECONDS,
        "voice_limit_seconds": MAX_VOICE_SECONDS,
        "error": error,
        "interrupt_sent_during_audio": interrupt_sent_during_audio,
        "turns": turns,
        "notes": [
            "Synthetic voice; not a dialect-quality or iPad speaker measurement.",
            "First non-silent received PCM is not proof that a person heard the sound.",
            "An audio onset after input ends is not proof of a response to that input; correlate with worker turn IDs.",
            "No retry; a failed/empty turn remains visible as a failure.",
            "The bot must join Daily before any test speech is transmitted.",
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
    if not probe_succeeded(result):
        raise SystemExit("Probe failed: missing bot readiness, audio, or a completed test turn")


if __name__ == "__main__":
    main()
