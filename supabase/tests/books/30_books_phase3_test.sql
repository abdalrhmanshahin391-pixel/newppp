-- Library phase 3 (popularity): events once a day, favourites, ratings, the public numbers, the
-- Bayesian top rated, the 7-day trend, privacy, the admin's numbers, and the release targets
-- (24 cards, a discover answer under 150 KB, 95% of calls under 250 ms on 1000 books and
-- 20,000 events) — on the real migrations (pgTAP).
\set ON_ERROR_STOP on
begin;
select no_plan();

insert into auth.users values
  ('a0000000-0000-4000-8000-000000000001'), ('b0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000003');
insert into auth.users select ('c1000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, 45) g;
insert into public.user_roles values ('a0000000-0000-4000-8000-000000000001', 'admin');
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set one '''b0000000-0000-4000-8000-000000000002'''
\set two '''b0000000-0000-4000-8000-000000000003'''

insert into public.book_categories (id, name_ar, name_en, color, icon) values
  ('c0000000-0000-4000-8000-000000000001', 'روايات', 'Novels', 'rose', 'heart');
insert into public.books (id, title, author, category_id, level, language, status, rights_checked, created_at)
  select ('d0000000-0000-4000-8000-00000000000' || g)::uuid, 'Book ' || g, 'Writer', 'c0000000-0000-4000-8000-000000000001',
         'B1', 'en', case when g = 9 then 'draft' else 'published' end, g <> 9, now() - interval '30 days'
  from generate_series(1, 9) g;
-- Books 1–8 are published; book 9 is a draft.

create function pg_temp.ids(r jsonb, k text) returns text[] language sql as $$
  select coalesce(array_agg(right(x, 1) order by n), '{}') from jsonb_array_elements_text(r->k) with ordinality as t(x, n)
$$;
create function pg_temp.stat(b int, col text) returns int language sql as $$
  select (to_jsonb(s) ->> col)::int from public.book_stats s where s.book_id = ('d0000000-0000-4000-8000-00000000000' || b)::uuid
$$;

-- ---- structure -------------------------------------------------------------------------------
select has_table('public', 'book_events', 'events table');
select has_table('public', 'book_favorites', 'favourites table');
select has_table('public', 'book_ratings', 'ratings table');
select has_table('public', 'book_stats', 'public numbers per book');
select has_table('public', 'book_daily', 'public numbers per book and day');
select has_function('public', 'books_popular', 'books_popular exists');
select has_function('public', 'books_analytics', 'books_analytics exists');
select is((select count(*)::int from pg_proc where proname = 'books_browse'), 1, 'one books_browse (the older one is replaced)');

-- ---- events ----------------------------------------------------------------------------------
select is(test_value(null, $$select to_jsonb(public.books_track('d0000000-0000-4000-8000-000000000001', 'view'))$$)::text,
  'false', 'a visitor is not counted');
select is(test_value(:one, $$select to_jsonb(public.books_track('d0000000-0000-4000-8000-000000000001', 'view'))$$)::text,
  'true', 'a signed-in reader opening a book is counted');
select is(test_value(:one, $$select to_jsonb(public.books_track('d0000000-0000-4000-8000-000000000001', 'view'))$$)::text,
  'false', '... once a day');
select is(test_value(:one, $$select to_jsonb(public.books_track('d0000000-0000-4000-8000-000000000001', 'read'))$$)::text,
  'true', 'starting to read is counted on its own');
select is(pg_temp.stat(1, 'views'), 1, 'the public number of views');
select is(pg_temp.stat(1, 'reads'), 1, 'the public number of reads');
select is((select views + reads from public.book_daily where book_id = 'd0000000-0000-4000-8000-000000000001'), 2,
  'the day''s numbers');
select is(test_value(:one, $$select to_jsonb(public.books_track('d0000000-0000-4000-8000-000000000009', 'view'))$$)::text,
  'false', 'a draft is not counted');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_events (book_id, user_id, kind) values
    ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'view')
$q$)$$, :one), '42501', null, 'nobody records an event in someone else''s name');
select is(test_value(:one, 'select count(*) from public.book_events')::int, 0, 'readers cannot list events');
select is(test_value(:admin, 'select count(*) from public.book_events')::int, 2, 'admins can');

