-- Units on the learner's lesson path. A level is shown one short unit at a time; the next unit
-- opens when this one is done. A unit starts at an admin's 'unit' stop, whose title names it (the
-- learner sees it as the unit's heading, not as a stop). Without unit stops in a level, the app cuts
-- the level into units of five lessons on its own, so nothing here is required for units to work.
alter table public.rita_path_items drop constraint if exists rita_path_items_kind_check;
alter table public.rita_path_items
  add constraint rita_path_items_kind_check
  check (kind in ('exercises', 'resources', 'finish', 'unit'));
