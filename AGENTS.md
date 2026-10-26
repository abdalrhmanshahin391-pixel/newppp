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

## Backend: one documented exception to "no Edge Functions"
The project rule is to use in-app server functions, not Edge Functions. The published site's server has no
service-role key, and lessons with exercises must read protected content (it holds the answer keys), so
**one** Edge Function exists: `supabase/functions/rita-lesson-run`. Lovable Cloud gives it the key
automatically. The app's server functions in `src/lib/rita-lesson-run.functions.ts` only forward the
learner's token to it. The engine files it uses are copied into `supabase/functions/_shared` by
`node scripts/sync-lesson-edge.mjs`; a test fails when a copy drifts. Do not add other Edge Functions
without asking the owner.
