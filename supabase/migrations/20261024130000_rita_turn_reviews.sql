-- A second model's review of one Rita turn (was the learner cut off, understood, answered well?),
-- written by the review job after the call or by the admin's "Repair file" button. Only admins read
-- it; learners never see how their replies were judged. One switch (rita_review_settings) turns the
-- review on or off for every conversation.

create table if not exists public.rita_review_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.rita_review_settings (id, enabled) values (true, true)
on conflict (id) do nothing;

alter table public.rita_review_settings enable row level security;

drop policy if exists "admins read rita review settings" on public.rita_review_settings;
create policy "admins read rita review settings"
  on public.rita_review_settings
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins change rita review settings" on public.rita_review_settings;
create policy "admins change rita review settings"
  on public.rita_review_settings
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, update on public.rita_review_settings to authenticated;

create table if not exists public.rita_turn_reviews (
  id uuid primary key default gen_random_uuid(),
  -- The turn ref (<session>-t-<n>), or reply-<message id> when only a report exists.
  turn_key text not null unique,
  conversation_id uuid not null references public.rita_free_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.rita_v3_sessions(id) on delete set null,
  turn_ref text,
  reply_message_id text,
  trigger text not null check (trigger in ('report', 'flag', 'sample', 'manual')),
  reasons text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'done', 'failed', 'no_text')),
  attempts smallint not null default 0,
  model text,
  verdict text check (verdict is null or verdict in ('ok', 'problem')),
  severity smallint check (severity is null or severity between 0 and 3),
  category text,
  cause text,
  evidence text,
  suggestion text,
  confidence real,
  build text,
  error text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists rita_turn_reviews_conversation_idx
  on public.rita_turn_reviews(conversation_id);
create index if not exists rita_turn_reviews_done_idx
  on public.rita_turn_reviews(reviewed_at desc) where status = 'done';
create index if not exists rita_turn_reviews_problems_idx
  on public.rita_turn_reviews(cause, category, created_at desc) where verdict = 'problem';

alter table public.rita_turn_reviews enable row level security;

drop policy if exists "admins read rita turn reviews" on public.rita_turn_reviews;
create policy "admins read rita turn reviews"
  on public.rita_turn_reviews
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins write rita turn reviews" on public.rita_turn_reviews;
create policy "admins write rita turn reviews"
  on public.rita_turn_reviews
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.rita_turn_reviews to authenticated;

-- Every 5 minutes: review the turns of finished conversations that have no review yet. The job
-- stops at once when the switch is off or there is nothing new.
select cron.unschedule('rita-turn-review')
where exists (select 1 from cron.job where jobname = 'rita-turn-review');

select cron.schedule(
  'rita-turn-review',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://project--84f9560d-cda3-444b-b692-31491571e090.lovable.app/api/public/rita-review',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-key', (select trim(value) from public.site_secrets where key = 'worker_cron_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
