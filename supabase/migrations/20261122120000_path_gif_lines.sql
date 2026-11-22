alter table public.rita_path_items
  add column gif_lines smallint[] not null default '{}',
  add constraint path_gif_lines_valid check (
    cardinality(gif_lines) <= 20 and
    (kind = 'exercises' or cardinality(gif_lines) = 0)
  );

-- Old film-only shortcuts created empty stops with this default name.
update public.rita_path_items
set title = 'تمارين'
where kind = 'exercises' and title = 'تدريب بمقاطع الأفلام'
  and quiz_count = 0 and cardinality(film_lines) = 0;
