# Rita v3 — one-minute smoke-test attempt (2026-09-30)

Status: **not passed; no real audio session was completed**. This report deliberately has no invented audible-latency, transcription-accuracy, dialect-quality, or per-hour cost number.

## Requested one-minute cases

1. Start the voice connection.
2. Speak Jordanian Arabic containing one German target word.
3. Request an explicit language change.
4. Ask a general-knowledge question that must not create a flashcard.
5. Interrupt Rita while she is replying.

Only the control-plane and code-level prerequisites could be checked. Pipecat Cloud showed zero session minutes, zero active sessions, and $0 spend in its dashboard at the time of inspection. None of the five acoustic cases was executed, so these are **not** passes.

## What was checked and fixed

- The first Pipecat deployment built but failed runtime validation. Logs showed repeated startup on `localhost:7860`, a port/address not reachable by the platform's health check. Earlier runs had also fallen into a SmallWebRTC/`aiortc` startup error instead of the selected Daily transport.
- The Docker command is now Daily transport on `0.0.0.0:8080` with `uv run --no-sync`, avoiding runtime dependency reinstallation. The automated architecture test asserts this startup contract.
- The frontend now records a first-remote-audio-level **proxy**, not a claim of the first sound heard by a listener. It preserves only the assistant reply that was actually emitted before an interruption.
- The admin diagnostic surface exposes session measurements and provider/storage errors rather than presenting missing samples as zero latency.
- Local validation: 10 Python worker tests passed; 7 JavaScript/TypeScript smoke tests passed; production web build passed. The general TypeScript check still reports pre-existing UI typing errors outside the Rita files.

## Remaining blockers and evidence needed

- The corrected Pipecat image must finish building and its agent status must become healthy. A successful image build alone is insufficient.
- The in-app browser's Pipecat Sandbox stayed at device initialization and did not establish a microphone/audio session. The public RitaJet homepage loaded, but the voice route required sign-in. No synthetic voice was injected into a live room, and no private account credentials were used.
- A consented recording (or controlled synthetic audio injected through an authorized test client) is still needed for all five cases. Compare expected and actual Soniox text, language state, saved learning items, and heard audio. Capture `speech_end → first audible sample`, interruption-to-silence, and actual provider usage from Pipecat, Soniox, Groq, and Gemini.
- Do not extrapolate a cost per hour from this zero-session attempt. Perform the paid minute under the previously agreed $10 cap, then label any hourly extrapolation as workload-dependent.

This is a truthful infrastructure/code smoke attempt, **not a quality acceptance result**. The full acceptance gates remain in `docs/rita-v3-quality-gates.md`.
