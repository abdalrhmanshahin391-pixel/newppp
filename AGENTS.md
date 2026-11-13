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

## Scope and review
- Follow the owner's current planning and approval requirements. A stricter global/user rule
  still applies; this file does not remove it. Otherwise use a brief internal plan for routine
  changes and present a reviewable plan for ambiguous or high-risk work. Plans requiring approval
  end with exactly: **"do u want to apply it like lovable"**. Wait for approval when required.
- Preserve requested behavior and acceptance criteria. Make the smallest complete change;
  expand investigation when evidence requires it. Avoid unrelated refactors or dependency upgrades.
- Review the diff and run affected checks plus applicable required CI before declaring completion.
  Report failures and unrun checks; selected passing tests do not establish full correctness.
  Merge, deploy, publish and production changes require authorization for that action.

## Repository constraints
- Web: React/TypeScript, TanStack Start, Vite, Lovable/Cloudflare, Supabase. CI uses Node 22,
  Bun and `bun.lock`: `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bun run build`.
  Use the risk-specific validation map below; do not assume a universal `test` package script.
- Keep provider/service-role/worker keys server-side, never in browser code or `VITE_*`.
  Do not commit credentials, private payloads or sensitive logs. Keep RLS and authorization intact.
- Prefer in-app server functions. Only two Edge Functions are approved: `rita-lesson-run`
  (learner-token forwarding) and `rita-review` (worker-key-authorized review, counts only).
  Both use `verify_jwt = false`; their own authorization must remain. Keep shared engine copies
  synchronized with `node scripts/sync-lesson-edge.mjs`. New Edge Functions need owner approval.
- Database work is event-driven. Only `vault-daily-snapshot` may run on a timer; do not add polling
  or other scheduled jobs. Any new background job needs owner approval.
- Lovable's Vite wrapper already supplies React/TanStack/Tailwind/Nitro plugins; see
  `vite.config.ts` before changing build configuration to avoid duplicate plugins.

- Public product and assistant identity is Uzyra / يوزرا. Historical `rita` routes, tables, keys and event names remain compatibility contracts. Do not edit historical user messages.

## Read when relevant
- For identity/prompt changes: read [the identity contract](docs/uzyra-identity.md).
- For a fix or feature: use [focused-change](.agents/skills/focused-change/SKILL.md).
- Before choosing validation, or for auth/billing/API/SQL/voice changes:
  read [the validation map](docs/agent-validation.md).
- For tool-output handling, sessions, handoffs, or workflow compatibility:
  read [the workflow reference](docs/agent-workflow.md).
- For any visual/UI change: read [the design workflow](docs/design-workflow.md), `DESIGN.md`
  and `PRODUCT.md`; preserve its Design Brief, approval and hard-review requirements.
  Use only relevant existing design skills, not the entire collection.
- Only when an optimization trial is approved: read [the pilot protocol](docs/agent-workflow-pilot.md).
