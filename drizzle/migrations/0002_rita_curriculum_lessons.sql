create table if not exists public.rita_curricula (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('grammar', 'vocabulary')),
  title text not null check (char_length(title) between 1 and 160),
  title_ar text,
  target_language text not null default 'en',
  level text not null default 'A1',
  pdf_path text,
  page_count integer not null default 0 check (page_count >= 0),
  page_offset integer not null default 0,
  read_cursor integer not null default 0 check (read_cursor >= 0),
  taught_cursor integer not null default 0 check (taught_cursor >= 0),
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rita_curricula_read_within_book check (read_cursor <= page_count),
  constraint rita_curricula_taught_within_read check (taught_cursor <= read_cursor)
);
create table if not exists public.rita_curriculum_pages (
  curriculum_id uuid not null references public.rita_curricula (id) on delete cascade,
  page_no integer not null check (page_no >= 1),
  text text not null default '',
  has_text_layer boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (curriculum_id, page_no)
);
create table if not exists public.rita_curriculum_windows (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.rita_curricula (id) on delete cascade,
  from_page integer not null check (from_page >= 1),
  to_page integer not null,
  summary jsonb not null,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  model text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint rita_curriculum_windows_range check (to_page >= from_page and to_page - from_page < 10),
  unique (curriculum_id, from_page, to_page)
);
create table if not exists public.rita_lessons (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.rita_curricula (id) on delete cascade,
  lesson_no integer not null check (lesson_no >= 1),
  path_order integer,
  title text not null check (char_length(title) between 1 and 160),
  title_ar text not null default '',
  topic text not null default '',
  source_from_page integer not null check (source_from_page >= 1),
  source_to_page integer not null,
  objectives jsonb not null default '[]'::jsonb,
  plan jsonb not null default '{}'::jsonb,
  vocabulary jsonb not null default '[]'::jsonb,
  image_url text,
  image_prompt text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version >= 1),
  source text not null default 'ai' check (source in ('ai', 'manual')),
  model text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint rita_lessons_source_range check (source_to_page >= source_from_page),
  constraint rita_lessons_objectives_array check (jsonb_typeof(objectives) = 'array')
);
create unique index if not exists rita_lessons_live_number on public.rita_lessons (curriculum_id, lesson_no) where status <> 'archived';
create index if not exists rita_lessons_path on public.rita_lessons (status, path_order);
create table if not exists public.rita_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lesson_id uuid not null references public.rita_lessons (id) on delete cascade,
  lesson_version integer not null default 1,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  objectives jsonb not null default '{}'::jsonb,
  score integer not null default 0 check (score between 0 and 100),
  best_score integer not null default 0 check (best_score between 0 and 100),
  stars smallint not null default 0 check (stars between 0 and 3),
  attempts integer not null default 1 check (attempts >= 1),
  evaluations integer not null default 0 check (evaluations >= 0),
  rita_session_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index if not exists rita_lesson_progress_user on public.rita_lesson_progress (user_id);
drop trigger if exists rita_curricula_updated_at on public.rita_curricula;
create trigger rita_curricula_updated_at before update on public.rita_curricula for each row execute function public.set_updated_at();
drop trigger if exists rita_lessons_updated_at on public.rita_lessons;
create trigger rita_lessons_updated_at before update on public.rita_lessons for each row execute function public.set_updated_at();
drop trigger if exists rita_lesson_progress_updated_at on public.rita_lesson_progress;
create trigger rita_lesson_progress_updated_at before update on public.rita_lesson_progress for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.rita_curricula, public.rita_curriculum_pages, public.rita_curriculum_windows, public.rita_lessons to authenticated;
grant select on public.rita_lesson_progress to authenticated;
grant all on public.rita_curricula, public.rita_curriculum_pages, public.rita_curriculum_windows, public.rita_lessons, public.rita_lesson_progress to service_role;
alter table public.rita_curricula enable row level security;
alter table public.rita_curriculum_pages enable row level security;
alter table public.rita_curriculum_windows enable row level security;
alter table public.rita_lessons enable row level security;
alter table public.rita_lesson_progress enable row level security;
create policy "published curricula are readable" on public.rita_curricula for select to authenticated using (status = 'published' or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "admins manage curricula" on public.rita_curricula for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "admins manage curriculum pages" on public.rita_curriculum_pages for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "admins manage curriculum windows" on public.rita_curriculum_windows for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "published lessons are readable" on public.rita_lessons for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role) or (status = 'published' and exists (select 1 from public.rita_curricula c where c.id = curriculum_id and c.status = 'published')));
create policy "admins manage lessons" on public.rita_lessons for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "users read own lesson progress" on public.rita_lesson_progress for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "admins manage curriculum files" on storage.objects;
create policy "admins manage curriculum files" on storage.objects for all to authenticated using (bucket_id = 'rita-curricula' and public.has_role(auth.uid(), 'admin'::public.app_role)) with check (bucket_id = 'rita-curricula' and public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "lesson images are public" on storage.objects;
create policy "lesson images are public" on storage.objects for select to anon, authenticated using (bucket_id = 'rita-lesson-images');
drop policy if exists "admins manage lesson images" on storage.objects;
create policy "admins manage lesson images" on storage.objects for all to authenticated using (bucket_id = 'rita-lesson-images' and public.has_role(auth.uid(), 'admin'::public.app_role)) with check (bucket_id = 'rita-lesson-images' and public.has_role(auth.uid(), 'admin'::public.app_role));