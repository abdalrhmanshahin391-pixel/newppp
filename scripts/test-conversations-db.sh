#!/usr/bin/env bash
# Creates a new, isolated local CI database. Never targets Lovable or an existing database.
set -euo pipefail
cd "$(dirname "$0")/.."
case "${PGHOST:-localhost}" in localhost|127.0.0.1|::1) ;; *) echo 'Local test Postgres required' >&2; exit 1;; esac
psql -v ON_ERROR_STOP=1 -q -d postgres -c 'create database conversation_management_test'
run() { psql -v ON_ERROR_STOP=1 -q -d conversation_management_test "$@"; }
run -f supabase/tests/study/00_supabase_stub.sql
run -c "do \$\$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end \$\$;
create table public.rita_v3_sessions(id uuid primary key, user_id uuid references auth.users(id), started_at timestamptz default now());
alter table public.rita_v3_sessions enable row level security;
grant usage on schema public, auth to authenticated;
grant select,insert,update,delete on public.rita_v3_sessions to authenticated;"
run -f supabase/migrations/20261019120000_rita_free_conversations.sql
run -f supabase/migrations/20261115130000_conversation_management.sql
run -f supabase/migrations/20261115130000_conversation_management.sql
run -f supabase/tests/conversations/management.sql
