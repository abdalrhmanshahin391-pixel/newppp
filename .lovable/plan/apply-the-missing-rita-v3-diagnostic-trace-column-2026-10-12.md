# Apply the missing Rita v3 diagnostic trace column

## What is actually wrong (verified against the live database)

The migration file for this change already sits in the repo at
`supabase/migrations/20261009090000_rita_v3_diagnostic_trace.sql`, but it was
never applied to this database. I checked the live schema directly:

- `rita_v3_sessions` has 13 columns: `id, user_id, status, personality,
  language_preference, dialect_preference, provider_session_id, model_proof,
  error_code, started_at, connected_at, ended_at, updated_at`.
  **`diagnostic_trace_id` is not there.**
- Its indexes are only the primary key, `rita_v3_provider_session_idx` and
  `rita_v3_sessions_user_started_idx`. **The diagnostic trace index is not there.**
- The table has **0 rows** and has never held a session.

The app already writes this column. `persistRitaV3Session`
(`src/lib/rita-v3.server.ts:491`) inserts `diagnostic_trace_id` on every new
Rita v3 session, and the insert is strict (`.single()`), so a missing column
makes the whole insert fail. That failure is caught by the start route and
turned into a `session_storage_failed` response.

```text
browser -> /api/rita-v3/session/start -> insert session row
                                              |
                                              +-- writes diagnostic_trace_id
                                                    which the database does
                                                    not have  ->  insert fails
                                                    ->  no session is ever stored
```

So this is not a cosmetic tidy-up: Rita v3 cannot store a session on the
current database at all.

## What I will do

Apply exactly the SQL you gave, and nothing else, as one migration through the
database migration tool:

1. Add `diagnostic_trace_id` as a nullable `uuid` column on `rita_v3_sessions`.
2. Create the partial unique index `rita_v3_sessions_diagnostic_trace_idx` on
   that column, restricted to non-null values.

No other table, column, policy or piece of code is touched.

## Why this is safe

- **Nothing is destroyed.** The column is nullable, so no default is needed and
  no existing row is rewritten. There is no drop, rename or type change, so the
  deployed app keeps working against the old shape while and after the change.
- **Existing rows cannot break the unique index.** The index only covers
  non-null values, and every existing row gets null. The table is empty anyway.
- **Real duplicates are not a risk.** Trace IDs are always freshly generated
  random UUIDs: the browser makes one per session
  (`RitaRealtimeV3.tsx:430`), and when a request arrives without a valid one the
  server generates a replacement (`rita-v3-diagnostics-trace.ts:12`). The unique
  index only rejects a genuine repeated trace, which is the point.
- **The column type matches the data.** The validator only accepts UUID-shaped
  strings, so `uuid` is the correct type and bad values are rejected before
  they reach the database.
- **No permissions work is needed.** This adds a column to an existing table,
  so the current grants and row-level security policies already cover it.
- **It is re-runnable.** Both statements use `if not exists`, so applying it
  twice is harmless.
- **Both sites share one database**, so this fixes the preview and the live
  site at once, without needing a publish first.

## What you will see afterwards

- Starting a Rita v3 voice session stores the session instead of failing.
- The same trace ID then ties together browser, server and worker timing
  evidence for one session, which is what the diagnostic runbook uses.
- The plan is to confirm afterwards that the column and the index exist, and
  that a session row is actually written when a call starts.

## Technical details

- Migration tool: `lov_database--migration`, SQL exactly as supplied:

```sql
alter table public.rita_v3_sessions
  add column if not exists diagnostic_trace_id uuid;

create unique index if not exists rita_v3_sessions_diagnostic_trace_idx
  on public.rita_v3_sessions(diagnostic_trace_id)
  where diagnostic_trace_id is not null;
```

- The tool writes the SQL into a new timestamped migration file and applies it,
  so the change is journal-tracked and travels to GitHub with the repo.
- Because the file already in the repo carries the same idempotent SQL, the
  repo will hold two files with equivalent content. That is harmless — both
  are `if not exists` — and I will leave the older file in place rather than
  rewriting history that GitHub syncs.
- No `GRANT`, `RLS` or policy statements belong in this migration: no new table
  is created.
- Read-back verification: `information_schema.columns` for the column and
  `pg_indexes` for the index, both queried before this plan and both currently
  showing the object missing.

do u want to apply it like lovable
