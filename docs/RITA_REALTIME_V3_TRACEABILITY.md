# Rita Realtime Voice v3 — implementation traceability

This file is the audit map between the approved research blueprint and the shipped code. It
distinguishes implemented behavior from deployment configuration and deliberately deferred work.

## Locked pipeline

- Daily WebRTC transports browser audio to the managed Pipecat agent.
- Soniox `stt-rt-v5` streams Arabic, German, and English transcription with language identification,
  loose language hints, lesson terms, and `vad_force_turn_endpoint`.
- Silero VAD plus Local Smart Turn v3 determine end of turn.
- Groq `openai/gpt-oss-120b` streams the spoken response.
- Gemini `gemini-3.8-flash-lite-tts`, voice `Achernar`, streams 24 kHz mono PCM.
- There is no runtime fallback to the old Rita, Deepgram, OpenAI TTS, or a slower Gemini model.

## Conversation intelligence

- Session state remembers stable language and Jordanian dialect instead of redetecting every turn.
- An explicit language request applies immediately; automatic switching needs two clear consecutive
  turns. A target German/English word inside Arabic does not switch the conversation language.
- Responses default to one to three short spoken sentences and place an early natural sentence
  boundary so sentence-level TTS can begin while the model continues.
- Understanding, frustration, correction attempts, last feedback, and response type are explicit
  state. A failed correction twice forces a different teaching method.
- Free conversation, guided lesson, and pronunciation drill modes are selectable before connecting.
- Long sessions use bounded context with background summarization of learner goals and unresolved
  teaching state rather than resending an unlimited transcript.

## Turns, interruption, and perceived speed

- Browser capture requests echo cancellation, noise suppression, automatic gain control, and mono.
- Harmless backchannels such as “mhm” do not interrupt Rita. Clear commands or meaningful speech do.
- Actual heard bot text—not merely generated text—is committed to chat when playback completes or is
  interrupted, preventing unsaid text from contaminating history.
- A pre-generated/cached filler is scheduled only after 675 ms and is cancelled when real audio starts.
  Uncertain turns use only the neutral “mm” filler. Fillers never block the model or TTS path.
- The browser records speech end, transcript final, model start, TTS start, first audible playback,
  interruptions, provider metrics, and playback completion. Admin reporting includes p50/p95/p99.

## Learning JSON and saving

- Learning extraction runs after the audible response and never delays voice.
- A deterministic intent gate allows only translation, word meaning, requested language word lists,
  and explicit saves. General knowledge (for example the Mongol wars) returns no learning JSON.
- JSON is hidden from the learner and strictly sanitized before cards are displayed.
- Flashcards and German Lab destinations come from real existing subjects. A destination can be
  remembered for the current lesson; only a successful database transaction is reported as saved.
- Ending a lesson clears chat, unsaved learning, and the remembered destination.

## Security, cost, and operations

- Provider secrets are server-side. Admin entry stores them in RitaJet and synchronizes worker-only
  secrets to the Pipecat secret set when the private control-plane key is present.
- The public Pipecat key starts only the named agent. User authentication and Rita usage allowances
  are checked before a session or filler request.
- Session/event tables use row-level security; provider payload metadata is size-bounded.
- Pipecat uses `agent-1x`, `min_agents = 0`, and bounded autoscaling. This avoids reserved idle compute
  but means the first session after idle may experience a managed cold start.
- Exact runtime dependencies, base image, model IDs, secret set, region, and agent name are pinned.

## Deployment-required acceptance checks

The repository can verify compilation, static contracts, and deterministic state locally. These checks
require real provider credentials and a deployed agent before release:

1. Apply the Supabase migration and configure Pipecat public/private, Soniox, Groq, and Google keys.
2. Deploy/redeploy the worker after secret updates.
3. Run twenty-turn Jordanian, German, English, and code-switch sessions on Safari/iPad and Chromium.
4. Confirm first-audio p50/p95, interruption behavior, audio continuity, usage, and real invoices.
5. Confirm translations create cards and general-knowledge questions never do.

## Deliberately deferred to the private-cloud phase

- Local pre-transcript audio ducking and full false-interruption restoration. The managed MVP waits
  for transcript evidence so backchannels are not destructive.
- Azure pronunciation scoring, advanced adaptive jitter/time-stretch, semantic retrieval, and a
  self-hosted Pipecat media plane. They are not silently simulated in this build.
- Provider substitution. A provider outage is shown as an error; it never activates an older system.
