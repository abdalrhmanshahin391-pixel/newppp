-- An exercises stop is either a Lecture Lab quiz ('quiz') or a film clips & GIFs stop ('clips'),
-- each its own circle on the path. NULL keeps an older stop that holds both kinds (or none yet):
-- it still shows the choice between them.
alter table public.rita_path_items
  add column if not exists exercise_mode text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'path_exercise_mode_valid') then
    alter table public.rita_path_items
      add constraint path_exercise_mode_valid check (
        exercise_mode is null or (kind = 'exercises' and exercise_mode in ('quiz', 'clips'))
      );
  end if;
end $$;

-- Existing stops take the kind of the one thing they hold.
update public.rita_path_items
set exercise_mode = case
  when quiz_count > 0 then 'quiz'
  else 'clips'
end
where kind = 'exercises'
  and exercise_mode is null
  and (quiz_count > 0) <> (
    cardinality(clip_ids) > 0 or cardinality(film_lines) > 0 or cardinality(gif_lines) > 0
  );
