do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.relname);
    execute format('grant all on public.%I to service_role', t.relname);
    if exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.relname
        and p.cmd in ('SELECT','ALL')
        and (p.roles @> array['public']::name[] or p.roles @> array['anon']::name[])
    ) then
      execute format('grant select on public.%I to anon', t.relname);
    end if;
  end loop;
end $$;
grant usage on all sequences in schema public to authenticated;
grant all on all sequences in schema public to service_role;