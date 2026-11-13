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
STARTER=supabase/migrations/20261117120000_books_starter_library.sql
USER_BOOKS=supabase/migrations/20261118130000_books_user_library.sql
for migration in supabase/migrations/*books*.sql; do
  # The starter shelf is data, not rules: it goes in after the rule tests, which count books.
  [ "${migration}" = "${STARTER}" ] && continue
  # This migration sets explicit API privileges; apply it after the legacy stub grants.
  [ "${migration}" = "${USER_BOOKS}" ] && continue
  run -f "${migration}"
  # Every library migration must be safe to run twice.
  run -f "${migration}"
done
# Supabase gives these table rights to visitors and signed-in users; row level security decides.
run -c "grant usage on schema public, auth, storage to anon, authenticated;
        grant select, insert, update, delete on all tables in schema public to anon, authenticated;
        grant select on storage.objects to anon, authenticated;
        grant insert, update, delete on storage.objects to authenticated;"
for test in supabase/tests/books/[1-7]*_test.sql; do
  echo "== ${test}"
  run -f "${test}"
done
# The starter shelf (20 books), run twice like the others, then its own checks.
run -f "${STARTER}"
run -f "${STARTER}"
echo "== supabase/tests/books/80_books_starter_library_test.sql"
run -f supabase/tests/books/80_books_starter_library_test.sql

echo "== supabase/tests/books/90_books_user_library_test.sql"
run -f "${USER_BOOKS}"
run -f "${USER_BOOKS}"
run -f supabase/tests/books/90_books_user_library_test.sql
bash scripts/test-user-books-concurrency.sh "${DB}"
echo "== read-only user-books deployment checks"
checks="$(run -At -f supabase/checks/user-books.sql)"
printf '%s\n' "$checks"
if [ "$(printf '%s\n' "$checks" | grep -c '|t$')" -ne 31 ]; then
  echo "Expected all 31 user-books deployment checks to be true" >&2
  exit 1
fi
