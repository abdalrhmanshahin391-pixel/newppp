# Apply learning languages migration + set book languages

## Step 1 — Apply migration
Apply `supabase/migrations/20261020180000_learning_languages.sql` exactly as committed (no code, secret, or other schema changes). It creates the languages list (English, German), adds the learner's chosen language to profiles, adds a language tag to flashcards/lessons/conversations/shared decks, and the `set_learning_language` function.

Verify afterwards:
- `learning_languages` exists with RLS on, has `en` and `de`, read-for-signed-in + admin-only write policies.
- New `language` columns and `profiles.learning_language` / `legacy_language` exist.
- `/admin/languages` no longer shows the "not applied" warning.
- Regenerate database types so the app compiles against the new structure.

## Step 2 — Book languages
List every book in the curriculum library with its current language (titles only, no user data). Books that are clearly German (by title/content) get set to German; everything else stays English. You can still change any book later in `/admin/curricula`.

## Step 3 — Publish
After both steps, request a publish so ritajet.com picks up the new version (security scan checked first).

## Edge cases
- Migration is idempotent (`if not exists`), so a partial earlier run is safe.
- If any old book has a language not in the list, the new book-language rule is `not valid` and won't fail on existing rows; I'll report it.

do u want to apply it like lovable
