-- The extra Supabase parts the library migrations use, on top of supabase/tests/study/00_supabase_stub.sql.
-- Test databases only; never applied to the real project.
alter table storage.buckets add column if not exists file_size_limit bigint;
alter table storage.buckets add column if not exists allowed_mime_types text[];

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create extension if not exists pgtap;

-- Runs one statement as a visitor (null) or a signed-in user, the way the API would, then
-- switches back. Errors propagate (so throws_ok sees them) and undo the role switch with them.
create or replace function public.test_as(p_user uuid, p_sql text)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('role', case when p_user is null then 'anon' else 'authenticated' end, true);
  execute p_sql;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

-- The same, returning the single value the statement selects.
create or replace function public.test_value(p_user uuid, p_sql text)
returns jsonb
language plpgsql
as $$
declare
  v jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('role', case when p_user is null then 'anon' else 'authenticated' end, true);
  execute p_sql into v;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return v;
end;
$$;
grant execute on function public.test_as(uuid, text), public.test_value(uuid, text) to anon, authenticated;
