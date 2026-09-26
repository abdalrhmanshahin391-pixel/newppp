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
- [ ] Add and verify the user’s Groq key, then run live Arabic/German voice tests

## Rita speed plan (2026-09-26)
- [x] Replace retired Groq model, automatic fallback model, friendly error
- [x] Small instant model for short turns; last 6 messages only
- [x] Faster end-of-speech (Deepgram 200/250ms) and earlier first voice clause (3–6 words)
- [ ] Early (pre-emptive) reply start with cancel on new speech
- [ ] Saved audio for repeated replies/words
- [ ] Real chat test in admin key check
