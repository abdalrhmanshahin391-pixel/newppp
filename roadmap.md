# Roadmap

- [x] Restrict checkout to debit/credit cards and hide optional business tax-ID controls
- [x] Refine checkout and home typography/content
- [x] Diagnose and fix blank-page reliability and first-load performance
- [x] Add safe manual plan grants with expiry, audit history, revocation, and paid-plan fallback
- [ ] Verify payments, access limits, metadata, and desktop/mobile behavior

- [x] Recover the three saved homepage pictures and replace stale fallbacks
- [x] Verify restored homepage images on fresh visits and reloads (all images loaded; no browser errors)
- [ ] Authenticated homepage verification — blocked: no matching managed account/session; public artwork verified without login

- [x] Rebuild RitaVoice around one Deepgram connection and one explicit listening state machine
- [x] Simplify Rita reconnect/error states and make per-turn latency diagnostics accurate
- [x] Verify Arabic, mixed-language, interruption, reconnect, and Fish/OpenAI playback flows in automated preview checks
- [x] Make quiet speech reach Deepgram continuously with adaptive pickup and stage diagnostics
- [ ] Verify ten natural quiet-volume iPad turns before publishing
- [x] Add Groq-only streamed replies, concise-by-default teaching, mixed-script display, and conditional second-listen transcription
- [x] Add automatic Rita word cards with a user preference and restricted Undo
- [x] Add and verify the user’s Groq key, then run live Arabic/German voice tests

## Rita speed plan (2026-09-26)
- [x] Replace retired Groq model, automatic fallback model, friendly error
- [x] Small instant model for short turns; last 6 messages only
- [x] Faster end-of-speech (Deepgram 200/250ms) and earlier first voice clause (3–6 words)
- [ ] Early (pre-emptive) reply start with cancel on new speech
- [ ] Saved audio for repeated replies/words
- [ ] Real chat test in admin key check

## Rita bilingual voice and connection plan (2026-09-26)
- [x] Separate Arabic Layan speech, German Emma speech, and silent written notes
- [x] Add interactive German phrase cards with normal/slow replay and precise saving
- [x] Remove second-listen behavior and repair bounded Deepgram reconnection
- [x] Verify three live Arabic-to-German requests through the live response and voice services
- [ ] Verify ten consecutive physical microphone turns on iPad before publishing
- [x] Whisper Turbo listening with one-click Deepgram switch (admin)
- [x] German card audio cached 3 min, one voice at a time, Emma reads German only
- [x] Tolerant green-card parser + quoted German lifted into its own card
- [ ] Live iPad mic test of Whisper mode before publishing (needs the user)
