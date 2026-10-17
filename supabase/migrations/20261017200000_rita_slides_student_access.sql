-- Lets an admin share a lesson's slides with learners.
--
-- Slides start as AI drafts, so nothing is shown to learners until an admin
-- turns `shared` on for that lesson. Regenerating a deck turns it off again
-- (the new text has not been reviewed). Learners can only read shared decks
-- of published lessons of published books; they can never write.

alter table public.rita_lesson_slides
  add column if not exists shared boolean not null default false;

drop policy if exists "learners read shared lesson slides" on public.rita_lesson_slides;
create policy "learners read shared lesson slides" on public.rita_lesson_slides
  for select to authenticated
  using (
    shared
    and exists (
      select 1
      from public.rita_lessons l
      join public.rita_curricula c on c.id = l.curriculum_id
      where l.id = lesson_id and l.status = 'published' and c.status = 'published'
    )
  );
