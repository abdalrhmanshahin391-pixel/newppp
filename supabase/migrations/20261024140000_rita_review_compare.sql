-- Review v2: next to the verdict, each turn now keeps the reference reply an excellent tutor would
-- have given, the scores of both replies, the fact and dialect checks, the timing from the voice
-- system and the concrete fix. Each conversation also gets one review of its own. Only admins read
-- any of it.

alter table public.rita_turn_reviews
  add column if not exists explanation text,
  add column if not exists reference_reply text,
  add column if not exists reference_why text,
  add column if not exists winner text
    check (winner is null or winner in ('rita', 'reference', 'tie')),
  add column if not exists scores jsonb,
  add column if not exists facts jsonb,
  add column if not exists dialect jsonb,
  add column if not exists timing jsonb,
  add column if not exists fix jsonb,
  -- Raised in src/lib/rita-tutor-contract.ts when the standard changes; older rows are reviewed again.
  add column if not exists rubric_version smallint not null default 1;

create index if not exists rita_turn_reviews_winner_idx
  on public.rita_turn_reviews(winner, created_at desc) where status = 'done';

create table if not exists public.rita_conversation_reviews (
  conversation_id uuid primary key references public.rita_free_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'done' check (status in ('done', 'failed')),
  rubric_version smallint not null,
  -- How many turn reviews this one was written from; a new turn review makes it stale.
  turns_reviewed integer not null,
  model text,
  stats jsonb,
  data jsonb,
  error text,
  reviewed_at timestamptz not null default now()
);

alter table public.rita_conversation_reviews enable row level security;

drop policy if exists "admins read rita conversation reviews" on public.rita_conversation_reviews;
create policy "admins read rita conversation reviews"
  on public.rita_conversation_reviews
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins write rita conversation reviews" on public.rita_conversation_reviews;
create policy "admins write rita conversation reviews"
  on public.rita_conversation_reviews
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.rita_conversation_reviews to authenticated;

-- A review of one turn now takes a few minutes (a strong model, several questions), so the job runs
-- every 2 minutes and the request may stay open for as long as it needs.
select cron.unschedule('rita-turn-review')
where exists (select 1 from cron.job where jobname = 'rita-turn-review');

select cron.schedule(
  'rita-turn-review',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://project--84f9560d-cda3-444b-b692-31491571e090.lovable.app/api/public/rita-review',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-key', (select trim(value) from public.site_secrets where key = 'worker_cron_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
  $$
);
