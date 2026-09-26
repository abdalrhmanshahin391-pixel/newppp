# Rita: go back to the Whisper Turbo version, then add an OpenAI Realtime mode

## 1. Go back to how things were after Turbo
- The last change that actually went live was Whisper Turbo (plus the card audio fixes and the green-box layout). The later messages about speed and quality were only discussion. No code was changed after Turbo.
- The listening code currently sends Whisper nothing but the language hint. There is no "mixed-language prompt" and no extra processing.
- What I'll do: check the listening file line by line against the Turbo version. If anything slipped in after Turbo, I remove it. Otherwise nothing changes. Whisper Turbo stays exactly as it was.

## 2. New mode: OpenAI Realtime (the premium voice)
Rita hears your voice directly and answers in her own voice. There's no separate transcription step, so she understands Arabic mixed with German or English much better. It is expensive.

- **Admin switch:** a third option next to "Whisper Turbo / Deepgram": **"OpenAI Realtime (premium)"**. Only the selected mode runs. In Realtime mode, Whisper, Deepgram, Groq and Fish are all switched off.
- **In the Rita page:** Rita talks live, and you can interrupt her while she speaks. Your words and her reply appear as text in the chat as usual.
- **Rita's personality:** the same teaching rules as now go to the model: a warm, slightly strict teacher, free conversation, no invented facts, and a German sentence always on its own line.
- **Cost protection:** each call is capped at 5 minutes, and the daily allowance counts minutes. If you run out, Rita stops clearly without switching to another mode.
- **Voice:** OpenAI's voice (Layan and Emma are Fish voices and aren't available in this mode).

## What I need from you
- An **OpenAI API key** (from platform.openai.com). I'll ask for it in a secure box when I start. Without it, this mode shows "Add an OpenAI key" and doesn't run.

## Technical details
- Bring back `src/routes/api/rita/live.ts` (it currently returns 410) as the WebRTC SDP exchange: check the signed-in user and the allowance, then POST the SDP to `https://api.openai.com/v1/realtime/calls` with the server-side `OPENAI_API_KEY` and session config (model, voice, instructions, `input_audio_transcription`, server VAD). Return the answer SDP plus `X-Rita-Model`.
- Model: the full `gpt-realtime` (the premium model) instead of the `-mini` currently in `rita-realtime.client.ts`. I'll check the exact model name against OpenAI's model list before switching.
- Settings: `stt_engine` gets a new value, `realtime`, with a migration to update the check constraint if there is one. Update `SettingsSchema`, the session response and the admin panel.
- `rita-live.tsx`: when `sttEngine === "realtime"`, use `startRitaRealtime` instead of the economic pipeline. Map the transcript and reply callbacks into the chat, and record usage from `response.done`.
- No fallback between modes, per the existing architecture rule. Record the decision in AGENTS.md.

do u want to apply it like lovable