-- ---- ratings ---------------------------------------------------------------------------------
select is(test_value(:one, $$select public.books_rate('d0000000-0000-4000-8000-000000000001', 5)$$)->>'rating_count',
  '1', 'a reader rates a book');
select is(test_value(:one, $$select public.books_rate('d0000000-0000-4000-8000-000000000001', 2)$$)->>'rating_avg',
  '2.00', 'changing the rating replaces it (no double count)');
select is(pg_temp.stat(1, 'rating_count'), 1, '... still one rating');
select is(test_value(:one, $$select public.books_rate('d0000000-0000-4000-8000-000000000001', null)$$)->>'rating_count',
  '0', 'removing the rating');
select throws_ok(format($$select test_as(%L, $q$select public.books_rate('d0000000-0000-4000-8000-000000000001', 6)$q$)$$, :one),
  '22023', null, 'a rating is 1 to 5');
select throws_ok(format($$select test_as(%L, $q$select public.books_rate('d0000000-0000-4000-8000-000000000009', 4)$q$)$$, :one),
  '42501', null, 'a draft cannot be rated');
select throws_ok($$select test_as(null, $q$select public.books_rate('d0000000-0000-4000-8000-000000000001', 4)$q$)$$,
  '42501', null, 'a visitor cannot rate');
select lives_ok(format($$select test_as(%L, $q$select public.books_rate('d0000000-0000-4000-8000-000000000002', 4)$q$)$$, :two),
  'another reader rates');
select is(test_value(:one, 'select count(*) from public.book_ratings')::int, 0, 'a reader never sees other people''s ratings');
select lives_ok(format($$select test_as(%L, $q$
  update public.book_ratings set rating = 1 where book_id = 'd0000000-0000-4000-8000-000000000002'
$q$)$$, :one), 'trying to change someone else''s rating ...');
select is((select rating::int from public.book_ratings where book_id = 'd0000000-0000-4000-8000-000000000002'), 4,
  '... changes nothing');

-- ---- favourites ------------------------------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$select public.books_favorite('d0000000-0000-4000-8000-000000000001', true)$q$)$$, :one),
  'a reader adds a favourite');
select lives_ok(format($$select test_as(%L, $q$select public.books_favorite('d0000000-0000-4000-8000-000000000001', true)$q$)$$, :one),
  '... twice is fine');
select is(pg_temp.stat(1, 'favorite_count'), 1, 'counted once');
select lives_ok(format($$select test_as(%L, $q$select public.books_favorite('d0000000-0000-4000-8000-000000000001', false)$q$)$$, :one),
  'and takes it off');
select is(pg_temp.stat(1, 'favorite_count'), 0, 'the number goes down');
select is((select favorites from public.book_daily where book_id = 'd0000000-0000-4000-8000-000000000001'), 0,
  'and the day''s number too');
select lives_ok(format($$select test_as(%L, $q$
  select public.books_favorite('d0000000-0000-4000-8000-000000000002', true);
$q$)$$, :one), 'favourite again');
select lives_ok(format($$select test_as(%L, $q$
  select public.books_favorite('d0000000-0000-4000-8000-000000000003', true);
$q$)$$, :one), 'another favourite');
select is((test_value(:one, $$select public.books_browse(p_favorites => true)$$)->>'total')::int, 2, '«my favourites» lists mine');
select is((test_value(:two, $$select public.books_browse(p_favorites => true)$$)->>'total')::int, 0, '... and only mine');
select is((test_value(null, $$select public.books_browse(p_favorites => true)$$)->>'total')::int, 0, 'a visitor has none');
select is(test_value(:two, 'select count(*) from public.book_favorites')::int, 0, 'nobody sees other people''s favourites');

