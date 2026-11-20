alter table public.rita_path_items
  add column map_level text check (map_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

-- Keep existing stations with the section they belonged to before paging the map by level.
-- Pin the association so moving a lesson back to draft cannot move its neighbouring stations.
with anchors as (
  select book.target_language as language, lesson.path_order, case when book.level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then book.level else 'A1' end as level
  from public.rita_lessons lesson
  join public.rita_curricula book on book.id = lesson.curriculum_id
  where lesson.status = 'published' and book.status = 'published' and lesson.path_order is not null
  union all
  select language, path_order, title
  from public.rita_path_items
  where kind = 'finish' and title in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
)
update public.rita_path_items as item
set map_level = coalesce(
  (
    select anchor.level
    from anchors anchor
    where anchor.language = item.language
    order by
      (anchor.path_order > item.path_order),
      abs(anchor.path_order - item.path_order),
      anchor.level
    limit 1
  ),
  'A1'
)
where item.kind <> 'finish';
