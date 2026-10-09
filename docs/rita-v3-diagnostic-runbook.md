# Rita v3 diagnostic runbook

This runbook is for one bounded acceptance probe. It diagnoses speed and
reliability; it is not a human voice-quality evaluation.

## Evidence collected

The browser emits a content-free `traceId` before the start request. Lovable
stores start-request timing against the application session. Modal returns its
Daily provisioning and worker-spawn durations. The worker writes monotonic
milestones for Soniox, Smart Turn, Groq, Gemini PCM, and pipeline errors. The
browser stores its own transport and audio-level timestamps. Do not subtract
worker wall time from browser wall time: compare only durations within each
source, joined by trace ID.

`first_remote_audio_level` is an audio-level proxy, not proof a person heard a
speaker. `tts_first_non_silent_pcm` proves only that Gemini emitted non-silent
PCM to the worker. The synthetic probe records received Daily PCM and is also
not an iPad hearing test.

## One-run procedure

1. Confirm the deployment is Modal, its secrets are present, and no legacy
   fallback is enabled.
2. Run worker/frontend tests and build. Do not deploy if any fails.
3. Run `Rita v3 short voice probe` once. If `RITA_PROBE_START_URL` and
   `RITA_PROBE_START_TOKEN` repository secrets exist, it tests Modal; otherwise
   it explicitly reports `start_backend: pipecat` and is not evidence for Modal.
4. Review `metrics.json`, captured response audio, application-session events,
   and worker logs using the same trace ID. Pipecat agent logs can also be
   filtered by session ID when that backend is used.
5. Perform one human device check only after the synthetic run is clean:
   Arabic with `Guten Morgen`, an explicit German switch, one general question,
   then interrupt Rita during speech.

## Diagnosis rules

- Slow `start_upstream_response` with slow Modal `daily*Ms`: Daily provisioning.
- Fast credentials but slow `bot_ready`/worker startup: Modal container or
  worker initialization.
- Slow `stt_first_final`: Soniox/STT or user-network input.
- Slow `turn_committed` after STT final: VAD/Smart Turn policy.
- Slow `llm_first_answer_text`: Groq/context generation.
- Slow `tts_first_bytes` or `tts_first_non_silent_pcm`: Gemini TTS.
- Fast worker PCM but slow browser audio-level event: Daily/WebRTC/browser
  playback path.
- Any `provider_error` is classified by provider name and exception type only;
  no transcript or secret belongs in the log.

## Guardrails

The probe has no retry, requires all four scripted turns and a real barge-in,
and stops on an empty/late audio response. Keep it to one run during a
diagnostic round. It must never publish provider keys, raw tokens, transcripts,
or user audio outside the short-lived CI artifact.
