-- Existing path-item policies govern these assignments just like the stop's title.
alter table public.rita_path_items
  add column film_lines smallint[] not null default '{}',
  add constraint path_film_lines_valid check (
    cardinality(film_lines) <= 20 and
    (kind = 'exercises' or cardinality(film_lines) = 0)
  );
