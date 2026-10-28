-- "Rita - interactive study": a second kind of lesson next to the current one. Additive only: every
-- lesson that exists today stays 'classic' and keeps working exactly as before.
--   experience       which experience the admin chose for the lesson ('classic' or 'study')
--   study_guide_id   the PDF guide (rita_lesson_guides) shown on the right of a study lesson
-- Learners only ever see a guide an admin linked to a published study lesson, and only its final
-- copy (learner_path, printed without the "draft for review" footer). Drafts stay admin only.

alter table public.rita_lessons
  add column if not exists experience text not null default 'classic',
  add column if not exists study_guide_id uuid
    references public.rita_lesson_guides (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rita_lessons_experience_check'
  ) then
    alter table public.rita_lessons
      add constraint rita_lessons_experience_check check (experience in ('classic', 'study'));
  end if;
end $$;

create index if not exists rita_lessons_study_guide on public.rita_lessons (study_guide_id)
  where study_guide_id is not null;

-- The final copy for learners, and whether learners may download it.
alter table public.rita_lesson_guides
  add column if not exists learner_path text,
  add column if not exists allow_download boolean not null default true;

-- One switch for the whole feature. Off: every study lesson opens as a classic lesson.
create table if not exists public.rita_feature_flags (
  key text primary key check (char_length(key) between 1 and 60),
  enabled boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.rita_feature_flags (key, enabled)
values ('rita_study', false)
on conflict (key) do nothing;

alter table public.rita_feature_flags enable row level security;

drop policy if exists "signed in users read feature flags" on public.rita_feature_flags;
create policy "signed in users read feature flags" on public.rita_feature_flags
  for select to authenticated
  using (true);

drop policy if exists "admins manage feature flags" on public.rita_feature_flags;
create policy "admins manage feature flags" on public.rita_feature_flags
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Learners read a guide only when it is ready, has its final copy, and is linked to a published
-- study lesson they can see (the lessons table keeps its own rules inside this check).
drop policy if exists "learners read linked guides" on public.rita_lesson_guides;
create policy "learners read linked guides" on public.rita_lesson_guides
  for select to authenticated
  using (
    status = 'ready'
    and learner_path is not null
    and exists (
      select 1 from public.rita_lessons lesson
      where lesson.study_guide_id = rita_lesson_guides.id
        and lesson.status = 'published'
        and lesson.experience = 'study'
    )
  );

-- The same for the file: only the final copy of a linked guide, never a draft.
drop policy if exists "learners read linked guide files" on storage.objects;
create policy "learners read linked guide files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rita-guides'
    and exists (
      select 1
      from public.rita_lesson_guides guide
      join public.rita_lessons lesson on lesson.study_guide_id = guide.id
      where guide.learner_path = storage.objects.name
        and guide.status = 'ready'
        and lesson.status = 'published'
        and lesson.experience = 'study'
    )
  );
