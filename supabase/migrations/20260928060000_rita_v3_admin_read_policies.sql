-- Admin dashboard metrics use the signed-in user's JWT and remain protected by
-- RLS. Students still see only their own Rita v3 rows.
drop policy if exists "users read own rita v3 sessions" on public.rita_v3_sessions;
create policy "users or admins read rita v3 sessions"
  on public.rita_v3_sessions
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.has_role(auth.uid(), 'admin'::public.app_role)
  );

drop policy if exists "users read own rita v3 events" on public.rita_v3_events;
create policy "users or admins read rita v3 events"
  on public.rita_v3_events
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.has_role(auth.uid(), 'admin'::public.app_role)
  );
