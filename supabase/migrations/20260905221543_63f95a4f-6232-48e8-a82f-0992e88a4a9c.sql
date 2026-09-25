-- 1. Emails must never be reachable by anonymous callers
revoke all on function public.get_email_by_username(text) from anon, authenticated;

-- 2. Privileged / internal helpers should not be callable by anonymous visitors
revoke all on function public.admin_users_with_plans() from anon;
revoke all on function public.effective_plan(uuid) from anon;
revoke all on function public.deck_in_my_space(uuid, uuid) from anon;

-- 3. Migration bookkeeping table locked down
alter table public._mig_log enable row level security;
revoke all on table public._mig_log from anon, authenticated;
grant all on table public._mig_log to service_role;
drop policy if exists "mig log admins only" on public._mig_log;
create policy "mig log admins only" on public._mig_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 4. Plans: keep a single clear public read rule
drop policy if exists "Plans are public" on public.plans;
drop policy if exists "Plans are publicly readable" on public.plans;

-- 5. Public profiles: signed-in users can browse them; anonymous visitors only
--    see the authors of decks that are actually published publicly.
drop policy if exists "public profiles are readable" on public.public_profiles;
drop policy if exists "profiles readable by members" on public.public_profiles;
drop policy if exists "profiles of public deck authors" on public.public_profiles;
create policy "profiles readable by members" on public.public_profiles
  for select to authenticated using (true);
create policy "profiles of public deck authors" on public.public_profiles
  for select to anon using (
    exists (
      select 1 from public.shared_decks d
      where d.owner_id = public_profiles.id
        and d.published = true
        and d.audience = 'public'
    )
  );

-- 6. Private key for the scheduled background workers (admin-only table)
insert into public.site_secrets (key, value, updated_at)
values ('worker_cron_key', '9e08bf71d985ff9c65cf8b31a35fc82162b873c6', now())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 7. Sharing stays opt-in
alter table public.summaries alter column is_public set default false;