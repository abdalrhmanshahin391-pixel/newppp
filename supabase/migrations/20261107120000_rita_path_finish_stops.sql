-- A level's finish line on the learner's lesson path. The path is cut into one section per level
-- (a lesson's level is its book's level, rita_curricula.level). The finish of a level is drawn after
-- its last lesson; an admin can instead place their own finish stop and move it like any other
-- stop. Its title is the level it closes ("A1" .. "C2").
alter table public.rita_path_items drop constraint if exists rita_path_items_kind_check;
alter table public.rita_path_items
  add constraint rita_path_items_kind_check check (kind in ('exercises', 'resources', 'finish'));
