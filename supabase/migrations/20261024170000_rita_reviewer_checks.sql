-- A check of the reviewer itself: a fixed set of replies with known right answers is reviewed, and
-- the result says whether the reviewer finds what it should and leaves good replies alone.
-- Admins only.

create table if not exists public.rita_reviewer_checks (
  id uuid primary key default gen_random_uuid(),
  -- The reviewer's rules version (src/lib/rita-tutor-contract.ts RUBRIC_VERSION) that was checked.
  rubric_version smallint not null,
  model text,
  trigger text not null default 'manual' check (trigger in ('manual', 'auto')),
  status text not null default 'running'
    check (status in ('running', 'done', 'partial', 'failed')),
  total integer not null default 0,
  passed integer not null default 0,
  failed integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists rita_reviewer_checks_started_idx
  on public.rita_reviewer_checks(started_at desc);

alter table public.rita_reviewer_checks enable row level security;

drop policy if exists "admins manage rita reviewer checks" on public.rita_reviewer_checks;
create policy "admins manage rita reviewer checks"
  on public.rita_reviewer_checks
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.rita_reviewer_checks to authenticated;
