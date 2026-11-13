#!/usr/bin/env bash
# Isolated Postgres test only. Creates a NEW books_library_test database; never drops a database.
# Needs psql and PGHOST/PGPORT/PGUSER/PGPASSWORD. Does not connect to Lovable or use project secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
case "${PGHOST:-localhost}" in localhost|127.0.0.1|::1) ;; *) echo "Use local test Postgres only" >&2; exit 1;; esac
psql -v ON_ERROR_STOP=1 -q -d postgres -c 'create database books_library_test'
run() { psql -v ON_ERROR_STOP=1 -q -d books_library_test "$@"; }
run -f supabase/tests/study/00_supabase_stub.sql
run -f supabase/tests/books/00_library_setup.sql
run -f supabase/migrations/20261108120000_books_library.sql
run -f supabase/tests/books/10_reproduce_anonymous_read.sql
run -f supabase/migrations/20261108130000_books_public_read.sql
run -f supabase/migrations/20261108130000_books_public_read.sql
run -f supabase/tests/books/20_library_permissions.sql
