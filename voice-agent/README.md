# Rita Realtime Voice Engine v3

This directory is an independently deployable Pipecat worker. It is not bundled into the
Cloudflare/Lovable web application.

## Locked production pipeline

`Daily WebRTC -> Soniox stt-rt-v5 -> Groq openai/gpt-oss-120b -> Cartesia Sonic 3.6 TTS (Layan) -> Daily WebRTC`

Cartesia receives Groq text progressively over one WebSocket context, then receives a cancellation
message immediately when the learner interrupts. There is no runtime fallback to Rita Legacy,
Deepgram, Gemini, OpenAI TTS, or a slower TTS model.

The Modal production worker is pinned to broad `eu` and uses
`RITA_CARTESIA_MAX_BUFFER_DELAY_MS=0` by default. A bounded warm-WebSocket benchmark on
2026-10-11 measured median first PCM at roughly 74 ms for Arabic and 75 ms for German in EU;
US-East was slower. This is Cartesia-only TTFA, not end-of-user-speech to audible-device latency.
Set the buffer to `50` if the real-call quality check finds token-boundary pauses objectionable.

## Local verification

1. Install Python 3.11+ and `uv`.
2. Copy `.env.example` to `.env` and set the three provider secrets.
3. Run `uv sync --extra dev`.
4. Run `uv run bot.py -t daily` or use Pipecat's local runner.

## Pipecat Cloud deployment

Create the secret set `ritajet-voice-v3-secrets` with `SONIOX_API_KEY`, `GROQ_API_KEY`, and
`CARTESIA_API_KEY`, then deploy with the Pipecat CLI. The deployment keeps `min_agents = 0`, so
there is no reserved-agent bill while idle. Daily 1:1 voice transport is used.

The admin page at `/admin/rita-voice` stores the Pipecat public/private control-plane keys and
synchronizes Soniox, Groq, and Cartesia credentials into the worker secret set. Pipecat requires a
worker redeploy after a secret update. The public app never receives provider secrets.

Apply `supabase/migrations/20260927173000_rita_realtime_voice_v3.sql` before starting real sessions.
Then verify the deployed agent from the admin page. `min_agents = 0` avoids idle reserved compute but
can add a cold start to the first call after an idle period.

The complete feature/acceptance audit is in `docs/RITA_REALTIME_V3_TRACEABILITY.md`.

## Modal deployment and TTFA benchmark

The active alternative deployment is `modal_app.py`. Its `RitaWorker` keeps one container warm,
loads VAD/Smart Turn into the memory snapshot, and opens one Cartesia WebSocket per lesson. The
socket is refreshed while idle before Cartesia's five-minute timeout.

Run the bounded private comparison with:

`modal run voice-agent/modal_app.py::cartesia_ws_benchmark`

The result separates WebSocket connection time, first chunk, first non-silent PCM, estimated first
audible playout after leading silence, completion time, and inter-chunk gaps. The older REST probe
reports `full_response_ms`; it must never be used as TTFA.
