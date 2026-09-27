# Move RitaJet to GitHub (code + database structure) for Codex editing

## What you want

Everything we built here — the code and the database tables — available on GitHub so you can edit from Codex and have the changes appear here without breakage.

## The honest picture first

- **Code: full two-way sync.** Once connected, every change I make here pushes to GitHub automatically, and every change you push from Codex appears here. This works well and is safe.
- **Database: one-way export, not live sync.** The database itself (the live tables and the data inside them) stays on Lovable Cloud — GitHub cannot host a live database. What we CAN put on GitHub is the **database structure as SQL files** (every table, every rule, every function we created). Codex can then read and edit those files, and when you push changes, I apply them to the live database here.
- **Important rule to avoid breakage:** if Codex edits the SQL files, the change only becomes real after it's applied to the live database. If you edit tables directly in Codex's SQL files and also let me change the database here without syncing, the two will drift. The safe workflow: Codex edits SQL files → push → tell me → I apply them here.

## Steps

1. **Export the database structure to the project** — I generate clean SQL files under `supabase/migrations/` covering everything we built: all tables (profiles, roles, courses, German content, notes, question bank, plans, offers, promo codes, support, notifications, spaces, RitaVoice settings/usage/metrics), the security rules (RLS policies), the role system (`has_role`), and the RitaVoice settings row. These files become part of the code and sync to GitHub like everything else.
2. **Connect the project to GitHub** — you do this part (it needs your GitHub login): open the **+ menu** in the chat input → **GitHub** → **Connect project** → authorize the Lovable GitHub App → create the repository. From that moment, code syncs both ways in real time.
3. **Verify the sync** — I make a small harmless change here, confirm it appears on GitHub, and confirm the repo contains the full app plus the database SQL files.
4. **Write a short `AGENTS.md` note for Codex** — a file at the repo root telling Codex (or any editor) the rules: where the SQL files live, that database changes must be applied through Lovable, which files are auto-generated and must not be edited, and the RitaVoice architecture rules, so edits from Codex don't break the app.

## What this does NOT do

- Your users' data (accounts, progress, saved cards) is not copied to GitHub — it stays private in the live database. Only the empty structure goes to GitHub.
- GitHub will not run the app by itself; it stays hosted here. GitHub is for editing and backup.

## Technical notes

- Schema export produced from the live database (tables, constraints, RLS policies, functions, grants) into ordered migration files under `supabase/migrations/`.
- `AGENTS.md` updated with: sync workflow, do-not-edit list (generated client/types, routeTree), and the rule that SQL file edits require applying a migration here.
- No changes to how the app runs; this is export + connection + documentation only.

do u want to apply it like lovable
