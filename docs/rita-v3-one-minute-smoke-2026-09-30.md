# Rita v3 — short smoke test (updated 2026-10-01)

Status: partial text-only smoke passed; acoustic voice test blocked. This is not a voice-quality acceptance result. No audible latency, transcription accuracy, dialect quality, or hourly cost is being invented.

## Requested acoustic cases

1. Connect to the voice session.
2. Speak Jordanian Arabic with a German word.
3. Explicitly switch languages.
4. Ask a general question that must not make a flashcard.
5. Interrupt Rita while she speaks.

None of these five acoustic cases passed. The browser microphone was blocked, and the configured Soniox API key was rejected.

## Deployed follow-up

- The Groq settings signature fix was pushed to newppp as 97129e6 and its regression test as 5981c34. Pipecat build b172df7d-2a7c-4943-8229-2da456a09e24 succeeded. Deployment 9f374464-77d3-43dd-a2a2-177c579ffb6d ran commit 5981c34.
- Sandbox session 07b84e11-a738-4ed0-8d0b-0b1d8cc674b0 connected and reported both client and agent ready. The session was stopped after about three dashboard minutes; no session remained running.
- Text prompt: احكي معي أردني. شو معنى Guten Morgen بالألماني؟ Response: صباح الخير يعني “Guten Morgen”. يعني تحية الصبح. This does not prove speech recognition or flashcard extraction.
- Text prompt: شو كانت حرب المغول باختصار؟ Rita answered in Arabic. The answer was too long and repetitive. The Sandbox did not expose RitaJet flashcard state, so the no-flashcard condition is not verified.
- Text prompt: Switch to English now. What does Guten Morgen mean? Response: It means “Good morning.” This proves a text language switch only, not spoken accent stability.
- Pipecat Performance reported mean LLM time-to-first-byte 0.19 s (three samples, range 0.05–0.44 s) and mean TTS time-to-first-byte 2.677 s (three samples, range 2.29–3.27 s). These are provider metrics, not the first sound heard or end-to-end latency.
- Sandbox reported Microphone blocked / permissions blockedBy user. Worker logs repeatedly reported SonioxSTTService error 401: Incorrect API key provided. Soniox produced no trustworthy transcript.
- Pipecat Usage showed no billed usage data for September or October at inspection time. About three minutes of Agent 1X active compute would be roughly $0.03 at the displayed $0.01/min list rate, not an invoice. Groq, Gemini, and Soniox charges are unknown; no honest per-hour voice estimate can be made from this blocked session.

## Earlier fixes and checks

The official dailyco/pipecat-base entrypoint was restored after earlier health-check failures; dependency installation uses uv sync --inexact to preserve the base image package. The frontend first-remote-audio metric is labeled a proxy, not an audible-sample measurement. Admin diagnostics show missing samples and provider errors. Earlier local checks passed 10 Python worker tests, 7 JavaScript/TypeScript smoke tests, and the production web build. The general TypeScript check still had pre-existing UI typing errors outside the Rita files. The later Groq regression test also passed locally.

## Required next step

Replace the Soniox key with a valid key, sync it to the Pipecat secret set, and redeploy the agent. Then repeat a controlled acoustic minute under the agreed $10 cap. Verify actual Soniox text, language state, flashcard behavior, audible sample latency, barge-in silence, and itemized provider charges. The repeated 401 reconnect loop should be made fail-closed so active sessions cannot spin indefinitely.

This is a truthful infrastructure and text smoke result, not quality acceptance. See docs/rita-v3-quality-gates.md for the full gates.
