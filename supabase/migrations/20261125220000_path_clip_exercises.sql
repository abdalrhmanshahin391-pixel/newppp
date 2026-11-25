-- Which exercises a film & GIF stop uses (the admin ticks them). NULL or empty: all of them.
alter table public.rita_path_items
  add column if not exists clip_exercises text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'path_clip_exercises_valid') then
    alter table public.rita_path_items
      add constraint path_clip_exercises_valid check (
        clip_exercises is null or (
          kind = 'exercises'
          and cardinality(clip_exercises) <= 7
          and clip_exercises <@ array['meaning', 'listen', 'sentence', 'blank', 'order', 'speak', 'match']::text[]
        )
      );
  end if;
end $$;

notify pgrst, 'reload schema';
