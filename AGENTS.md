<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Mandatory Planning Protocol
1. **Always Plan First**: For every task, inquiry involving changes, bug fix, or feature, create a comprehensive architectural implementation plan first. Do NOT edit code, run modifying commands, or make changes until the plan is approved.
2. **Senior Architect Standard**: Plans must analyze edge cases, state lifecycles, error states, and invariants thoroughly (Lovable-level architectural review).
3. **Approval Phrase**: When the plan is ready, conclude with the exact phrase:
   **"do u want to apply it like lovable"**
4. **Execution**: Only execute the changes after the user explicitly replies to apply it.

## Design Work Protocol
For any visual or UI change, follow `docs/design-workflow.md` (three rounds: Design Brief,
build, hard review) and the system in `DESIGN.md`. Use the skills in `.claude/skills/` listed
there. The Mandatory Planning Protocol above still applies: the Design Brief is the plan, and
it ends with the approval phrase.

## Backend: the two approved Edge Functions
The project rule is to use in-app server functions, not Edge Functions. The published site's server has no
service-role key, so the few operations that must read protected rows across all users run as Edge
Functions, which Lovable Cloud gives the key automatically. Exactly two are approved:
`supabase/functions/rita-lesson-run` (a learner's lesson run; the app's server functions in
`src/lib/rita-lesson-run.functions.ts` only forward the learner's token) and
`supabase/functions/rita-review` (the AI review of Rita's replies; it needs the worker key from
`site_secrets.worker_cron_key` and returns counts only). Both set `verify_jwt = false` in
`supabase/config.toml`. The engine files they use are copied into `supabase/functions/_shared` by
`node scripts/sync-lesson-edge.mjs`; a test fails when a copy drifts. Do not add other Edge Functions
without asking the owner.

## Background work must be event-driven, not polling
Nothing may wake the database on a timer except the one daily backup
(`cron.job` name `vault-daily-snapshot`); timed polling is what kept the instance awake and billed
compute while no one visited. Work that follows a user action starts from a trigger or from the call
itself — for example the wake trigger on `rita_v3_sessions.ended_at` and the admin's "review now"
button — and any new background job needs the owner's approval first.
