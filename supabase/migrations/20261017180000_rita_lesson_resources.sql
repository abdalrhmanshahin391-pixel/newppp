-- Resources for Rita's curriculum lessons: a summary PDF, a helper video, a link.
--
-- Admins attach them to one lesson; learners see them next to the lesson once it
-- is published. PDFs live in a private bucket and are only handed out through
-- short-lived signed links the server creates after checking the lesson. The
-- voice lesson itself does not read these rows.

create table if not exists public.rita_lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.rita_lessons (id) on delete cascade,
  kind text not null check (kind in ('pdf', 'link', 'video')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  note text not null default '' check (char_length(note) <= 300),
  url text check (url is null or (char_length(url) <= 2000 and url ~* '^https://')),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  file_size integer check (file_size is null or file_size between 1 and 15728640),
  position integer not null default 0 check (position >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A PDF is a stored file; a link or video is an https address. Never both.
  constraint rita_lesson_resources_shape check (
    (kind = 'pdf' and file_path is not null and url is null)
    or (kind in ('link', 'video') and url is not null and file_path is null)
  )
);
create index if not exists rita_lesson_resources_lesson
  on public.rita_lesson_resources (lesson_id, position);

alter table public.rita_lesson_resources enable row level security;

-- Learners read the resources of published lessons of published books; admins manage all.
drop policy if exists "published lesson resources are readable" on public.rita_lesson_resources;
create policy "published lesson resources are readable" on public.rita_lesson_resources
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or exists (
      select 1
      from public.rita_lessons l
      join public.rita_curricula c on c.id = l.curriculum_id
      where l.id = lesson_id and l.status = 'published' and c.status = 'published'
    )
  );
drop policy if exists "admins manage lesson resources" on public.rita_lesson_resources;
create policy "admins manage lesson resources" on public.rita_lesson_resources
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop trigger if exists rita_lesson_resources_updated_at on public.rita_lesson_resources;
create trigger rita_lesson_resources_updated_at before update on public.rita_lesson_resources
  for each row execute function public.set_updated_at();

-- Private bucket: only admins touch it directly; learners get signed links from the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rita-lesson-resources', 'rita-lesson-resources', false, 15728640, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "admins manage lesson resource files" on storage.objects;
create policy "admins manage lesson resource files" on storage.objects
  for all to authenticated
  using (bucket_id = 'rita-lesson-resources' and public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (bucket_id = 'rita-lesson-resources' and public.has_role(auth.uid(), 'admin'::public.app_role));
