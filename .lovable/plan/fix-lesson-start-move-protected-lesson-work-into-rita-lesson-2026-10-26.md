# Fix lesson start: move protected lesson work into `rita-lesson-run`

## Root cause
`src/lib/rita-lesson-run.functions.ts` (line 32) loads the old `legacy-client.server` admin connection to read `rita_lesson_contents`. The published site's server has no service-role key, so every lesson start fails. Learners can't read that table directly, and that is intentional.

## Platform note (decision needed)
This project's standard rule is: do not add new backend Edge Functions; use in-app server functions instead. Here, though, the in-app server can't hold the admin key. The Edge Function runtime gets the key injected automatically, so it is the only place that can read protected content without you adding a secret and without loosening RLS. I will make this one documented exception and record it in `AGENTS.md`.

## What gets built
1. `supabase/functions/rita-lesson-run/index.ts`
   - CORS preflight, and only POST is accepted.
   - Reads `Authorization: Bearer <jwt>` and verifies it with `auth.getClaims()`. Missing or invalid token returns 401.
   - Routes on `{ op: "start" | "event" | "answer", ... }`, with input validated by zod. Bad input returns 400.
   - Uses the injected admin connection inside the function only. Ownership is checked on every call: a run must belong to `claims.sub`, and the lesson must be published and in the learner's language/path.
   - Ports the existing logic (parse content, engine `initialState`/`stepOf`, grading) by bundling copies of `rita-lesson-content` and `rita-lesson-engine` into `_shared/`. These are pure TS with no Node APIs.
   - Responses: start/event return `RunView`; answer returns `{ correct, feedback, view }`. A whitelist serializer strips answer keys, `accepted`, `solution`, and raw content.
   - Errors return safe JSON `{ error: code }`. Details are logged server-side only.
2. App call site: the three exported server functions in `rita-lesson-run.functions.ts` keep their names and signatures, so the UI is unchanged. Each one forwards the caller's bearer token to the Edge Function through `fetch(SUPABASE_URL/functions/v1/rita-lesson-run)`. The `legacy-client.server` import is removed from this file.
3. Admin/teacher flows (curricula editor, content authoring) are left untouched.
4. A small test checks that the sanitizer never outputs answer fields, and that a run owned by another user is rejected.

## Invariants
- RLS on `rita_lesson_contents` and runs is unchanged. A direct learner select still returns 0 rows.
- No secret appears in frontend code or the repo.
- Missing lesson → 404, unpublished → 403, run not owned → 403, function unreachable → app shows the existing lesson error state.

## Verification
Typecheck + build, deploy the function, check its logs, then sign in as the admin test account and start a lesson on `/rita-lessons`. I'll confirm a RunView comes back with no answers in the network payload.

## Limits
- I can't run git commit/push myself. Lovable syncs commits to GitHub automatically once a repo is connected, and right now none is connected.
- If no published lesson content exists yet, the start test will stop at "no content". I'll report that if it happens.

do u want to apply it like lovable
