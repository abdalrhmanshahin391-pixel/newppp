-- Test database only. Model the production plan SELECT policy alongside the real library schema.
create table public.plans (slug text primary key, published boolean not null);
alter table public.plans enable row level security;
grant select on public.plans to anon, authenticated;
create policy "published plans are readable" on public.plans
  for select to anon, authenticated
  using (published or public.has_role(auth.uid(), 'admin'));
insert into public.plans values ('catalog-test-live', true), ('catalog-test-draft', false);

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

\ir ../../migrations/20261121120000_guest_catalog_access.sql
\ir ../../migrations/20261121120000_guest_catalog_access.sql

begin;
do $$
begin
  if test_value(null, 'select to_jsonb(count(*)) from public.plans') is distinct from '1'::jsonb then
    raise exception 'Visitor must see exactly the published plan';
  end if;
  if test_value(null, 'select to_jsonb(count(*)) from public.plans where not published') is distinct from '0'::jsonb then
    raise exception 'Visitor must not see draft plans';
  end if;

  perform test_value(null, 'select public.books_discover()');
  perform test_value(null, 'select public.books_browse(p_query => ''book'')');
  perform test_value(null, 'select public.books_popular()');

  if test_value(null, $query$select to_jsonb(public.books_read_at(now() + interval '1 day') = now())$query$)
      is distinct from 'true'::jsonb then
    raise exception 'Visitor must not be able to preview a future snapshot';
  end if;
  if has_function_privilege('anon', 'public.has_role(uuid, public.app_role)', 'execute') then
    raise exception 'Visitor must not have direct access to has_role';
  end if;
end;
$$;
rollback;
