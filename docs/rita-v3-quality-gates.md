# Rita Realtime v3 — quality verification

This is an executable acceptance protocol, not a claim that production voice quality has passed. It follows the 35-page Rita Realtime Voice Engine Research Blueprint (especially its benchmark and launch-gate sections), with the later product decisions overriding its alternatives: **Gemini 3.8 Flash-Lite TTS only; no automatic legacy fallback**.

## Evidence and privacy

Use consented test recordings, not real students' private lessons. Each `results.jsonl` row is one independently reviewed scenario. A human reviewer checks the playback recording and the expected transcript/behavior. No API key, raw audio, transcript, or personal identifier belongs in the JSONL report. The audio and transcript reference set stays in a separate, access-controlled test store and is deleted according to the testers' consent.

Start with local unit tests and mocks. Do not run paid provider sweeps until an administrator has confirmed a test account and a **$10 maximum for the first paid pass**. Stop at that cap; report incomplete coverage rather than silently spending more. Do not deploy or claim acceptance based on a control-plane health check alone.

## Reproducible corpus

The primary corpus has 910 cases: 150 Jordanian/Levantine, 80 MSA, 100 English, 100 German, 150 Arabic/German/English code-switching, 80 thinking pauses, 100 harmless backchannels during Rita's speech, 100 true interruptions, and 50 noise/echo cases. Add 100 ordinary knowledge questions, 100 translation/vocabulary requests, 20 real save/idempotency cases, 20 twenty-turn language-stability sessions, 20 two-failed-attempt teaching cases, 12 provider failures, and 20 uncertain pronunciation clips.

Run the same cases on iPad Safari, one Android device, and desktop, with good and weak networks. Tag cold and warm starts separately. Preserve the same recorded stimulus, device/network profile, and review rubric for every baseline/challenger comparison. For Jordanian output, at least 50 clips receive 1–5 ratings from **three Jordanian-fluent reviewers** for naturalness, dialect fidelity, and intelligibility; reviewers are blind to configuration.

Before the full corpus, run a 24-scenario pilot on iPad Safari, Android, and desktop, with and without background noise: at least 144 runs. Record the actual utterance and expected behavior, not just a pass/fail impression. Seed scenarios:

1. Jordanian greeting: “مرحبا، بدي أتعلم ألماني، من وين نبلش؟” — Jordanian reply, one short teaching step.
2. Jordanian with a German target: “شو معنى Guten Morgen؟” — Arabic response, German pronunciation, one valid vocabulary item.
3. Jordanian with incidental English: “أنا today تعبان شوي” — no unrequested language switch.
4. German request: “Sprich bitte Deutsch mit mir.” — switch immediately and retain it.
5. Explicit Jordanian request: “احكي معي أردني” followed by “Guten Morgen” — remain Jordanian unless a new explicit request is made.
6. English request: “Let's practice English.” — switch immediately; no Arabic filler.
7. A 2-second thinking pause: “Ich möchte … [pause] morgen nach Berlin fahren” — do not answer during the pause.
8. Self-correction: “بدي أروح يوم الخميس… لا، الجمعة” — final intent is Friday.
9. A short acknowledgement during Rita speech: “مم” — Rita continues and the reply is not logged as interrupted.
10. A true interruption during Rita speech: “استني، مش فاهم” — audible speech stops promptly and Rita handles the new question.
11. Speaker echo while Rita talks — no false learner turn.
12. Background conversation — do not treat another voice as the learner's command.
13. “شو صار بحرب المغول؟” — answer the history question; create no vocabulary item.
14. “ترجم: أنا بدي أروح عالجامعة” — correct translation and valid hidden learning JSON.
15. “أعطيني خمس كلمات ألماني عن السفر” — exactly the requested vocabulary, not one large flashcard.
16. “احفظ الكلمات في German Lab / Travel” — report success only after the named destination contains the items.
17. Repeat scenario 16 — no duplicate saved items.
18. Request a pronunciation correction with a clean clip — one high-impact correction, not a fabricated score.
19. Repeat the pronunciation attempt twice unsuccessfully — change teaching method instead of repeating identical feedback.
20. Noisy pronunciation clip — say uncertainty and ask for a retry, not a confident negative judgement.
21. A 5-word answer and a 40-word answer — verify first-clause timing and natural prosody; no bad cut inside Arabic or German grammar.
22. Cancel midway through a long Rita answer — no later audio and no unheard text in the visible chat or remembered context.
23. Disable Soniox, Groq, or Gemini in an isolated test account — show the specific error; no legacy voice starts.
24. Start, exit, and start again after idle — no stale audio/chat, no leaked session, and record cold/warm startup separately.

