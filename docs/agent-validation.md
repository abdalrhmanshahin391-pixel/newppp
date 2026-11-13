# Validation map

Read when choosing checks, especially for shared infrastructure, auth, billing, APIs, migrations,
concurrency or voice. Commands below are entry points found in this repository, not results.
Read the applicable workflow at the current commit for its full required command list.

## Environment and required gates

- Web CI uses Node 22 and Bun with `bun.lock`. Use existing dependencies and
  `bun install --frozen-lockfile` when installation is authorized and needed. Do not switch
  package managers because an old README mentions npm; preserve `bunfig.toml` supply-chain guards.
- Web completion gates include `bunx tsc --noEmit`, relevant ESLint checks and `bun run build`
  as required by the affected workflows. There is no universal package `test` script. Some pure
  tests run with `node --test`; some component tests use Bun. Do not substitute one runner blindly.
- CI Python is 3.12; the voice project's `pyproject.toml` allows 3.11+. Use the environment and
  dependencies specified by the relevant CI/project. No automatic installation or upgrade is
  authorized by this map. Missing Bun, browsers, Postgres/pgTAP or worker packages must be reported.
- For a bug, establish a reproduction or equivalent verification target when feasible. Iterate
  with focused checks, then complete applicable repository/CI requirements. Expand for risk;
  do not remove tests, lower types/lint or weaken acceptance criteria to reduce usage.
- Identify pre-existing failures from an equivalent baseline when feasible; preserve diagnostics.
  Passing selected tests does not prove full correctness. Report unrun required checks explicitly.

## Entry points by affected area

| Area | Focused starting checks | Required reference / broader gates |
|---|---|---|
| Voice startup/connection | `node --test src/lib/rita-v3-startup.test.mjs`; `node --test src/lib/rita-voice-connection.test.ts` | `.github/workflows/rita-v3-frontend-check.yml`; types, affected regressions, build |
| Books, import, reader | `node --test src/lib/books.test.ts`; select `books-import.test.ts` / `books-reader.test.ts` when relevant | Same frontend workflow plus database checks for schema/access changes |
| Startup, navigation, shared UI | Affected Bun tests listed in `.github/workflows/startup-check.yml` | That workflow's Chromium/WebKit checks, types, build; visual changes also read the design workflow |
| Settings, authentication, billing | Affected settings/subscription tests | `.github/workflows/settings-check.yml`: permission/ownership cases, lint/types, browser checks and build |
| Study/SQL/RLS | `bash scripts/test-study-db.sh`; `bash scripts/test-books-db.sh`; `bash scripts/test-books-public-read-db.sh`, as affected | PostgreSQL 16; full library runner needs pgTAP. These create/recreate test databases: use an explicitly isolated local disposable database, never production. Read scripts and verify connection variables before running. |
| Python voice worker | From `voice-agent`: `python -m pytest tests -q`, or the affected test files during iteration | `.github/workflows/rita-v3-worker-check.yml`: its dependency setup, compilation/import checks and full suite |
| Lesson engine / Edge shared copies | `node --test src/lib/rita-lesson-edge-sync.test.ts` plus affected engine/run tests | Frontend workflow; regenerate shared copies using the existing sync script if engine changes require it |
| Workflow documentation / instruction-only skills | Review diff, relative links and instruction precedence; validate skill metadata with the available host validator and confirm discovery | Applicable existing PR CI still applies. These static checks alone do not demonstrate a quality/cost improvement. |

Use the current path filters and job definitions to identify applicable CI; do not assume every
listed command is necessary for every edit, or that a path filter establishes behavioral coverage.
Shared/auth/API/concurrency changes can require more than the automatic selection.

## Voice safety and latency

This is a real-time application. The inspected pipeline in `voice-agent/bot.py` is Daily WebRTC
input, Soniox STT, user aggregation/router, Groq LLM, speech processors, Cartesia TTS, Daily output,
assistant aggregation. The Python worker deploys independently of the web application. Re-read the
actual pipeline and affected frontend/session routes before proposing a voice modification.

Existing investigation/test entry points include:
- `voice-agent/tests/test_rita_interruption.py` and `test_rita_cartesia_tts.py`: interruption and TTS;
- `test_rita_connection_retry.py`, `test_rita_turn_ledger.py`, `test_rita_state.py`: connection,
  session/turn identity and state;
- `test_rita_lesson_voice.py`, `test_rita_study_voice.py`, `test_rita_latency.py`: lesson/streaming
  behavior and timing logic. Inspect assertions before claiming a scenario is covered.

For relevant changes, verify that interrupting playback stops the intended audio, cancelled or
superseded replies cannot resume, stale events cannot cross sessions/turns, reconnects/timeouts and
partial failures are handled, and streaming plus lesson state remain correct. Existing unit tests
may not replace an authorized real-call acceptance check; disclose that gap.

`voice-agent/rita_latency.py`, `voice_probe.py` and the existing probe workflows are starting points
for application measurements. Probes may contact providers, use secrets and incur cost: obtain
authorization before running them. Keep application latency separate from coding-agent completion
time; TTS-only first-audio timing is not end-to-end user-perceived latency. Report p50/p95 only from
actual samples with the measurement definition, sample count and environment. Do not claim the
workflow configuration improves runtime latency or change runtime prompts for agent-token savings.
