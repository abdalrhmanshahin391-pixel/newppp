-- Library, phase 3 (popularity). Additive only: builds on 20261110120000_books_discovery.sql,
-- keeps every row, and can be run again.
--
--   * Events: a signed-in reader opening a book ("view") or starting to read it ("read"), counted
--     once per book, person, day and kind (a repeat is ignored). Visitors are not counted. The
--     person comes from auth.uid(), never from the page.
--   * Favourites and ratings (1–5, one per person and book, changeable). Each person reads and
--     writes only their own; only published books.
--   * The public numbers live in two tables without any identity: per book (ratings count and sum,
--     favourites, views, reads) and per book and day (views, reads, favourites, ratings). Three small
--     triggers keep them (security definer, which is all they can do); nothing reads people's rows.
--   * Top rated: a Bayesian average S = (v·R + m·C) / (v + m), m = 10, C the mean of all ratings;
--     only books with at least 3 ratings. Trending: T = Σ (V + 3R + 2F) · exp(−ln2 · d / 3) over the
--     last 7 days (d in days). Both are computed when asked: no timer, no materialized view.
--   * books_popular (the two discover shelves), books_browse gains the "rating" and "trending"
--     orders and "my favourites", book cards carry their rating, and books_analytics (admins).
-- Every reading call runs with the caller's rights (security invoker). Nothing runs on a timer.

-- ---------------------------------------------------------------------------------------------
-- People's own rows

create table if not exists public.book_events (
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('view', 'read')),
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  primary key (book_id, user_id, day, kind)
);

create table if not exists public.book_favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index if not exists book_favorites_book on public.book_favorites (book_id);

create table if not exists public.book_ratings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index if not exists book_ratings_book on public.book_ratings (book_id);

-- ---------------------------------------------------------------------------------------------
-- Public numbers (no identities)

create table if not exists public.book_stats (
  book_id uuid primary key references public.books (id) on delete cascade,
  rating_count integer not null default 0,
  rating_sum integer not null default 0,
  favorite_count integer not null default 0,
  views integer not null default 0,
  reads integer not null default 0
);

create table if not exists public.book_daily (
  book_id uuid not null references public.books (id) on delete cascade,
  day date not null,
  views integer not null default 0,
  reads integer not null default 0,
  favorites integer not null default 0,
  ratings integer not null default 0,
  primary key (book_id, day)
);
create index if not exists book_daily_day on public.book_daily (day, book_id);

alter table public.book_events enable row level security;
alter table public.book_favorites enable row level security;
alter table public.book_ratings enable row level security;
alter table public.book_stats enable row level security;
alter table public.book_daily enable row level security;

-- A published book (readers act only on these).
create or replace function public.book_is_published(p_book uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.books where id = p_book and status = 'published')
$$;

