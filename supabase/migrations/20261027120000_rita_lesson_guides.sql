-- PDF grammar guides: one row per guide, the PDF itself in a private bucket. Admin only.
-- The website reads and writes these with the admin's own session (row level security below), so
-- no service key is needed. Learners have no access to the table or the bucket.

create table if not exists public.rita_lesson_guides (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.rita_curricula (id) on delete cascade,
  lesson_id uuid references public.rita_lessons (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  from_page integer not null check (from_page >= 1),
  to_page integer not null,
  -- writing: the AI is writing. written: content saved, not drawn yet. rendering: being drawn.
  -- ready: the PDF is stored. failed: see error_code and error_message.
  status text not null default 'writing' check (status in ('writing', 'written', 'rendering', 'ready', 'failed')),
  version integer not null default 1 check (version >= 1),
  content jsonb,
  -- Problems the second AI check found (block, severity, problem). Shown to the admin, never hidden.
  warnings jsonb not null default '[]'::jsonb,
  storage_path text,
  error_code text,
  error_message text,
  model text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rita_lesson_guides_pages check (to_page >= from_page and to_page - from_page < 10)
);

create index if not exists rita_lesson_guides_curriculum
  on public.rita_lesson_guides (curriculum_id, created_at desc);

-- One guide being made at a time for the same pages and title: a double tap cannot start two.
create unique index if not exists rita_lesson_guides_one_active
  on public.rita_lesson_guides (curriculum_id, from_page, to_page, title)
  where status in ('writing', 'rendering');

alter table public.rita_lesson_guides enable row level security;

drop policy if exists "admins manage lesson guides" on public.rita_lesson_guides;
create policy "admins manage lesson guides" on public.rita_lesson_guides
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

insert into storage.buckets (id, name, public)
values ('rita-guides', 'rita-guides', false)
on conflict (id) do nothing;

drop policy if exists "admins manage guide files" on storage.objects;
create policy "admins manage guide files" on storage.objects
  for all to authenticated
  using (bucket_id = 'rita-guides' and public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (bucket_id = 'rita-guides' and public.has_role(auth.uid(), 'admin'::public.app_role));
