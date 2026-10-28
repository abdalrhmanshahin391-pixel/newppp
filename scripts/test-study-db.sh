#!/usr/bin/env bash
# Tests the interactive-study database rules against a plain Postgres 16: a small stub of the
# Supabase parts they rely on, then the real migration files, then the checks. Needs psql and the
# usual PGHOST / PGPORT / PGUSER / PGPASSWORD; uses (and recreates) the database "study_test".
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${STUDY_TEST_DB:-study_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
run() { psql -v ON_ERROR_STOP=1 -q -d "${DB}" "$@"; }

run -f supabase/tests/study/00_supabase_stub.sql
run -f supabase/migrations/20261027120000_rita_lesson_guides.sql
# A book and a lesson made before the study migration (it must stay classic).
run -c "insert into public.rita_curricula (id, status) values ('00000000-0000-4000-8000-0000000000c1', 'published');
        insert into public.rita_lessons (id, curriculum_id, status) values
          ('10000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'published');"
run -f supabase/migrations/20261028120000_rita_study_lessons.sql
run -f supabase/migrations/20261028140000_rita_study_actions.sql
run -f supabase/migrations/20261029100000_rita_study_switch_on.sql
# Supabase gives signed-in users these table rights; row level security decides the rest.
run -c "grant usage on schema public, auth, storage to authenticated;
        grant select, insert, update, delete on all tables in schema public to authenticated;
        grant select on storage.objects to authenticated;"
run -f supabase/tests/study/20_study_rules_test.sql