-- ---- the Bayesian top rated ------------------------------------------------------------------
-- Book 1: three 5s. Book 2: forty ratings averaging 4.6 plus reader two's 4 (41, ≈ 4.59).
-- Book 3: one 5. Book 4: three 1s. C = 211 / 48 ≈ 4.40, so S1 = (15 + 10C) / 13 ≈ 4.535 and
-- S2 = (188 + 10C) / 51 ≈ 4.548: many good ratings beat three perfect ones.
insert into public.book_ratings (user_id, book_id, rating)
  select ('c1000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'd0000000-0000-4000-8000-000000000001', 5 from generate_series(1, 3) g;
insert into public.book_ratings (user_id, book_id, rating)
  select ('c1000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'd0000000-0000-4000-8000-000000000002',
         case when g <= 24 then 5 else 4 end from generate_series(1, 40) g;
insert into public.book_ratings (user_id, book_id, rating) values
  ('c1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 5);
insert into public.book_ratings (user_id, book_id, rating)
  select ('c1000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'd0000000-0000-4000-8000-000000000004', 1 from generate_series(1, 3) g;

select is(round(public.book_rating_mean(), 4), round(211::numeric / 48, 4), 'C is the mean of all ratings');
select is(pg_temp.ids(test_value(null, $$select public.books_popular()$$), 'top_rated'), array['2', '1', '4'],
  'top rated follows the Bayesian average; fewer than 3 ratings are left out');
select is(
  (select array_agg(right(x->>'id', 1) order by n) from jsonb_array_elements(test_value(null, $$select public.books_browse(p_sort => 'rating')$$)->'items') with ordinality t(x, n)),
  array['2', '1', '4', '3', '5', '6', '7', '8'], 'the "rating" order: scored books first, then the rest');
select is(
  (select x->>'rating_count' from jsonb_array_elements(test_value(null, $$select public.books_browse(p_sort => 'rating')$$)->'items') x
   where x->>'id' = 'd0000000-0000-4000-8000-000000000002'), '41', 'a card carries its rating count');
select is(
  (select x->>'rating_avg' from jsonb_array_elements(test_value(null, $$select public.books_browse(p_sort => 'rating')$$)->'items') x
   where x->>'id' = 'd0000000-0000-4000-8000-000000000001'), '5.00', '... and its average');

-- ---- the 7-day trend -------------------------------------------------------------------------
insert into public.book_daily (book_id, day, views) values
  ('d0000000-0000-4000-8000-000000000003', (now() at time zone 'utc')::date, 10),
  ('d0000000-0000-4000-8000-000000000004', (now() at time zone 'utc')::date - 8, 100)
  on conflict (book_id, day) do update set views = book_daily.views + excluded.views;
insert into public.book_daily (book_id, day, reads) values
  ('d0000000-0000-4000-8000-000000000005', (now() at time zone 'utc')::date - 3, 10);
-- Book 5: 3 × 10 reads, three days ago → 30 × ½ = 15. Book 3: 10 views and a favourite today
-- → 12. Book 1: a view and a read today → 1 + 3 = 4 (its favourite was taken off). Book 2: a
-- favourite today → 2. Book 4: only views older than 7 days.
select is(pg_temp.ids(test_value(null, $$select public.books_popular()$$), 'trending'), array['5', '3', '1', '2'],
  'trending: reads weigh 3, weight halves every 3 days, older than 7 days left out');
select is(
  (select array_agg(right(x->>'id', 1) order by n) from jsonb_array_elements(test_value(null, $$select public.books_browse(p_sort => 'trending')$$)->'items') with ordinality t(x, n)),
  array['5', '3', '1', '2', '4', '6', '7', '8'], 'the "trending" order');

-- ---- drafts and deletions --------------------------------------------------------------------
update public.books set status = 'draft' where id = 'd0000000-0000-4000-8000-000000000001';
select is(pg_temp.ids(test_value(null, $$select public.books_popular()$$), 'top_rated'), array['2', '4'],
  'a book back to draft leaves the shelves');
select is(test_value(null, $$select count(*) from public.book_stats where book_id = 'd0000000-0000-4000-8000-000000000001'$$)::int, 0,
  'its numbers are hidden from visitors');
select lives_ok($$delete from public.books where id = 'd0000000-0000-4000-8000-000000000002'$$,
  'a book with ratings, favourites and events can be deleted');
select is((select count(*)::int from public.book_ratings where book_id = 'd0000000-0000-4000-8000-000000000002')
        + (select count(*)::int from public.book_favorites where book_id = 'd0000000-0000-4000-8000-000000000002')
        + (select count(*)::int from public.book_stats where book_id = 'd0000000-0000-4000-8000-000000000002'), 0,
  '... and everything about it goes with it');

-- ---- the admin's numbers ---------------------------------------------------------------------
select throws_ok(format($$select test_as(%L, $q$select public.books_analytics(7)$q$)$$, :one), '42501', null,
  'only admins read the numbers');
create temp table a as select test_value(:admin, $$select public.books_analytics(7)$$) as r;
select ok((select r ? 'now' and r ? 'before' and r ? 'trending' and r ? 'top_rated' and r ? 'stars' and r ? 'unopened' from a),
  'the admin''s numbers have every part');
select is((select (r->'now'->>'views')::int from a), 11, 'views in the last 7 days (the 8-day-old ones left out)');
select is((select (r->'stars'->>'1')::int from a), 3, 'stars are counted (published books only)');
select is((select r->'trending'->0->>'title' from a), 'Book 5', 'the trend list');
select is((select (r->>'unopened_count')::int from a), 5, 'published books nobody opened');

-- ---- release targets: 1000 books, 20,000 events ----------------------------------------------
insert into public.books (title, author, category_id, level, language, pages, status, rights_checked, created_at)
  select 'Volume ' || g, 'Author ' || (g % 50), 'c0000000-0000-4000-8000-000000000001',
         (array['A1','A2','B1','B2','C1','C2'])[1 + g % 6], 'en', 50 + g % 500, 'published', true,
         now() - interval '20 days' + g * interval '1 second'
  from generate_series(1, 1000) g;
insert into public.book_events (book_id, user_id, kind, day)
  select b.id, ('c1000000-0000-4000-8000-' || lpad(u::text, 12, '0'))::uuid,
         case when u % 4 = 0 then 'read' else 'view' end, (now() at time zone 'utc')::date - (u % 7)
  from (select id from public.books where title like 'Volume %') b, generate_series(1, 20) u;
select is((select count(*)::int from public.book_events), 20002, '20,000 events recorded');
analyze;

create temp table timing (call text, ms numeric);
grant all on timing to anon, authenticated;
do $$
declare t0 timestamptz; r jsonb; i int;
begin
  for i in 1..20 loop
    t0 := clock_timestamp();
    r := public.test_value(null, format($q$select public.books_browse(p_sort => 'trending', p_seed => %L)$q$, i));
    insert into timing values ('browse trending', extract(epoch from clock_timestamp() - t0) * 1000);
    t0 := clock_timestamp();
    r := public.test_value(null, format($q$select public.books_browse(p_query => 'volume', p_levels => '{B1,B2}', p_sort => 'rating', p_offset => %s)$q$, i * 24));
    insert into timing values ('search rating', extract(epoch from clock_timestamp() - t0) * 1000);
    t0 := clock_timestamp();
    r := public.test_value(null, format($q$select public.books_discover(%L)$q$, i));
    insert into timing values ('discover', extract(epoch from clock_timestamp() - t0) * 1000);
    t0 := clock_timestamp();
    r := public.test_value(null, $q$select public.books_popular()$q$);
    insert into timing values ('popular', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;
select cmp_ok((select percentile_cont(0.95) within group (order by ms) from timing where call = c)::numeric, '<', 250::numeric,
  '95% of ' || c || ' calls under 250 ms')
  from (values ('browse trending'), ('search rating'), ('discover'), ('popular')) v(c);
select diag(c || ': p95 ' || round((select percentile_cont(0.95) within group (order by ms) from timing where call = c)::numeric, 1) || ' ms')
  from (values ('browse trending'), ('search rating'), ('discover'), ('popular')) v(c);
select diag('discover answer: ' || octet_length(test_value(null, $$select public.books_discover('x')$$)::text) || ' bytes; a page of 24: '
  || octet_length(test_value(null, $$select public.books_browse()$$)::text) || ' bytes');
select is(jsonb_array_length(test_value(null, $$select public.books_browse()$$)->'items'), 24, 'a page shows 24 cards');
select cmp_ok(octet_length(test_value(null, $$select public.books_discover('x')$$)::text), '<', 150000,
  'the discover answer stays under 150 KB');
select cmp_ok(octet_length(test_value(null, $$select public.books_browse()$$)::text), '<', 150000,
  'a page of 24 stays under 150 KB');

select * from finish(true);
rollback;