drop policy if exists "people record their own reading" on public.book_events;
create policy "people record their own reading" on public.book_events
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));
drop policy if exists "admins read reading events" on public.book_events;
create policy "admins read reading events" on public.book_events
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "people see their own favorites" on public.book_favorites;
create policy "people see their own favorites" on public.book_favorites
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "people add their own favorites" on public.book_favorites;
create policy "people add their own favorites" on public.book_favorites
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));
drop policy if exists "people remove their own favorites" on public.book_favorites;
create policy "people remove their own favorites" on public.book_favorites
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "people see their own ratings" on public.book_ratings;
create policy "people see their own ratings" on public.book_ratings
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "people rate published books" on public.book_ratings;
create policy "people rate published books" on public.book_ratings
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));
drop policy if exists "people change their own ratings" on public.book_ratings;
create policy "people change their own ratings" on public.book_ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.book_is_published(book_id));
drop policy if exists "people remove their own ratings" on public.book_ratings;
create policy "people remove their own ratings" on public.book_ratings
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "numbers of published books are public" on public.book_stats;
create policy "numbers of published books are public" on public.book_stats
  for select to anon, authenticated
  using (public.book_is_published(book_id) or public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "daily numbers of published books are public" on public.book_daily;
create policy "daily numbers of published books are public" on public.book_daily
  for select to anon, authenticated
  using (public.book_is_published(book_id) or public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_events, public.book_favorites, public.book_ratings,
  public.book_stats, public.book_daily from anon;
revoke insert, update, delete on public.book_stats, public.book_daily from authenticated;
grant select on public.book_stats, public.book_daily to anon, authenticated;
grant select, insert on public.book_events to authenticated;
grant select, insert, delete on public.book_favorites to authenticated;
grant select, insert, update, delete on public.book_ratings to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The triggers that keep the public numbers (the only writers of book_stats and book_daily)

create or replace function public.book_numbers_add(
  p_book uuid, p_day date, p_views integer, p_reads integer, p_favorites integer, p_ratings integer,
  p_rating_count integer, p_rating_sum integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The book may be on its way out (a delete cascading): then there is nothing to count.
  if not exists (select 1 from public.books where id = p_book) then
    return;
  end if;
  insert into public.book_stats as s (book_id, rating_count, rating_sum, favorite_count, views, reads)
    values (p_book, greatest(p_rating_count, 0), greatest(p_rating_sum, 0), greatest(p_favorites, 0),
            greatest(p_views, 0), greatest(p_reads, 0))
    on conflict (book_id) do update set
      rating_count = greatest(s.rating_count + p_rating_count, 0),
      rating_sum = greatest(s.rating_sum + p_rating_sum, 0),
      favorite_count = greatest(s.favorite_count + p_favorites, 0),
      views = s.views + p_views,
      reads = s.reads + p_reads;
  if p_day is not null then
    insert into public.book_daily as d (book_id, day, views, reads, favorites, ratings)
      values (p_book, p_day, greatest(p_views, 0), greatest(p_reads, 0), greatest(p_favorites, 0),
              greatest(p_ratings, 0))
      on conflict (book_id, day) do update set
        views = greatest(d.views + p_views, 0),
        reads = greatest(d.reads + p_reads, 0),
        favorites = greatest(d.favorites + p_favorites, 0),
        ratings = greatest(d.ratings + p_ratings, 0);
  end if;
end;
$$;
revoke all on function public.book_numbers_add(uuid, date, integer, integer, integer, integer, integer, integer)
  from public, anon, authenticated;

create or replace function public.book_events_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.book_numbers_add(new.book_id, new.day,
    (new.kind = 'view')::int, (new.kind = 'read')::int, 0, 0, 0, 0);
  return null;
end;
$$;
drop trigger if exists book_events_count on public.book_events;
create trigger book_events_count after insert on public.book_events
  for each row execute function public.book_events_count();

create or replace function public.book_favorites_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.book_numbers_add(new.book_id, (new.created_at at time zone 'utc')::date, 0, 0, 1, 0, 0, 0);
  else
    perform public.book_numbers_add(old.book_id, (old.created_at at time zone 'utc')::date, 0, 0, -1, 0, 0, 0);
  end if;
  return null;
end;
$$;
drop trigger if exists book_favorites_count on public.book_favorites;
create trigger book_favorites_count after insert or delete on public.book_favorites
  for each row execute function public.book_favorites_count();

create or replace function public.book_ratings_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.book_numbers_add(new.book_id, (now() at time zone 'utc')::date, 0, 0, 0, 1, 1, new.rating);
  elsif tg_op = 'UPDATE' then
    perform public.book_numbers_add(new.book_id, null, 0, 0, 0, 0, 0, new.rating - old.rating);
  else
    perform public.book_numbers_add(old.book_id, null, 0, 0, 0, 0, -1, -old.rating);
  end if;
  return null;
end;
$$;
drop trigger if exists book_ratings_count on public.book_ratings;
create trigger book_ratings_count after insert or update of rating or delete on public.book_ratings
  for each row execute function public.book_ratings_count();

-- Ratings written before this file ran (none in practice; keeps a second run exact).
insert into public.book_stats (book_id, rating_count, rating_sum)
  select book_id, count(*), sum(rating) from public.book_ratings group by book_id
  on conflict (book_id) do update set rating_count = excluded.rating_count, rating_sum = excluded.rating_sum;

-- ---------------------------------------------------------------------------------------------
-- Scores

-- The mean of all ratings of published books (C in the Bayesian average).
create or replace function public.book_rating_mean()
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(s.rating_sum)::numeric / nullif(sum(s.rating_count), 0), 0)
  from public.book_stats s
  join public.books b on b.id = s.book_id and b.status = 'published'
$$;

-- A book as the page reads it, now with its rating (average and count).
create or replace function public.book_card(b public.books)
returns jsonb
language sql
stable
set search_path = public
as $$
  select (to_jsonb(b) - 'search_doc' - 'search_name' - 'import_key') || jsonb_build_object(
    'tag_ids', coalesce((select jsonb_agg(l.tag_id) from public.book_tag_links l where l.book_id = b.id), '[]'::jsonb),
    'secondary_category_ids', coalesce((select jsonb_agg(s.category_id) from public.book_secondary_categories s where s.book_id = b.id), '[]'::jsonb),
    'rating_count', coalesce((select st.rating_count from public.book_stats st where st.book_id = b.id), 0),
    'rating_avg', (select round(st.rating_sum::numeric / st.rating_count, 2) from public.book_stats st
                   where st.book_id = b.id and st.rating_count > 0)
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- books_browse: the "rating" and "trending" orders and "my favourites" (replaces phase 2's)

drop function if exists public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer);

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
  v_result jsonb;
  v_mean numeric := public.book_rating_mean();
  v_day date := (public.books_read_at(p_as_of) at time zone 'utc')::date;
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
      and (not coalesce(p_favorites, false) or exists (
        select 1 from public.book_favorites f where f.book_id = b.id and f.user_id = auth.uid()))
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

-- ---------------------------------------------------------------------------------------------
-- books_popular: the two discover shelves

create or replace function public.books_popular(
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
    select public.books_read_at(p_as_of) as at,
      (public.books_read_at(p_as_of) at time zone 'utc')::date as day,
      least(greatest(coalesce(p_per, 12), 1), 24) as per,
      public.book_rating_mean() as mean
  ),
  live as (
    select b.id from public.books b, params
    where b.status = 'published' and b.created_at <= params.at
      and not exists (
        select 1 from public.book_editorial e
        where e.book_id = b.id and e.context = 'discover' and e.kind = 'exclude'
          and public.book_in_period(e.starts_at, e.ends_at, params.at))
  ),
  rated as (
    select l.id, (s.rating_sum + 10 * p.mean) / (s.rating_count + 10) as score, s.rating_count
    from live l
    join public.book_stats s on s.book_id = l.id and s.rating_count >= 3
    cross join params p
  ),
  trending as (
    select d.book_id as id,
      sum((d.views + 3 * d.reads + 2 * d.favorites) * exp(-ln(2) * (p.day - d.day) / 3.0)) as score
    from public.book_daily d
    cross join params p
    where d.book_id in (select id from live) and d.day > p.day - 7 and d.day <= p.day
    group by d.book_id
    having sum(d.views + d.reads + d.favorites) > 0
  ),
  top_rated as (
    select id, row_number() over (order by score desc, rating_count desc, id) as n from rated
  ),
  top_trending as (
    select id, row_number() over (order by score desc, id) as n from trending
  ),
  wanted as (
    select id from top_rated where n <= (select per from params)
    union select id from top_trending where n <= (select per from params)
  )
  select jsonb_build_object(
    'as_of', (select at from params),
    'top_rated', coalesce((select jsonb_agg(id order by n) from top_rated where n <= (select per from params)), '[]'::jsonb),
    'trending', coalesce((select jsonb_agg(id order by n) from top_trending where n <= (select per from params)), '[]'::jsonb),
    'books', coalesce((
      select jsonb_object_agg(b.id, public.book_card(b))
      from public.books b where b.id in (select id from wanted)), '{}'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- What a signed-in reader does

-- Records that the reader opened ("view") or started ("read") a published book; once a day.
create or replace function public.books_track(p_book uuid, p_kind text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or p_kind not in ('view', 'read') or not public.book_is_published(p_book) then
    return false;
  end if;
  insert into public.book_events (book_id, user_id, kind) values (p_book, auth.uid(), p_kind)
    on conflict do nothing;
  return found;
end;
$$;

-- Sets (1–5) or removes (null) the reader's rating; returns the book's new numbers.
create or replace function public.books_rate(p_book uuid, p_rating integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;
  if p_rating is null then
    delete from public.book_ratings where user_id = auth.uid() and book_id = p_book;
  else
    if p_rating not between 1 and 5 then
      raise exception 'rating_out_of_range' using errcode = '22023';
    end if;
    insert into public.book_ratings (user_id, book_id, rating) values (auth.uid(), p_book, p_rating)
      on conflict (user_id, book_id) do update set rating = excluded.rating, updated_at = now();
  end if;
  return jsonb_build_object(
    'rating', p_rating,
    'rating_count', coalesce((select rating_count from public.book_stats where book_id = p_book), 0),
    'rating_avg', (select round(rating_sum::numeric / rating_count, 2) from public.book_stats
                   where book_id = p_book and rating_count > 0));
end;
$$;

-- Adds the book to the reader's favourites (p_on) or takes it off.
create or replace function public.books_favorite(p_book uuid, p_on boolean)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;
  if p_on then
    insert into public.book_favorites (user_id, book_id) values (auth.uid(), p_book) on conflict do nothing;
  else
    delete from public.book_favorites where user_id = auth.uid() and book_id = p_book;
  end if;
  return p_on;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- books_analytics: the admin's numbers for the last p_days days and the days before them

create or replace function public.books_analytics(p_days integer default 7)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_days integer := case when p_days in (7, 30) then p_days else 7 end;
  v_today date := (now() at time zone 'utc')::date;
  v_from date := v_today - v_days + 1;
  v_prev date := v_today - 2 * v_days + 1;
  v_mean numeric;
begin
  perform public.books_require_admin();
  v_mean := public.book_rating_mean();
  return jsonb_build_object(
    'days', v_days,
    'now', (select jsonb_build_object(
        'views', coalesce(sum(views), 0), 'reads', coalesce(sum(reads), 0),
        'favorites', coalesce(sum(favorites), 0), 'ratings', coalesce(sum(ratings), 0))
      from public.book_daily where day between v_from and v_today),
    'before', (select jsonb_build_object(
        'views', coalesce(sum(views), 0), 'reads', coalesce(sum(reads), 0),
        'favorites', coalesce(sum(favorites), 0), 'ratings', coalesce(sum(ratings), 0))
      from public.book_daily where day between v_prev and v_from - 1),
    'trending', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'score', round(score::numeric, 2),
                                          'views', views, 'reads', reads) order by score desc)
      from (
        select b.id, b.title,
          sum((d.views + 3 * d.reads + 2 * d.favorites) * exp(-ln(2) * (v_today - d.day) / 3.0)) as score,
          sum(d.views) as views, sum(d.reads) as reads
        from public.book_daily d join public.books b on b.id = d.book_id and b.status = 'published'
        where d.day > v_today - 7
        group by b.id, b.title
        order by score desc
        limit 10
      ) t), '[]'::jsonb),
    'top_rated', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'score', round(score, 2),
                                          'average', average, 'count', rating_count) order by score desc)
      from (
        select b.id, b.title, s.rating_count,
          round(s.rating_sum::numeric / s.rating_count, 2) as average,
          (s.rating_sum + 10 * v_mean) / (s.rating_count + 10) as score
        from public.book_stats s join public.books b on b.id = s.book_id and b.status = 'published'
        where s.rating_count >= 3
        order by score desc
        limit 10
      ) t), '[]'::jsonb),
    'stars', (select jsonb_build_object(
        '1', count(*) filter (where rating = 1), '2', count(*) filter (where rating = 2),
        '3', count(*) filter (where rating = 3), '4', count(*) filter (where rating = 4),
        '5', count(*) filter (where rating = 5))
      from public.book_ratings r join public.books b on b.id = r.book_id and b.status = 'published'),
    'unopened_count', (select count(*) from public.books b
      where b.status = 'published' and not exists (
        select 1 from public.book_daily d where d.book_id = b.id and d.day between v_from and v_today and d.views > 0)),
    'unopened', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title) order by title)
      from (
        select b.id, b.title from public.books b
        where b.status = 'published' and not exists (
          select 1 from public.book_daily d where d.book_id = b.id and d.day between v_from and v_today and d.views > 0)
        order by b.title
        limit 20
      ) t), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer, boolean) from public;
grant execute on function public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer, boolean) to anon, authenticated;
revoke all on function public.books_popular(timestamptz, integer) from public;
grant execute on function public.books_popular(timestamptz, integer) to anon, authenticated;
-- A visitor's books_track simply answers false (nothing is recorded).
revoke all on function public.books_track(uuid, text) from public;
grant execute on function public.books_track(uuid, text) to anon, authenticated;
revoke all on function public.books_rate(uuid, integer), public.books_favorite(uuid, boolean),
  public.books_analytics(integer) from public, anon;
grant execute on function public.books_rate(uuid, integer), public.books_favorite(uuid, boolean),
  public.books_analytics(integer) to authenticated;
grant execute on function public.book_is_published(uuid), public.book_rating_mean() to anon, authenticated;
