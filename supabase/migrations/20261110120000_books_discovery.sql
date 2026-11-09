-- Library, phase 2 (discovery). Additive only: builds on 20261109120000_books_admin_foundation.sql,
-- keeps every row, and can be run again.
--
--   * Search: each book keeps a search copy, refreshed by triggers whenever the book, its tags or a
--     tag's name change (no timer). Full-text weights: title and alternate title (A), author (B),
--     tags (C), description (D). The copy ignores case, accents, Arabic diacritics, tatweel and the
--     hamza forms of alef, and keeps the taa marbuta. pg_trgm finds a word with a small typo.
--   * books_browse: one call for every list a reader sees — search, filters (OR inside a group,
--     AND between groups), facet counts that ignore their own group, sort, pages of 24 or 48 read
--     from the database, a seeded "recommended" order, and a snapshot time (as_of) so paging does
--     not shift when books are added.
--   * books_discover: the discover page in one call — the book of the week, the admin's shelves,
--     a seeded set of picks, the newest books, and one shelf per category.
--   * Editorial rules: pin or exclude a book on the discover page or in one category, optionally
--     for a period. An exclusion always wins; pins come first, in their order.
-- Both reading calls run with the caller's rights (security invoker): readers only ever get
-- published books. A reader's as_of is never later than now; an admin may preview another time.
-- Nothing runs on a timer.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
-- Readers call the trigram functions through books_browse (Supabase already grants this).
grant usage on schema extensions to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The search copy

