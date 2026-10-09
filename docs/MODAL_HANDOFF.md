# Rita voice worker on Modal: handoff

Branch: `modal-coldstart` (not merged into `main`). Written 2026-10-09 for whoever continues this work.
No secret values are in this file or in the code. Never commit keys.

## Why
The Rita voice worker (Pipecat 0.0.105, `voice-agent/`) ran on Pipecat Cloud with `min_agents = 0`.
The first session after idle waited ~15s (once 88s, see `src/components/rita/RitaRealtimeV3.tsx` ~line 597):
container boot, library imports, Silero VAD + Smart Turn v3 model loads, Daily/Soniox connect. The website
blocked on `/start` for up to 45s. Goal: ~1s join when warm, 2-4s when cold.
Not fixed by this: Gemini TTS time-to-first-byte (2.3-3.3s in `docs/rita-v3-one-minute-smoke-2026-09-30.md`).

## What was changed (commit on this branch)
- `voice-agent/bot.py`: `bot(args)` is now a thin wrapper around new `run_bot(room_url, token, session_id, body)`.
  Pipecat Cloud still works unchanged; Modal calls `run_bot` directly.
- `voice-agent/modal_app.py` (new): Modal app `ritajet-voice`.
  - `RitaWorker` class: `min_containers=1`, `enable_memory_snapshot=True`, `@modal.concurrent(max_inputs=6)`.
    `@modal.enter(snap=True)` pre-imports the bot and builds Silero VAD + Smart Turn once (no sockets before the snapshot).
    `run_session(...)` runs the pipeline.
  - `start_session`: public POST endpoint. Checks `payload["token"]` against `RITA_MODAL_TOKEN` (`hmac.compare_digest`),
    creates a private Daily room + a learner token + an owner token for the bot (Daily REST API), spawns
    `RitaWorker().run_session` in the background and returns `{dailyRoom, dailyToken, sessionId}` immediately.
  - Secret used: Modal secret `ritajet-voice` (names only: SONIOX_API_KEY, GROQ_API_KEY, GOOGLE_API_KEY,
    DAILY_API_KEY, RITA_MODAL_TOKEN).
- `src/routes/api/rita-v3/session/start.ts`: if `RITA_BACKEND=modal` and `MODAL_START_URL` + `MODAL_START_TOKEN`
  are set, call the Modal endpoint with a 10s deadline; otherwise use the original Pipecat Cloud path (45s). Pipecat
  stays the default, so rollback = remove/rename `RITA_BACKEND`.
- `voice-agent/tests/test_architecture_contract.py`: added a Modal contract test. `.github/workflows/rita-v3-worker-check.yml`
  now also compiles `modal_app.py`.

## Current state
- Deployed to Modal workspace `abdalrhmanshahin391`, env `main`. Endpoint:
  `https://abdalrhmanshahin391--ritajet-voice-start-session.modal.run`
- Verified: deploy works, memory snapshot created and restored, wrong token returns 401 (~0.6s warm),
  all provider keys in the Modal secret returned 200 when tested from inside Modal (Daily, Groq, Google/Gemini
  AI Studio key, Soniox on the EU API `api.eu.soniox.com`; the bot uses `wss://stt-rt.eu.soniox.com`).
- Lovable project "RitaJet Revival" has secrets `RITA_BACKEND=modal`, `MODAL_START_URL`, `MODAL_START_TOKEN`
  (same value as Modal's `RITA_MODAL_TOKEN`). Changes apply to the live app only after Lovable Publish.
- NOT verified: a real end-to-end call, join time, or the ~1s goal. No numbers exist yet.
- Contract tests pass locally (`python -m pytest voice-agent/tests/test_architecture_contract.py`, 7 passed).
  The rest of the Python suite and the full pipeline cannot run on Windows (no `daily-python` wheel); use Linux/CI/Modal.

## What still has to happen
1. Open a PR from `modal-coldstart` to `main`, let CI run (`rita-v3-worker-check`, `rita-v3-frontend-check`), merge.
2. In Lovable, Publish. Note: recent Lovable commits showed "Build unsuccessful / Preview is out of date"; check
   the build logs first, the merge will not help if the build is already broken.
3. Real test: open the site, start a Rita session, allow the microphone, confirm Rita joins and speaks. Measure
   time from click to Rita joined, cold (after a few idle minutes) and warm. Compare with `RITA_BACKEND` unset.
4. If good: stop Pipecat Cloud (`ritajet-voice-v3`) to avoid paying twice. If bad: unset `RITA_BACKEND`.
5. Optional later: shrink the 2-3s Gemini TTS first-byte (separate problem).

## Useful commands (from the repo root, Python 3.12 with `modal` installed)
- Deploy: `modal deploy voice-agent/modal_app.py` (run inside `voice-agent/` so local modules resolve).
- Logs: `modal app logs ritajet-voice`. List containers: `modal container list`.
- Secrets are read when a container starts. After editing the secret, redeploy and, if needed,
  `modal app stop ritajet-voice --yes` then deploy again, so warm containers pick up new values.
- Stop everything (stops billing): `modal app stop ritajet-voice --yes`.

## Cost and risks
- Two containers stay warm (`min_containers=1` on the worker and the endpoint). Small but non-zero Modal cost; verify current pricing.
- Daily room minutes are now billed to the owner's own daily.co account (Pipecat Cloud used to create rooms).
- `start_session` creates a real Daily room and spawns a bot on every valid call. Do not hit it casually.
- `.env` is committed in the repo. If it holds real keys, rotate them and remove the file from history in a safe way
  (do not force-push: this repo is synced with Lovable).

## Ground rules for this repo
- `AGENTS.md`: plan first and wait for approval; never force-push or rewrite pushed history; keep `main` working.
- Git uses `core.autocrlf=true` on the owner's Windows machine, so diffs can show whole-file line-ending noise.
  Compare with `git diff --ignore-space-at-eol`.
- Never put API keys in code, docs, commits or chat. The owner enters keys in Modal and Lovable himself.
