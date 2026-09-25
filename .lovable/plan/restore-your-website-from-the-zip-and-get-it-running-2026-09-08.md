# Restore your website from the zip and get it running

Your zip is a complete export of your site: 94 pages, all the artwork, the styling, and 142 database setup files. The goal is to bring all of it in here, rebuild the backend fresh, and confirm the site loads with no errors.

## What I'll do

1. **Bring in the site files**
   Copy everything from the zip into this project: pages, components, artwork, translations, helpers, styling. Skip the video-rendering folder (as you chose) and skip any hidden version-control data.

2. **Install everything the site needs**
   Match the exact package list from your export so nothing is missing or mismatched.

3. **Turn on the backend (fresh and empty)**
   Enable Lovable Cloud, then replay all 142 database setup files in order so every table, permission rule, and helper function exists exactly as before. No old accounts or saved content comes along — you'd sign up again and the site starts clean.

4. **Reconnect the site to the new backend**
   Your export points at your old backend. I'll relink the site's connection files and keys to the new one so logins, saving, and loading work here.

5. **Leave outside services unlinked, as you asked**
   Payments, email sending, and any Google/AI keys stay switched off or in a safe "not configured" state — nothing will crash because of them, and you can add the real keys later. I'll list exactly which ones are waiting on you.

6. **Check it properly**
   Run the full build, fix every error that appears, then open the site and click through the main pages (home, sign-up/sign-in, study areas, admin) to confirm nothing is broken on screen or behind the scenes.

## Technical notes

- Source: `Website_Revival.zip` — TanStack Start v1 + React 19 + Tailwind v4 export; same stack as this template, so no framework conversion is needed.
- Copy with `rsync --exclude='.git' --exclude='remotion'`; keep `.lovable/plan/` history out of the app copy.
- Dependencies: adopt the export's `package.json` (Radix, framer-motion, pdfjs-dist, unpdf, katex, i18next, recharts, jszip, pako, dompurify, paddle SDK, etc.) and install with bun.
- Backend: `supabase--enable`, then apply `supabase/migrations/*.sql` in filename order. Migrations that reference the old project ref, old auth users, or seeded rows tied to the old instance get adjusted so they apply cleanly against an empty database; every new public table keeps its GRANTs + RLS.
- Regenerate `src/integrations/supabase/*` from the integration and reconcile the export's legacy client/middleware files with the generated ones; drop `.env*` from the zip and use the injected Cloud env vars.
- Server-side: keep `createServerFn` usage; verify no protected server function is called from a public route loader (that fails prerender).
- Known unconfigured externals to stub safely: Paddle payment tokens, AI provider keys (admin AI keys page), push notifications service worker, email sending.
- Verification: `vite build`, `build:dev` prerender, TypeScript check, then a Playwright pass over key routes capturing console errors.

## Expected rough edges

Anything that talked to your old backend's stored data (existing decks, uploaded PDFs, admin accounts) will be empty until you re-add it or relink your original backend. Features needing keys you said to skip will show as "not configured" rather than break.
