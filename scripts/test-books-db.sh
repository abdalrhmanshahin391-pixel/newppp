#!/usr/bin/env bash
# Tests the library database rules (phase 1 and on) against a plain Postgres 16 with pgTAP: a
# small stub of the Supabase parts they rely on, the real library migrations, then the checks.
# Needs psql, pgTAP installed on the server, and the usual PGHOST / PGPORT / PGUSER /
# PGPASSWORD; uses (and recreates) the database "books_test".
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${BOOKS_TEST_DB:-books_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
run() { psql -v ON_ERROR_STOP=1 -q -X -d "${DB}" "$@"; }

run -f supabase/tests/study/00_supabase_stub.sql
run -f supabase/tests/books/00_books_stub.sql
for migration in supabase/migrations/*books*.sql; do
  run -f "${migration}"
  # Every library migration must be safe to run twice.
  run -f "${migration}"
done
# Supabase gives these table rights to visitors and signed-in users; row level security decides.
run -c "grant usage on schema public, auth, storage to anon, authenticated;
        grant select, insert, update, delete on all tables in schema public to anon, authenticated;
        grant select on storage.objects to anon, authenticated;"
for test in supabase/tests/books/[1-9]*_test.sql; do
  echo "== ${test}"
  run -f "${test}"
done
