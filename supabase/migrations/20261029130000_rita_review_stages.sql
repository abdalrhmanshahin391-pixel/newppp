-- The AI review of Rita's replies, without any timer (see AGENTS.md: background work is
-- event-driven). When a call ends, the database wakes the rita-review Edge Function for that call's
-- conversation; the function reviews it in short runs and wakes itself again until it is done.
-- This replaces 20261029120000_rita_review_edge.sql (a schedule every 2 minutes), never applied.

-- 1) A reply is reviewed in three saved stages; "staged" = part-way, the next run carries on.
alter table public.rita_turn_reviews add column if not exists partial jsonb;

do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.rita_turn_reviews'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.rita_turn_reviews drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.rita_turn_reviews
  add constraint rita_turn_reviews_status_check
  check (status in ('pending', 'staged', 'done', 'failed', 'no_text'));

-- 2) A safety ceiling against a runaway loop (not a budget): replies reviewed in 24 hours.
alter table public.rita_review_settings
  add column if not exists daily_turn_limit integer not null default 1500;

-- 3) One run per conversation at a time.
create table if not exists public.rita_review_runs (
  conversation_id uuid primary key references public.rita_free_conversations (id) on delete cascade,
  lock_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.rita_review_runs enable row level security;
-- No policies: only the Edge Function (service key) and the functions below touch it.

create or replace function public.rita_review_claim(p_conversation uuid, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rita_review_runs as runs (conversation_id, lock_until, updated_at)
  values (p_conversation, now() + make_interval(secs => p_seconds), now())
  on conflict (conversation_id) do update
    set lock_until = excluded.lock_until, updated_at = now()
    where runs.lock_until is null or runs.lock_until < now();
  return found;
end;
$$;

create or replace function public.rita_review_release(p_conversation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.rita_review_runs set lock_until = null, updated_at = now()
  where conversation_id = p_conversation;
$$;

-- 4) Wake the review for one conversation (the call's end, or the review continuing itself).
create or replace function public.rita_review_wake(p_conversation uuid, p_depth integer default 0)
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare k text;
begin
  select trim(value) into k from public.site_secrets where key = 'worker_cron_key';
  if k is null or p_conversation is null then return; end if;
  perform net.http_post(
    url := 'https://aeawoexywnyankbeqkmz.supabase.co/functions/v1/rita-review',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-key', k),
    body := jsonb_build_object('conversationId', p_conversation, 'depth', p_depth),
    timeout_milliseconds := 150000
  );
end;
$$;

-- The call's end wakes the review of its conversation only (the failing site replay call is gone).
create or replace function public.wake_rita_post_call()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  if new.conversation_id is not null then
    perform public.rita_review_wake(new.conversation_id, 0);
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists rita_v3_sessions_wake_post_call on public.rita_v3_sessions;
create trigger rita_v3_sessions_wake_post_call
after update of ended_at on public.rita_v3_sessions
for each row
when (old.ended_at is null and new.ended_at is not null)
execute function public.wake_rita_post_call();

revoke execute on function public.rita_review_claim(uuid, integer) from public, anon, authenticated;
revoke execute on function public.rita_review_release(uuid) from public, anon, authenticated;
revoke execute on function public.rita_review_wake(uuid, integer) from public, anon, authenticated;
revoke execute on function public.wake_rita_post_call() from public, anon, authenticated;
grant execute on function public.rita_review_claim(uuid, integer) to service_role;
grant execute on function public.rita_review_release(uuid) to service_role;
grant execute on function public.rita_review_wake(uuid, integer) to service_role;

-- No schedule: if the old 2-minute job exists anywhere, it goes.
select cron.unschedule('rita-turn-review')
where exists (select 1 from cron.job where jobname = 'rita-turn-review');
