# RitaJet — fresh copy with a brand-new database

## What I found

Your GitHub account has two repositories. The RitaJet app is **zip-to-live-studio** (public, last updated 23 Sep 2026). It contains the full site: home, courses, German learning section, notes, question bank, pricing/checkout, profile, login/register/forgot-password, a large admin area (users, roles, groups, plans, offers, promo codes, AI keys, notifications, support, spaces, devices, content protection), plus a database folder with 100+ setup files and saved connection details for the old backend.

## What you get

A clean rebuild of the same app in this project, running on a brand-new, empty Lovable Cloud database with no link whatsoever to the old one. Nobody's old account or data carries over — everyone signs up fresh, including you.

## Steps

1. **Bring the code in** — download the repository and copy the app into this project: all pages, components, styles, images, translations, and helpers. The old `.env` files and the old backend connection files are deliberately left behind.
2. **Create the new database** — enable Lovable Cloud here, which provisions a fresh, isolated database and login system for this project only.
3. **Rebuild the structure** — replay the old project's table structure (accounts/profiles, roles, courses and German content, notes, question bank, plans/offers/promo codes, support, notifications, spaces/groups) as one clean consolidated setup on the new database, with fresh security rules so each user only sees their own data and admins are checked server-side. No rows are copied over — the database starts empty.
4. **Reconnect the app** — point every page and server call at the new database, and turn on email sign-up/sign-in so login works from the first try.
5. **RitaVoice** — rewire the voice feature end to end (recording, AI voice, saved history) to the new database. Any old table, key, or endpoint it referenced is removed, not reused.
6. **Make you the admin** — after you sign up once on the new site, I grant your account the admin role in the new database.
7. **Check it works** — sign up, log in, reload, open the main pages and the admin area, and use RitaVoice, confirming there are no errors before I hand it over.

## Things I need to confirm as I go

- **Payments (Paddle/Stripe) and AI keys**: the old project used these. Their credentials are not in the code and don't come across. When I reach those parts I'll ask you for the keys through the secure form, or we leave payments switched off for now.
- **Uploaded images/files** stored in the old backend can't be pulled across automatically; only images kept inside the code repository come with it.
- If the rebuilt database structure differs slightly from the old one where the old one was broken, I'll fix it rather than copy the fault — that's the point of starting fresh.

## Technical notes

- Source: `abdalrhmanshahin391-pixel/zip-to-live-studio`, branch `main`; fetched as a tarball and copied in, excluding `.env*`, `.git`, `node_modules`, `src/integrations/supabase/*` and `supabase/migrations/*` from the old project.
- Target stack matches this project's TanStack Start template; the repo is already TanStack Start, so routes drop in with minimal adjustment. `routeTree.gen.ts` regenerates.
- New Cloud project via `supabase--enable`; schema applied as a single consolidated migration derived from the 100+ historical migrations, each public table with explicit GRANTs, RLS enabled, and roles in a separate `user_roles` table behind a `has_role` security-definer function.
- Auth: email/password enabled via `enable_email_auth`; `_authenticated` gate and bearer middleware from the current template.
- Generated Supabase client/types are regenerated for the new project; no old project ID, URL, or key remains anywhere in the codebase.
