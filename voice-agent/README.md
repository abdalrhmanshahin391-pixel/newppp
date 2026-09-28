# Rita Realtime Voice Engine v3

This directory is an independently deployable Pipecat worker. It is not bundled into the
Cloudflare/Lovable web application.

## Locked production pipeline

`Daily WebRTC -> Soniox stt-rt-v5 -> Groq openai/gpt-oss-120b -> Gemini 3.8 Flash-Lite TTS (Achernar)`

There is no runtime fallback to Rita Legacy, Deepgram, OpenAI TTS, or a slower Gemini model.

## Local verification

1. Install Python 3.11+ and `uv`.
2. Copy `.env.example` to `.env` and set the three provider secrets.
3. Run `uv sync --extra dev`.
4. Run `uv run bot.py -t daily` or use Pipecat's local runner.

## Pipecat Cloud deployment

Create the secret set `ritajet-voice-v3-secrets` with `SONIOX_API_KEY`, `GROQ_API_KEY`, and
`GOOGLE_API_KEY`, then deploy with the Pipecat CLI. The deployment keeps `min_agents = 0`, so
there is no reserved-agent bill while idle. Daily 1:1 voice transport is used.

The admin page at `/admin/rita-voice` stores the Pipecat public/private control-plane keys and
synchronizes Soniox, Groq, and Google credentials into the worker secret set. Pipecat requires a
worker redeploy after a secret update. The public app never receives provider secrets.

Apply `supabase/migrations/20260927173000_rita_realtime_voice_v3.sql` before starting real sessions.
Then verify the deployed agent from the admin page. `min_agents = 0` avoids idle reserved compute but
can add a cold start to the first call after an idle period.

The complete feature/acceptance audit is in `docs/RITA_REALTIME_V3_TRACEABILITY.md`.
