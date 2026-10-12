-- Rita v3 runs through Modal and no longer requires a Supabase service-role key
-- for a signed-in learner to create/update only their own telemetry.
grant insert, update on public.rita_v3_sessions to authenticated;
grant insert on public.rita_v3_events to authenticated;
grant usage, select on sequence public.rita_v3_events_id_seq to authenticated;

drop policy if exists "users create own rita v3 sessions" on public.rita_v3_sessions;
create policy "users create own rita v3 sessions"
  on public.rita_v3_sessions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own rita v3 sessions" on public.rita_v3_sessions;
create policy "users update own rita v3 sessions"
  on public.rita_v3_sessions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users create own rita v3 events" on public.rita_v3_events;
create policy "users create own rita v3 events"
  on public.rita_v3_events
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.rita_v3_sessions session
      where session.id = session_id
        and session.user_id = auth.uid()
    )
  );