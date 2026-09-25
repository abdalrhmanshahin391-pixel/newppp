create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now()
);
grant select on public.courses to anon, authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "courses readable" on public.courses for select using (true);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
grant select on public.subjects to anon, authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "subjects readable" on public.subjects for select using (true);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  question_id uuid,
  snippet_html text not null default '',
  snippet_text text not null default '',
  user_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create policy "own notes select" on public.notes for select to authenticated using (auth.uid() = user_id);
create policy "own notes insert" on public.notes for insert to authenticated with check (auth.uid() = user_id);
create policy "own notes update" on public.notes for update to authenticated using (auth.uid() = user_id);
create policy "own notes delete" on public.notes for delete to authenticated using (auth.uid() = user_id);
create index if not exists notes_user_idx on public.notes(user_id, created_at desc);