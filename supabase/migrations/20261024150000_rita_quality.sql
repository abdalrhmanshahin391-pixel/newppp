-- Rita quality: recurring problems found by the review, grouped into cards ("issues") the owner
-- can open, fix and watch, plus the owner's thumbs on the reviewer's own judgements. Admins only.

create table if not exists public.rita_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  -- Where a developer should change something (the reviewer's suggestion).
  fix_where text not null default 'prompt'
    check (fix_where in (
      'prompt', 'dialect_list', 'memory', 'turn_taking', 'stt', 'tts', 'content', 'code', 'none'
    )),
  category text,
  cause text,
  -- Only the states a person chooses are stored. "Watching", "resolved" and "regressed" are worked
  -- out from the reviews that came after the fix (src/lib/rita-quality.ts).
  status text not null default 'open'
    check (status in ('open', 'fixing', 'not_an_issue', 'merged')),
  merged_into uuid references public.rita_issues(id) on delete set null,
  -- The daily duplicate check proposes a merge; a person confirms it.
  suggested_merge_into uuid references public.rita_issues(id) on delete set null,
  pr_url text,
  -- When the owner marked it fixed, and the newest worker build the reviews had seen at that time.
  fix_marked_at timestamptz,
  fix_baseline_build text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rita_issues_status_idx on public.rita_issues(status, updated_at desc);

alter table public.rita_turn_reviews
  add column if not exists issue_id uuid references public.rita_issues(id) on delete set null;
create index if not exists rita_turn_reviews_issue_idx
  on public.rita_turn_reviews(issue_id) where issue_id is not null;
create index if not exists rita_turn_reviews_build_idx
  on public.rita_turn_reviews(build, reviewed_at desc) where status = 'done';

-- The owner's thumb on one judgement of the reviewer: agree or not.
create table if not exists public.rita_review_feedback (
  review_id uuid primary key references public.rita_turn_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agree boolean not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

alter table public.rita_review_settings
  -- Taken while the job decides which issue a problem belongs to, so two runs cannot create the
  -- same card twice.
  add column if not exists assign_lock_until timestamptz,
  add column if not exists last_merge_pass_at timestamptz;

alter table public.rita_issues enable row level security;
alter table public.rita_review_feedback enable row level security;

drop policy if exists "admins manage rita issues" on public.rita_issues;
create policy "admins manage rita issues"
  on public.rita_issues
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins manage rita review feedback" on public.rita_review_feedback;
create policy "admins manage rita review feedback"
  on public.rita_review_feedback
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') and auth.uid() = user_id)
  with check (public.has_role(auth.uid(), 'admin') and auth.uid() = user_id);

grant select, insert, update, delete on public.rita_issues to authenticated;
grant select, insert, update, delete on public.rita_review_feedback to authenticated;
