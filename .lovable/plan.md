# Fish Audio free voice as a switchable Rita mode + fix "Deepgram connection ended"

## What you get
1. A new voice mode for Rita: **Fish Audio (free)** next to the current **OpenAI voice**. A switch on the Rita page (and a default in admin) lets you flip between them at any time, no rebuild.
2. A Saudi voice picker in admin: lists Fish Audio's Arabic voices, you press play on each, and pick one. The chosen voice is saved for everyone.
3. The red error "Deepgram connection ended before the transcript was final" stops appearing when nothing was actually lost, and the listening connection reconnects silently.

## Advantages of Fish Audio mode
- $0 per character under fair use (model `s2.1-pro-free`), same quality as their paid S2.1 Pro.
- Much more natural Arabic, closer to a real person; understands Saudi/Gulf pronunciation when given a Saudi voice.
- Emotion control inside the text, e.g. `[laughs softly]`, which makes Rita feel alive.
- Streams audio, so Rita can start talking before the whole sentence is ready.

## Disadvantages / risks
- "Free under fair use" has no speed guarantee: at busy times first audio may be slower than OpenAI, and Fish can limit or end the free tier later. That is exactly why it is a switchable mode with OpenAI kept as automatic fallback.
- Needs a Fish Audio account and API key (free to create).
- Almost all Fish voices are uploaded by users. Fish has very few "official" default voices, and I could not confirm an official Saudi one. So the picker shows the most-used Arabic/Saudi voices ranked by popularity, you listen and choose; I will not claim one is "official" unless Fish marks it so.
- Some community voices can be removed by their owner; the app detects that and falls back to OpenAI.
- Fish's audio is sent as a different sound format; I convert it on the server so the player stays the same.

## How the switch behaves
```text
Rita reply text ──► Voice mode?
                    ├─ Fish (free) ──► Fish S2.1 Pro, chosen Saudi voice
                    │        └─ error / slow > 2.5s first audio ──► OpenAI voice (this sentence only)
                    └─ OpenAI ──► current coral voice
```
- Choice priority: your switch on the Rita page > admin default.
- Telemetry records which voice engine spoke each sentence, and first-audio time, so we can compare both honestly.

## The Deepgram error
- Diagnosis is not confirmed yet. Step 1 is to reproduce and read the close code (likely the short-lived listening token expiring, or an idle close) using the existing timeline logs.
- Fix: only show the error when a real sentence was in progress with words already heard; otherwise reconnect silently. Refresh the listening token before it expires, and keep the buffered microphone audio during reconnect so the next sentence is not lost.

## Steps
1. You create a free Fish Audio key; I request it through the secure secret form (`FISH_AUDIO_API_KEY`), also savable in the existing "AI keys" admin page.
2. Server: new Fish speech path inside the current speech endpoint, same sign-in ticket checks, raw 24 kHz audio, fallback to OpenAI.
3. Admin: engine default + Saudi voice picker with play buttons (voices fetched live from Fish, filtered to Arabic).
4. Rita page: small "Voice: OpenAI / Fish (free)" switch, remembered per device.
5. Deepgram: diagnose, then apply the reconnect fix above.
6. Tests for fallback and error suppression; try it in preview. No live publish without your OK.

## Technical details
- Fish endpoint: `POST https://api.fish.audio/v1/tts`, header `model: s2.1-pro-free`, body `{ text, reference_id, format: "pcm", sample_rate: 24000, latency: "balanced" }`, streamed through unchanged.
- Voice list: `GET https://api.fish.audio/model?language=ar&sort_by=task_count` (server-side, cached 10 min).
- Settings: add `voice_engine` ('openai'|'fish') and `fish_voice_id` columns to `rita_voice_settings` (migration); client override sent as `engine` in the speech request and validated server-side.
- Files: `src/routes/api/rita/speech.ts`, `src/lib/rita-voice.server.ts`, new `src/lib/rita-fish.server.ts`, admin Rita settings UI, `src/routes/rita-live.tsx`, `src/lib/rita-economic.client.ts` (onclose / token refresh).
- Model constraint for text replies unchanged.

do u want to apply it like lovable
