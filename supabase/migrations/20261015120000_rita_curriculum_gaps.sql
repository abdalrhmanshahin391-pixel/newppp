-- Curriculum gaps, replay-safe progress, and an atomic path-order update.
--
-- Fixes from the lesson-flow audit:
-- 1. A page is readable only when its text is long enough or the admin confirmed
--    it is blank. Transcription attempts that returned nothing no longer hide
--    the gap: the page stays missing until it is re-read or confirmed blank.
-- 2. Replaying a finished lesson must not lock the learner's frontier lesson:
--    last_completed_at remembers "completed at least once" across restarts, so
--    the path keeps showing the lesson as done while a retry is in progress.
-- 3. Path order changes for drag-and-drop are applied in one atomic call.

alter table public.rita_curriculum_pages
  add column if not exists transcribed_at timestamptz,
  add column if not exists blank_confirmed boolean not null default false;

alter table public.rita_lesson_progress
  add column if not exists last_completed_at timestamptz;

-- Backfill: every row that has ever completed keeps that achievement.
update public.rita_lesson_progress
  set last_completed_at = completed_at
  where completed_at is not null and last_completed_at is null;

-- Cheap per-book readiness report so the admin overview no longer downloads
-- every page's full text. Readiness itself is judged in the application from
-- text_len and blank_confirmed; this function only reports the raw values.
-- btrim matches the application's trimmed-length readiness rule.
create or replace function public.rita_curriculum_page_report(p_curriculum_id uuid)
returns table (page_no integer, text_len integer, transcribed boolean, blank_confirmed boolean)
language sql stable
as $$
  select page_no, length(btrim(text)), transcribed_at is not null, blank_confirmed
  from public.rita_curriculum_pages
  where curriculum_id = p_curriculum_id
  order by page_no;
$$;

-- Confirms a page as blank (no extractable text, e.g. a cover image). Readiness
-- then no longer blocks on it. Admins call this through the server function.
create or replace function public.rita_confirm_blank_page(p_curriculum_id uuid, p_page_no integer)
returns void
language plpgsql
as $$
begin
  if p_page_no < 1 then raise exception 'invalid page number'; end if;
  insert into public.rita_curriculum_pages (curriculum_id, page_no, text, has_text_layer, blank_confirmed)
  values (p_curriculum_id, p_page_no, '', false, true)
  on conflict (curriculum_id, page_no) do update set blank_confirmed = true;
end;
$$;

-- Applies new path_order values in one atomic call (a single function
-- invocation runs inside one transaction). The caller computes the values and
-- checks the admin role first.
create or replace function public.rita_set_lesson_path_orders(p_orders jsonb)
returns void
language plpgsql
as $$
declare
  item jsonb;
  lesson_id uuid;
  position integer;
begin
  if jsonb_typeof(p_orders) <> 'array' then
    raise exception 'orders must be a jsonb array';
  end if;
  for item in select * from jsonb_array_elements(p_orders) loop
    lesson_id := (item->>'id')::uuid;
    position := (item->>'path_order')::int;
    if position < 1 then raise exception 'invalid path order'; end if;
    update public.rita_lessons set path_order = position
    where id = lesson_id and status = 'published';
    if not found then
      raise exception 'lesson % is not a published lesson', lesson_id;
    end if;
  end loop;
end;
$$;