-- book_key (phase 1) plus the alef forms made one (أ إ آ ٱ → ا). The taa marbuta stays.
create or replace function public.book_search_norm(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(public.book_key(p), 'أإآٱ', 'اااا')
$$;

alter table public.books add column if not exists search_name text not null default '';
alter table public.books add column if not exists search_doc tsvector;

-- Refreshes the search copy of the row being written (its tags are read from the links).
create or replace function public.books_search_fill()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tags text;
begin
  select coalesce(string_agg(t.name_ar || ' ' || t.name_en, ' '), '') into v_tags
    from public.book_tag_links l
    join public.book_tags t on t.id = l.tag_id
    where l.book_id = new.id;
  new.search_name := public.book_search_norm(concat_ws(' ', new.title, new.alt_title, new.author, v_tags));
  new.search_doc :=
    setweight(to_tsvector('simple', public.book_search_norm(concat_ws(' ', new.title, new.alt_title))), 'A') ||
    setweight(to_tsvector('simple', public.book_search_norm(new.author)), 'B') ||
    setweight(to_tsvector('simple', public.book_search_norm(v_tags)), 'C') ||
    setweight(to_tsvector('simple', public.book_search_norm(new.description)), 'D');
  return new;
end;
$$;

drop trigger if exists books_search_fill on public.books;
create trigger books_search_fill before insert or update on public.books
  for each row execute function public.books_search_fill();

-- A tag added to or taken off a book, or a tag renamed: refresh the books concerned.
create or replace function public.books_search_touch_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.books set search_name = search_name
    where id = case when tg_op = 'DELETE' then old.book_id else new.book_id end;
  return null;
end;
$$;

drop trigger if exists book_tag_links_search on public.book_tag_links;
create trigger book_tag_links_search after insert or delete on public.book_tag_links
  for each row execute function public.books_search_touch_link();

create or replace function public.books_search_touch_tag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.books set search_name = search_name
    where id in (select book_id from public.book_tag_links where tag_id = new.id);
  return null;
end;
$$;

drop trigger if exists book_tags_search on public.book_tags;
create trigger book_tags_search after update of name_ar, name_en on public.book_tags
  for each row execute function public.books_search_touch_tag();

-- Fill the copy for books written before this migration (a second run finds nothing to do).
update public.books set search_name = search_name where search_doc is null;

create index if not exists books_search_doc on public.books using gin (search_doc);

do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm';
  execute format(
    'create index if not exists books_search_name_trgm on public.books using gin (search_name %I.gin_trgm_ops)',
    v_schema);
end $$;

create index if not exists books_published_new on public.books (created_at desc, id)
  where status = 'published';

-- ---------------------------------------------------------------------------------------------
-- Editorial rules: pin or exclude a book on the discover page or in one category

create table if not exists public.book_editorial (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  -- 'discover', or a category id (as text).
  context text not null check (context = 'discover' or context ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  kind text not null check (kind in ('pin', 'exclude')),
  position integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint book_editorial_period check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint book_editorial_one_rule unique (book_id, context)
);
create index if not exists book_editorial_context on public.book_editorial (context, kind, position);

alter table public.book_editorial enable row level security;

drop policy if exists "readers see rules in force" on public.book_editorial;
create policy "readers see rules in force" on public.book_editorial
  for select to anon, authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or ((starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
  );

drop policy if exists "admins manage book_editorial" on public.book_editorial;
create policy "admins manage book_editorial" on public.book_editorial
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- A deleted category takes its rules with it.
create or replace function public.book_categories_drop_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.book_editorial where context = old.id::text;
  return old;
end;
$$;

drop trigger if exists book_categories_drop_rules on public.book_categories;
create trigger book_categories_drop_rules after delete on public.book_categories
  for each row execute function public.book_categories_drop_rules();

-- True when a period (either end open) contains the moment.
create or replace function public.book_in_period(p_from timestamptz, p_until timestamptz, p_at timestamptz)
returns boolean
language sql
immutable
as $$
  select (p_from is null or p_from <= p_at) and (p_until is null or p_until > p_at)
$$;

-- Short under 150 pages, long from 350; no page count counts as medium (as on the page).
create or replace function public.book_length(p_pages integer)
returns text
language sql
immutable
as $$
  select case
    when p_pages is null then 'medium'
    when p_pages < 150 then 'short'
    when p_pages >= 350 then 'long'
    else 'medium'
  end
$$;

-- A book as the page reads it: its row without the search copy, with its tags and secondary
-- categories.
create or replace function public.book_card(b public.books)
returns jsonb
language sql
stable
set search_path = public
as $$
  select (to_jsonb(b) - 'search_doc' - 'search_name' - 'import_key') || jsonb_build_object(
    'tag_ids', coalesce((select jsonb_agg(l.tag_id) from public.book_tag_links l where l.book_id = b.id), '[]'::jsonb),
    'secondary_category_ids', coalesce((select jsonb_agg(s.category_id) from public.book_secondary_categories s where s.book_id = b.id), '[]'::jsonb)
  )
$$;

-- The moment a call reads at: now, or (for an admin) the time asked for.
create or replace function public.books_read_at(p_as_of timestamptz)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p_as_of is null then now()
    when public.has_role(auth.uid(), 'admin'::public.app_role) then p_as_of
    else least(p_as_of, now())
  end
$$;

-- ---------------------------------------------------------------------------------------------
-- books_browse: search, filters, facets, sort and pages

create or replace function public.books_browse(
  p_query text default '',
  p_categories uuid[] default '{}',
  p_levels text[] default '{}',
  p_languages text[] default '{}',
  p_lengths text[] default '{}',
  p_tags uuid[] default '{}',
  p_sort text default null,
  p_context text default null,
  p_seed text default '',
  p_as_of timestamptz default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
set pg_trgm.word_similarity_threshold = 0.5
as $$
declare
  v_at timestamptz := public.books_read_at(p_as_of);
  v_q text := btrim(left(public.book_search_norm(coalesce(p_query, '')), 80));
  v_isbn text := public.book_isbn(p_query);
  v_tsq tsquery;
  v_sort text;
  v_limit integer := case when p_limit = 48 then 48 else 24 end;
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_cats uuid[] := coalesce(p_categories, '{}');
  v_levels text[] := coalesce(p_levels, '{}');
  v_langs text[] := coalesce(p_languages, '{}');
  v_lens text[] := coalesce(p_lengths, '{}');
  v_tags uuid[] := coalesce(p_tags, '{}');
  v_result jsonb;
begin
  if v_q <> '' then
    select to_tsquery('simple', string_agg(quote_literal(w) || ':*', ' & '))
      into v_tsq
      from regexp_split_to_table(v_q, ' ') as w
      where w <> '';
  end if;
  if v_isbn is not null and char_length(v_isbn) < 10 then
    v_isbn := null;
  end if;
  v_sort := coalesce(p_sort, case
    when v_q <> '' then 'relevance'
    when p_context is not null then 'discover'
    else 'new'
  end);
  if v_sort not in ('relevance', 'discover', 'new', 'title', 'short') then
    v_sort := 'new';
  end if;
  if v_sort = 'relevance' and v_q = '' then
    v_sort := 'new';
  end if;

  with found as (
    select
      b,
      b.id,
      b.created_at,
      b.pages,
      b.title,
      case
        when v_q = '' then 0
        when v_isbn is not null and b.isbn = v_isbn then 3
        when v_tsq is not null and b.search_doc @@ v_tsq then 1 + ts_rank_cd(b.search_doc, v_tsq)
        else word_similarity(v_q, b.search_name) * 0.5
      end as rank,
      (select e.position from public.book_editorial e
        where e.book_id = b.id and e.kind = 'pin' and e.context = p_context
          and public.book_in_period(e.starts_at, e.ends_at, v_at)) as pin,
      (cardinality(v_cats) = 0 or b.category_id = any (v_cats) or exists (
        select 1 from public.book_secondary_categories s
        where s.book_id = b.id and s.category_id = any (v_cats))) as m_cat,
      (cardinality(v_levels) = 0 or b.level = any (v_levels)) as m_level,
      (cardinality(v_langs) = 0 or b.language = any (v_langs)) as m_lang,
      (cardinality(v_lens) = 0 or public.book_length(b.pages) = any (v_lens)) as m_len,
      (cardinality(v_tags) = 0 or exists (
        select 1 from public.book_tag_links l where l.book_id = b.id and l.tag_id = any (v_tags))) as m_tag
    from public.books b
    where b.status = 'published'
      and b.created_at <= v_at
      and (
        v_q = ''
        or (v_tsq is not null and b.search_doc @@ v_tsq)
        or (v_isbn is not null and b.isbn = v_isbn)
        or (char_length(v_q) >= 4 and v_q <% b.search_name)
      )
      and not exists (
        select 1 from public.book_editorial e
        where e.book_id = b.id and e.kind = 'exclude' and e.context = p_context
          and public.book_in_period(e.starts_at, e.ends_at, v_at))
  ),
  hits as (
    select * from found where m_cat and m_level and m_lang and m_len and m_tag
  ),
  ordered as (
    select h.b, h.id, row_number() over (
      order by
        (case when v_sort = 'discover' then coalesce(h.pin, 2147483647) end),
        (case when v_sort = 'discover' then md5(coalesce(p_seed, '') || ':' || h.id) end),
        (case when v_sort = 'relevance' then h.rank end) desc,
        (case when v_sort = 'title' then public.book_key(h.title) end),
        (case when v_sort = 'short' then coalesce(h.pages, 2147483647) end),
        h.created_at desc,
        h.id
    ) as ord
    from hits h
  ),
  page as (
    select o.b, o.id, o.ord
    from ordered o
    where o.ord > v_offset
    order by o.ord
    limit v_limit
  )
  select jsonb_build_object(
    'as_of', v_at,
    'sort', v_sort,
    'limit', v_limit,
    'offset', v_offset,
    'total', (select count(*) from hits),
    'items', coalesce((
      select jsonb_agg(public.book_card(p.b) order by p.ord)
      from page p
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'category', coalesce((
        select jsonb_object_agg(cid, n) from (
          select cid, count(distinct id) as n from (
            select f.id, (f.b).category_id as cid from found f
              where f.m_level and f.m_lang and f.m_len and f.m_tag
            union all
            select f.id, s.category_id from found f
              join public.book_secondary_categories s on s.book_id = f.id
              where f.m_level and f.m_lang and f.m_len and f.m_tag
          ) z where cid is not null group by cid
        ) c), '{}'::jsonb),
      'level', coalesce((
        select jsonb_object_agg(k, n) from (
          select (f.b).level as k, count(*) as n from found f
            where f.m_cat and f.m_lang and f.m_len and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'language', coalesce((
        select jsonb_object_agg(k, n) from (
          select (f.b).language as k, count(*) as n from found f
            where f.m_cat and f.m_level and f.m_len and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'length', coalesce((
        select jsonb_object_agg(k, n) from (
          select public.book_length(f.pages) as k, count(*) as n from found f
            where f.m_cat and f.m_level and f.m_lang and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'tag', coalesce((
        select jsonb_object_agg(k, n) from (
          select l.tag_id as k, count(*) as n from found f
            join public.book_tag_links l on l.book_id = f.id
            where f.m_cat and f.m_level and f.m_lang and f.m_len group by 1
        ) c), '{}'::jsonb)
    )
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- books_discover: the discover page in one call

create or replace function public.books_discover(
  p_seed text default '',
  p_as_of timestamptz default null,
  p_per integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select public.books_read_at(p_as_of) as at, least(greatest(coalesce(p_per, 12), 1), 24) as per
  ),
  live as (
    select b.id, b.category_id, b.sort, b.created_at
    from public.books b, params
    where b.status = 'published' and b.created_at <= params.at
  ),
  rules as (
    select e.book_id, e.context, e.kind, e.position
    from public.book_editorial e, params
    where public.book_in_period(e.starts_at, e.ends_at, params.at)
  ),
  -- Hidden from the discover page (the admin's own shelves and the book of the week excepted).
  shown as (
    select l.* from live l
    where not exists (
      select 1 from rules r where r.book_id = l.id and r.context = 'discover' and r.kind = 'exclude')
  ),
  picks as (
    select s.id, row_number() over (
      order by r.position nulls last, md5(coalesce(p_seed, '') || ':' || s.id), s.id) as n
    from shown s
    left join rules r on r.book_id = s.id and r.context = 'discover' and r.kind = 'pin'
  ),
  newest as (
    select s.id, row_number() over (order by s.created_at desc, s.id) as n from shown s
  ),
  loose as (
    select s.id, row_number() over (order by s.sort, s.created_at desc, s.id) as n
    from shown s
    left join public.book_categories c on c.id = s.category_id
    where c.id is null
  ),
  in_category as (
    select s.id, s.category_id, row_number() over (
      partition by s.category_id
      order by r.position nulls last, s.sort, s.created_at desc, s.id) as n
    from shown s
    left join rules r on r.book_id = s.id and r.context = s.category_id::text and r.kind = 'pin'
    where s.category_id is not null
      and not exists (
        select 1 from rules x
        where x.book_id = s.id and x.context = s.category_id::text and x.kind = 'exclude')
  ),
  categories as (
    select c.id, c.sort, count(i.id) as total,
      array_agg(i.id order by i.n) filter (where i.n <= (select per from params)) as ids
    from public.book_categories c
    join in_category i on i.category_id = c.id
    group by c.id, c.sort
  ),
  shelves as (
    select sh.id, sh.name_ar, sh.name_en, sh.sort,
      array(
        select i.book_id from public.book_shelf_items i
        join live l on l.id = i.book_id
        where i.shelf_id = sh.id
        order by i.position
        limit 24
      ) as ids
    from public.book_shelves sh, params
    where sh.visible and public.book_in_period(sh.starts_at, sh.ends_at, params.at)
  ),
  featured as (
    select b.id from public.books b, params
    where b.featured and b.status = 'published' and b.created_at <= params.at
      and public.book_in_period(b.featured_from, b.featured_until, params.at)
    limit 1
  ),
  wanted as (
    select id from picks where n <= (select per from params)
    union select id from newest where n <= (select per from params)
    union select id from loose where n <= (select per from params)
    union select unnest(ids) from categories
    union select unnest(ids) from shelves
    union select id from featured
  )
  select jsonb_build_object(
    'as_of', (select at from params),
    'total', (select count(*) from live),
    'featured_id', (select id from featured),
    'picks', coalesce((select jsonb_agg(id order by n) from picks where n <= (select per from params)), '[]'::jsonb),
    'newest', coalesce((select jsonb_agg(id order by n) from newest where n <= (select per from params)), '[]'::jsonb),
    'loose', coalesce((select jsonb_agg(id order by n) from loose where n <= (select per from params)), '[]'::jsonb),
    'shelves', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name_ar', name_ar, 'name_en', name_en, 'ids', to_jsonb(ids)) order by sort)
      from shelves where cardinality(ids) > 0), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'total', total, 'ids', to_jsonb(ids)) order by sort)
      from categories), '[]'::jsonb),
    'books', coalesce((
      select jsonb_object_agg(b.id, public.book_card(b))
      from public.books b where b.id in (select id from wanted)), '{}'::jsonb)
  )
$$;

revoke all on function public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer) from public;
revoke all on function public.books_discover(text, timestamptz, integer) from public;
grant execute on function public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer) to anon, authenticated;
grant execute on function public.books_discover(text, timestamptz, integer) to anon, authenticated;
grant execute on function public.book_search_norm(text), public.book_in_period(timestamptz, timestamptz, timestamptz),
  public.book_length(integer), public.book_card(public.books), public.books_read_at(timestamptz)
  to anon, authenticated;
grant select on public.book_editorial to anon, authenticated;
grant insert, update, delete on public.book_editorial to authenticated;
