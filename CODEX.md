# Editing this project from Codex / GitHub

This project is connected to Lovable and syncs two-way with GitHub: commits you push to the connected branch appear in Lovable, and Lovable edits push back here.

## Golden rules

1. **Never rewrite published git history** — no force-push, rebase, or amend/squash of commits already pushed. It breaks the Lovable sync and the user loses project history.
2. **Keep the branch in a working state** — every push goes live in the Lovable editor.

## Database changes

- The full database structure lives in `supabase/migrations/` as ordered SQL files (every table, GRANT, RLS policy, function, trigger). These files are a **record** of what was applied — editing one here does NOT change the live database.
- To change the database: add a **new** migration file (never edit an already-applied one), push it, then ask in Lovable to apply it. The live database is managed by Lovable Cloud; there is no automatic DB sync.
- Every new `public` table needs, in this order: `CREATE TABLE`, `GRANT`s (to `authenticated` and `service_role`; `anon` only for truly public reads), `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, then `CREATE POLICY`.
- User roles live only in the `user_roles` table, checked via the `has_role` security-definer function. Never store roles on `profiles`.

## Do not edit (auto-generated)

- `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `previewAuthStorage.ts`, `types.ts`
- `src/routeTree.gen.ts`
- `.env`, `supabase/config.toml`

## Secrets

API keys are never in this repo. They live in Lovable Cloud environment variables and the `admin_ai_keys` table. Never commit keys.

## Stack notes

- TanStack Start v1 + React 19 + Vite 7, Tailwind CSS v4 (theme in `src/styles.css`), Supabase (Lovable Cloud) backend.
- Server logic uses `createServerFn` from `@tanstack/react-start` in `*.functions.ts` files; webhooks/public endpoints are server routes under `src/routes/api/public/`. Do NOT create Supabase Edge Functions.
- Auth-required routes live under `src/routes/_authenticated/`; public routes have no auth gate.
- RitaVoice architecture rules are in `AGENTS.md` — follow them (single selected STT engine, no fallback chain, Groq only for replies, Fish/OpenAI only for speech).
