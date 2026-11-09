-- Run AFTER the library phase 1/2/3 and PDF-limit migrations.
-- Preserve authenticated/admin policies, but give anon separate reader expressions
-- which never execute the protected has_role function. No private-user-table grants,
-- no security-definer functions, no storage policy changes or scheduled work.

alter policy "published books are readable" on public.books to authenticated;
drop policy if exists "visitors read published books" on public.books;
create policy "visitors read published books" on public.books
  for select to anon using (status = 'published');

alter policy "visible shelves are readable" on public.book_shelves to authenticated;
drop policy if exists "visitors read visible shelves" on public.book_shelves;
create policy "visitors read visible shelves" on public.book_shelves
  for select to anon using (visible);

alter policy "readers see rules in force" on public.book_editorial to authenticated;
drop policy if exists "visitors read rules in force" on public.book_editorial;
create policy "visitors read rules in force" on public.book_editorial
  for select to anon using (
    (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
  );

alter policy "numbers of published books are public" on public.book_stats to authenticated;
drop policy if exists "visitors read published book numbers" on public.book_stats;
create policy "visitors read published book numbers" on public.book_stats
  for select to anon using (public.book_is_published(book_id));

alter policy "daily numbers of published books are public" on public.book_daily to authenticated;
drop policy if exists "visitors read published daily numbers" on public.book_daily;
create policy "visitors read published daily numbers" on public.book_daily
  for select to anon using (public.book_is_published(book_id));

-- Visitors may page through a past snapshot but never preview a future one.
-- CASE keeps anon out of has_role; a boolean OR is not an execution guard.
create or replace function public.books_read_at(p_as_of timestamptz)
returns timestamptz
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when p_as_of is null then now()
    when auth.uid() is null then least(p_as_of, now())
    when public.has_role(auth.uid(), 'admin'::public.app_role) then p_as_of
    else least(p_as_of, now())
  end
$$;

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
  p_offset integer default 0,
  p_favorites boolean default false
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
  v_favorite_ids uuid[] := '{}';
  v_result jsonb;
  v_mean numeric := public.book_rating_mean();
  v_day date := (public.books_read_at(p_as_of) at time zone 'utc')::date;
begin
  -- Private favourites are queried only for a signed-in favourites request. Even a
  -- short-circuited EXISTS in the main query requires table rights at plan time.
  if coalesce(p_favorites, false) and auth.uid() is not null then
    select coalesce(array_agg(f.book_id), '{}'::uuid[]) into v_favorite_ids
    from public.book_favorites f where f.user_id = auth.uid();
  end if;
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
  if v_sort not in ('relevance', 'discover', 'new', 'title', 'short', 'rating', 'trending') then
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
      case when v_sort = 'rating' then (
        select (s.rating_sum + 10 * v_mean) / (s.rating_count + 10)
        from public.book_stats s where s.book_id = b.id and s.rating_count >= 3)
      end as score,
      case when v_sort = 'trending' then (
        select sum((d.views + 3 * d.reads + 2 * d.favorites) * exp(-ln(2) * (v_day - d.day) / 3.0))
        from public.book_daily d
        where d.book_id = b.id and d.day > v_day - 7 and d.day <= v_day)
      end as trend,
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
      and (not coalesce(p_favorites, false) or b.id = any (v_favorite_ids))
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
        (case when v_sort = 'rating' then h.score end) desc nulls last,
        (case when v_sort = 'trending' then h.trend end) desc nulls last,
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
