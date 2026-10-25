-- Replay tests: "would Rita answer these past turns better now?". A run asks the current worker for
-- fresh replies to the turns behind one issue and judges them against the reference replies. Also
-- lets admins read the conversation text and turn records behind the reviews they already see
-- (issue examples and replays of other learners' turns). Admins only.

create table if not exists public.rita_replay_runs (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.rita_issues(id) on delete cascade,
  trigger text not null check (trigger in ('manual', 'auto')),
  -- The worker build that answered (RITA_GIT_SHA).
  worker_build text,
  -- Did the fixed part of the system prompt change since the replies were first given?
  prompt_changed boolean,
  status text not null default 'running'
    check (status in ('running', 'done', 'partial', 'failed')),
  total integer not null default 0,
  passed integer not null default 0,
  -- Passed once and failed once: the answer is not stable, so it does not count as fixed.
  flaky integer not null default 0,
  failed integer not null default 0,
  cases jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists rita_replay_runs_issue_idx
  on public.rita_replay_runs(issue_id, started_at desc);

alter table public.rita_replay_runs enable row level security;

drop policy if exists "admins manage rita replay runs" on public.rita_replay_runs;
create policy "admins manage rita replay runs"
  on public.rita_replay_runs
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.rita_replay_runs to authenticated;

-- The worker build the automatic replay last looked at, so a new deploy is noticed once.
alter table public.rita_review_settings
  add column if not exists last_replay_build text;

-- Admins read the text and records the reviews are about.
drop policy if exists "admins read all rita free conversations" on public.rita_free_conversations;
create policy "admins read all rita free conversations"
  on public.rita_free_conversations
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins read all rita free messages" on public.rita_free_conversation_messages;
create policy "admins read all rita free messages"
  on public.rita_free_conversation_messages
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins read all rita v3 sessions" on public.rita_v3_sessions;
create policy "admins read all rita v3 sessions"
  on public.rita_v3_sessions
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins read all rita v3 events" on public.rita_v3_events;
create policy "admins read all rita v3 events"
  on public.rita_v3_events
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Every 10 minutes: when the worker has a new build, replay the issues that are being fixed.
select cron.unschedule('rita-replay-auto')
where exists (select 1 from cron.job where jobname = 'rita-replay-auto');

select cron.schedule(
  'rita-replay-auto',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://project--84f9560d-cda3-444b-b692-31491571e090.lovable.app/api/public/rita-replay',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-key', (select trim(value) from public.site_secrets where key = 'worker_cron_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
  $$
);
