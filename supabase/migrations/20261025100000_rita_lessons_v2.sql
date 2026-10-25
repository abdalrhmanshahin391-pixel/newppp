-- Lessons v2: exercise content, lesson runs and per-answer results.
-- Additive only: old spoken lessons keep working exactly as before.
--
-- Answers live in these tables, so learners never read them directly: every table below has
-- row level security on and only an admin read policy. The website reads and writes them through
-- server functions with the server key, after checking who the learner is.

-- The exercise content of a lesson (version 2). One row per lesson; `version` goes up on publish.
create table if not exists public.rita_lesson_contents (
  lesson_id uuid primary key references public.rita_lessons (id) on delete cascade,
  content_schema integer not null default 2 check (content_schema >= 2),
  content jsonb not null,
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- Problems found by the code checks and the offline review, shown to the admin.
  warnings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- One attempt at a lesson. The content is copied in, so publishing a new version never changes
-- a lesson someone is in the middle of.
create table if not exists public.rita_lesson_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid references public.rita_lessons (id) on delete cascade,
  -- Admin preview of a built-in sample lesson ("to_be", "property"); null for book lessons.
  sample text,
  content_version integer not null default 1,
  content jsonb not null,
  state jsonb not null,
  revision integer not null default 1,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  preview boolean not null default false,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (lesson_id is not null or sample is not null)
);
create index if not exists rita_lesson_runs_user on public.rita_lesson_runs (user_id, lesson_id);
-- At most one open real attempt per learner and lesson.
create unique index if not exists rita_lesson_runs_one_active
  on public.rita_lesson_runs (user_id, lesson_id)
  where status = 'active' and not preview and lesson_id is not null;

-- Every answer, linked to the run and the item, so "Rita marked me wrong" can be checked.
create table if not exists public.rita_lesson_item_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.rita_lesson_runs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  skill_tag text not null default '',
  phase text not null,
  revision integer not null,
  channel text not null check (channel in ('tap', 'typed', 'voice')),
  status text not null check (status in ('correct', 'wrong', 'unclear', 'revealed')),
  given text not null default '',
  independent boolean not null default false,
  hint_used boolean not null default false,
  stt_suspect boolean not null default false,
  created_at timestamptz not null default now(),
  -- One answer per step: a spoken and a tapped answer for the same step cannot both be saved.
  unique (run_id, revision)
);
create index if not exists rita_lesson_item_results_run on public.rita_lesson_item_results (run_id);

drop trigger if exists rita_lesson_contents_updated_at on public.rita_lesson_contents;
create trigger rita_lesson_contents_updated_at before update on public.rita_lesson_contents
  for each row execute function public.set_updated_at();
drop trigger if exists rita_lesson_runs_updated_at on public.rita_lesson_runs;
create trigger rita_lesson_runs_updated_at before update on public.rita_lesson_runs
  for each row execute function public.set_updated_at();

alter table public.rita_lesson_contents enable row level security;
alter table public.rita_lesson_runs enable row level security;
alter table public.rita_lesson_item_results enable row level security;

drop policy if exists "admins read lesson contents" on public.rita_lesson_contents;
create policy "admins read lesson contents" on public.rita_lesson_contents
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "admins read lesson runs" on public.rita_lesson_runs;
create policy "admins read lesson runs" on public.rita_lesson_runs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "admins read lesson item results" on public.rita_lesson_item_results;
create policy "admins read lesson item results" on public.rita_lesson_item_results
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

grant select on public.rita_lesson_contents, public.rita_lesson_runs, public.rita_lesson_item_results
  to authenticated;
grant all on public.rita_lesson_contents, public.rita_lesson_runs, public.rita_lesson_item_results
  to service_role;