## Measurement contract

One turn has a stable `turnId`. Log speech start/end, Soniox partial/final, turn decision, Groq request/first token/first useful phrase, Gemini request/first audio, remote-audio signal, actual audible playback start, interruption onset, and playback stop. Store session start/ready separately. Report p50/p95/p99, sample count, browser/device, language, network, region, response type, provider errors, and measured provider bill. Do not merge filler audio with first **real** assistant audio.

`first_remote_audio` in the website is only an **audio-level proxy**. It is not evidence of the first sample heard through an iPad speaker; the acceptance reporter therefore requires `source: "recorded_audio"` and a manually or instrumentally validated `audibleLatencyMs`. p95 is provisional below 200 eligible samples; p99 is provisional below 1,000. Empty data is "no samples", never 0 ms.

## Launch gates

- On good networks, last user audio to first genuinely audible Rita audio: p50 < 1,500 ms, p95 < 2,500 ms. Clear-speech turn decision: p50 < 450 ms.
- True interruption audible stop: p50 < 200 ms, p95 < 400 ms. Premature end during thinking pauses < 3%; harmless backchannels classified as interruptions < 3%.
- Explicit language changes work on the first turn. Borrowed target-language words do not change the conversation language. No unwanted switch in each 20-turn stability case. Jordanian ratings average at least 4/5 on all three dimensions.
- Human-reviewed intent understanding is at least 95% across the 910 speech cases; target-language terms are correctly captured in at least 95% of the code-switch cases. Report WER and semantic term recall separately by language so aggregate scores cannot mask Jordanian failures.
- No learning items from 100 general-knowledge questions. All 100 explicit vocabulary/translation cases must yield reviewed, valid JSON and correct meanings. Saves must be verified in the selected database destination and idempotent. Never claim a save that failed.
- Two unsuccessful learning attempts cause a visibly different teaching strategy. No definitive pronunciation criticism when the audio is unreliable. Errors from every provider are visible, cancellable, and never switch to legacy.
- Cold/warm startup, Soniox WER/semantic term recall, cost per 5/15/60-minute session, and provider failure rates are measured and published before rollout. The research PDF offers no reliable universal pass number for these; use a measured baseline and review the results instead of inventing a pass.

## Recording the results

Create a UTF-8 JSONL file with one object per tested scenario. Required fields for all rows: `id`, `category`, `source: "recorded_audio"`, `network`. Timing fields in milliseconds: `audibleLatencyMs`, `turnDecisionMs`, and `interruptionStopMs` (for true interruptions). Boolean/outcome fields by category: `intentUnderstood`, `targetTermsCorrect`, `prematureEnd`, `falseInterruption`, `learningItemCount`, `learningJsonValid`, `learningMeaningCorrect`, `savePersisted`, `duplicateCount`, `turnCount`, `wrongLanguageSwitch`, `changedStrategy`, `visibleError`, `legacyFallback`, `uncertaintySafe`. Jordanian ratings require `ratingCount >= 3`, `naturalnessScore`, `dialectScore`, and `intelligibilityScore` (each 1–5, averaged from the reviewers).

Run `node scripts/rita-v3-qa-report.mjs results.jsonl` from the repository root. Exit code 0 means all **automated** launch gates passed; 1 means a gate failed or evidence is missing; 2 means input/usage failure. The reporter does not call providers or charge money. Keep the failing case IDs and recordings for diagnosis, repair one subsystem, then rerun the _entire_ corpus to detect regressions. The report is a gate, not a substitute for a human listening review.

## Current status on 2026-09-30

- Code-level smoke tests exist for language intent, state, TTS event decoding, startup diagnostics, and interrupted-reply history; these do **not** establish acoustic quality.
- No 910-case consented audio corpus or blind Jordanian listening panel is present in this repository. All live acoustic and subjective launch gates therefore remain **unverified**.
- The browser records a remote audio-level proxy. A first-sample audible measurement still needs test-session recording analysis before the latency gate can pass.
- Pre-rendered same-voice filler assets, local immediate ducking, and a dedicated pronunciation scorer are not established by the current code; these remain candidate remediation items, not completed features.
