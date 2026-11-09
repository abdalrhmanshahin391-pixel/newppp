-- Library phase 2 (discovery): search, filters, facets, pages, seeded order, editorial rules,
-- the discover call, and speed on 1000 books — on the real migrations (pgTAP).
\set ON_ERROR_STOP on
begin;
select no_plan();

insert into auth.users values
  ('a0000000-0000-4000-8000-000000000001'), ('b0000000-0000-4000-8000-000000000002');
insert into public.user_roles values ('a0000000-0000-4000-8000-000000000001', 'admin');
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set learner '''b0000000-0000-4000-8000-000000000002'''

-- ---- data (written directly; the rules for writing were tested in phase 1) -------------------
insert into public.book_categories (id, name_ar, name_en, color, icon, sort) values
  ('c0000000-0000-4000-8000-000000000001', 'روايات', 'Novels', 'rose', 'heart', 0),
  ('c0000000-0000-4000-8000-000000000002', 'علوم', 'Science', 'teal', 'flask', 1),
  ('c0000000-0000-4000-8000-000000000003', 'تاريخ', 'History', 'amber', 'landmark', 2);

insert into public.books (id, title, author, description, category_id, level, language, pages, isbn,
                          status, rights_checked, created_at) values
  ('d0000000-0000-4000-8000-000000000001', 'Pride and Prejudice', 'Jane Austen', 'A novel of manners.',
   'c0000000-0000-4000-8000-000000000001', 'B1', 'en', 351, '9780141439518', 'published', true, now() - interval '10 days'),
  ('d0000000-0000-4000-8000-000000000002', 'Emma', 'Jane Austen', '',
   'c0000000-0000-4000-8000-000000000001', 'B2', 'en', 120, null, 'published', true, now() - interval '9 days'),
  ('d0000000-0000-4000-8000-000000000003', 'The Hound of the Baskervilles', 'Arthur Conan Doyle', '',
   'c0000000-0000-4000-8000-000000000001', 'B1', 'en', 207, null, 'published', true, now() - interval '8 days'),
  ('d0000000-0000-4000-8000-000000000004', 'On the Origin of Species', 'Charles Darwin', 'Not a story of pride at all.',
   'c0000000-0000-4000-8000-000000000002', 'C1', 'en', 502, null, 'published', true, now() - interval '7 days'),
  ('d0000000-0000-4000-8000-000000000005', 'مكتبة المدينة', 'أحمد خالد', '',
   'c0000000-0000-4000-8000-000000000003', 'B1', 'ar', null, null, 'published', true, now() - interval '6 days'),
  ('d0000000-0000-4000-8000-000000000006', 'Die Verwandlung', 'Franz Kafka', '',
   'c0000000-0000-4000-8000-000000000002', 'B2', 'de', 90, null, 'published', true, now() - interval '5 days'),
  ('d0000000-0000-4000-8000-000000000007', 'Secret Draft', 'Nobody', '',
   'c0000000-0000-4000-8000-000000000001', 'B1', 'en', 100, null, 'draft', false, now() - interval '4 days'),
  ('d0000000-0000-4000-8000-000000000008', 'Austen Letters', 'Various', '',
   'c0000000-0000-4000-8000-000000000003', 'C1', 'en', 400, null, 'published', true, now() - interval '3 days');
insert into public.book_secondary_categories (book_id, category_id) values
  ('d0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001');
insert into public.book_tags (id, name_ar, name_en) values
  ('e0000000-0000-4000-8000-000000000001', 'كلاسيكي', 'Classic');
insert into public.book_tag_links (book_id, tag_id) values
  ('d0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001');

-- A visitor's browse call, returning the result.
create function pg_temp.browse(p_user uuid, p_args text) returns jsonb language sql as $$
  select public.test_value(p_user, 'select public.books_browse(' || p_args || ')')
$$;
create function pg_temp.titles(r jsonb) returns text[] language sql as $$
  select coalesce(array_agg(x->>'title' order by n), '{}') from jsonb_array_elements(r->'items') with ordinality as t(x, n)
$$;

-- ---- structure -------------------------------------------------------------------------------
select has_function('public', 'books_browse', 'books_browse exists');
select has_function('public', 'books_discover', 'books_discover exists');
select has_table('public', 'book_editorial', 'editorial rules table');
select has_index('public', 'books', 'books_search_doc', 'full-text index');
select has_index('public', 'books', 'books_search_name_trgm', 'typo (trigram) index');
select ok((select search_doc is not null from public.books where id = 'd0000000-0000-4000-8000-000000000001'),
  'every book gets a search copy');

-- ---- search ----------------------------------------------------------------------------------
select is(pg_temp.titles(pg_temp.browse(null, $$p_query => 'pride'$$)),
  array['Pride and Prejudice', 'On the Origin of Species'], 'a title match ranks above a description match');
select is((pg_temp.titles(pg_temp.browse(null, $$p_query => 'austen'$$)))[1], 'Austen Letters',
  'the title weighs more than the author');
select is((pg_temp.browse(null, $$p_query => 'aust prid'$$)->>'total')::int, 1,
  'every word must match, as the start of a word');
select is((pg_temp.titles(pg_temp.browse(null, $$p_query => 'baskervile'$$)))[1], 'The Hound of the Baskervilles',
  'a word with a typo still finds the book');
select is(pg_temp.titles(pg_temp.browse(null, $$p_query => 'احمد'$$)), array['مكتبة المدينة'],
  'the hamza on alef is ignored');
select is(pg_temp.titles(pg_temp.browse(null, $$p_query => 'مكتبة'$$)), array['مكتبة المدينة'],
  'a word with taa marbuta is found as written');
select is(pg_temp.titles(pg_temp.browse(null, $$p_query => '978-0-14-143951-8'$$)), array['Pride and Prejudice'],
  'a full ISBN finds its book');
select is(pg_temp.titles(pg_temp.browse(null, $$p_query => 'Classic', p_sort => 'title'$$)),
  array['Pride and Prejudice', 'مكتبة المدينة'], 'tags are searched');
select is((pg_temp.browse(null, $$p_query => '%_:*&|!()'''$$)->>'total')::int, 7,
  'a query of only symbols is an empty query (no error)');
select is((pg_temp.browse(null, $$p_query => 'secret'$$)->>'total')::int, 0, 'drafts are never found by a visitor');
select is((pg_temp.browse(:admin, $$p_query => 'secret'$$)->>'total')::int, 0, '... nor in an admin''s reader view');
select is((pg_temp.browse(:learner, $$$$)->>'total')::int, 7, 'a learner sees every published book');

-- ---- filters and facets ----------------------------------------------------------------------
select is((pg_temp.browse(null, $$p_levels => '{B1,B2}'$$)->>'total')::int, 5, 'OR inside a group');
select is(pg_temp.titles(pg_temp.browse(null, $$p_levels => '{B1}', p_categories => '{c0000000-0000-4000-8000-000000000001}', p_sort => 'title'$$)),
  array['Pride and Prejudice', 'The Hound of the Baskervilles'], 'AND between groups');
select is((pg_temp.browse(null, $$p_categories => '{c0000000-0000-4000-8000-000000000001}'$$)->>'total')::int, 4,
  'a category includes books that have it as a secondary category');
select is((pg_temp.browse(null, $$p_lengths => '{short}'$$)->>'total')::int, 2, 'length bands (short)');
select is((pg_temp.browse(null, $$p_lengths => '{medium}', p_languages => '{ar}'$$)->>'total')::int, 1,
  'a book without a page count is medium');
select is((pg_temp.browse(null, $$p_tags => '{e0000000-0000-4000-8000-000000000001}'$$)->>'total')::int, 2, 'tag filter');
select is(pg_temp.browse(null, $$p_levels => '{B1}'$$)->'facets'->'level',
  '{"B1": 3, "B2": 2, "C1": 2}'::jsonb, 'a group''s counts ignore its own choice');
select is(pg_temp.browse(null, $$p_levels => '{B1}'$$)->'facets'->'category',
  '{"c0000000-0000-4000-8000-000000000001": 2, "c0000000-0000-4000-8000-000000000003": 1}'::jsonb,
  'other groups'' counts follow the choice');
select is(pg_temp.browse(null, $$$$)->'facets'->'language', '{"ar": 1, "de": 1, "en": 5}'::jsonb, 'language counts');

-- ---- pages and the snapshot ------------------------------------------------------------------
insert into public.books (title, author, category_id, level, language, pages, status, rights_checked, created_at)
  select 'Generated ' || lpad(g::text, 3, '0'), 'Writer', 'c0000000-0000-4000-8000-000000000002', 'A2', 'en', 100 + g,
         'published', true, now() - interval '20 days' + g * interval '1 minute'
  from generate_series(1, 40) as g;

select is(jsonb_array_length(pg_temp.browse(null, $$p_limit => 24$$)->'items'), 24, 'a page of 24');
select is(jsonb_array_length(pg_temp.browse(null, $$p_limit => 48$$)->'items'), 47, 'a page of 48 (47 books in all)');
select is((pg_temp.browse(null, $$p_limit => 100$$)->>'limit')::int, 24, 'any other size is 24');
select is(
  (select count(*)::int from (
    select jsonb_array_elements(pg_temp.browse(null, $$p_limit => 24, p_offset => 0$$)->'items')->>'id'
    intersect
    select jsonb_array_elements(pg_temp.browse(null, $$p_limit => 24, p_offset => 24$$)->'items')->>'id') x),
  0, 'pages do not overlap');
select is(jsonb_array_length(pg_temp.browse(null, $$p_offset => 500$$)->'items'), 0, 'a page past the end is empty');

create temp table snap as select (now() - interval '1 hour') as at;
grant select on snap to anon, authenticated;
insert into public.books (title, author, category_id, level, language, status, rights_checked, created_at)
  values ('Brand New', 'Late', 'c0000000-0000-4000-8000-000000000002', 'A2', 'en', 'published', true, now());
select is((pg_temp.browse(null, format('p_as_of => %L', (select at from snap)))->>'total')::int, 47,
  'a book added after the snapshot does not shift the pages');
select is((pg_temp.browse(null, $$$$)->>'total')::int, 48, 'a new browse sees it');
select ok((pg_temp.browse(null, format('p_as_of => %L', now() + interval '30 days'))->>'as_of')::timestamptz <= now(),
  'a visitor cannot read the future');

-- ---- the seeded order ------------------------------------------------------------------------
select is(pg_temp.titles(pg_temp.browse(null, $$p_sort => 'discover', p_seed => 'a'$$)),
  pg_temp.titles(pg_temp.browse(null, $$p_sort => 'discover', p_seed => 'a'$$)), 'the same seed gives the same order');
select isnt(pg_temp.titles(pg_temp.browse(null, $$p_sort => 'discover', p_seed => 'a'$$)),
  pg_temp.titles(pg_temp.browse(null, $$p_sort => 'discover', p_seed => 'b'$$)), 'another seed gives other picks');

-- ---- editorial rules -------------------------------------------------------------------------
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_editorial (book_id, context, kind) values ('d0000000-0000-4000-8000-000000000003', 'discover', 'pin')
$q$)$$, :learner), '42501', null, 'a learner cannot pin a book');
select lives_ok(format($$select test_as(%L, $q$
  insert into public.book_editorial (book_id, context, kind, position) values
    ('d0000000-0000-4000-8000-000000000003', 'discover', 'pin', 0),
    ('d0000000-0000-4000-8000-000000000002', 'discover', 'pin', 1),
    ('d0000000-0000-4000-8000-000000000001', 'discover', 'exclude', 0),
    ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'pin', 0);
  insert into public.book_editorial (book_id, context, kind, position, starts_at) values
    ('d0000000-0000-4000-8000-000000000006', 'discover', 'pin', -1, now() + interval '7 days')
$q$)$$, :admin), 'admin pins and excludes books');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_editorial (book_id, context, kind) values ('d0000000-0000-4000-8000-000000000003', 'discover', 'exclude')
$q$)$$, :admin), '23505', null, 'one rule per book and place');

select is((pg_temp.titles(pg_temp.browse(null, $$p_context => 'discover', p_seed => 'x'$$)))[1:2],
  array['The Hound of the Baskervilles', 'Emma'], 'pinned books come first, in their order');
select ok(not ('Pride and Prejudice' = any (pg_temp.titles(pg_temp.browse(null, $$p_context => 'discover', p_limit => 48$$)))),
  'an excluded book is hidden where it is excluded ...');
select is((pg_temp.browse(null, $$p_query => 'pride and prejudice'$$)->>'total')::int, 1, '... and found everywhere else');
select is((pg_temp.titles(pg_temp.browse(null, $$p_context => 'c0000000-0000-4000-8000-000000000002', p_categories => '{c0000000-0000-4000-8000-000000000002}'$$)))[1],
  'On the Origin of Species', 'a pin inside a category');
select is((pg_temp.titles(pg_temp.browse(null, $$p_context => 'discover', p_seed => 'x'$$)))[1],
  'The Hound of the Baskervilles', 'a pin whose period has not started does not count for a visitor');
select is((pg_temp.titles(pg_temp.browse(:admin, format('p_context => %L, p_seed => %L, p_as_of => %L', 'discover', 'x', now() + interval '8 days'))))[1],
  'Die Verwandlung', 'an admin previews the pin on its date');
select is(test_value(null, 'select count(*) from public.book_editorial')::int, 4,
  'visitors only see rules in force');

-- ---- the discover call -----------------------------------------------------------------------
create temp table d as select test_value(null, $$select public.books_discover('x', null, 12)$$) as r;
select is((select r->'picks'->>0 from d), 'd0000000-0000-4000-8000-000000000003', 'discover picks start with the pins');
select ok((select not (r->'picks' ? 'd0000000-0000-4000-8000-000000000001') and not (r->'newest' ? 'd0000000-0000-4000-8000-000000000001') from d),
  'an excluded book is off the discover page');
select is((select jsonb_array_length(r->'picks') from d), 12, 'discover rows are capped');
select is((select r->'newest'->>0 from d), (select id::text from public.books where title = 'Brand New'), 'newest first');
select is((select r->'categories'->0->>'id' from d), 'c0000000-0000-4000-8000-000000000001', 'category shelves in the admin order');
select is((select (r->'categories'->1->>'total')::int from d), 43, 'a category shelf knows how many books it has');
select ok((select not (r->'books' ? 'd0000000-0000-4000-8000-000000000007') from d), 'no draft is sent');
select ok((select bool_and(r->'books' ? x) from d, jsonb_array_elements_text((select r->'picks' from d)) x),
  'every listed book is sent once');
update public.books set featured = true where id = 'd0000000-0000-4000-8000-000000000003';
select is(test_value(null, $$select public.books_discover('x')->'featured_id'$$) #>> '{}',
  'd0000000-0000-4000-8000-000000000003', 'the book of the week');

-- ---- the search copy follows tags and deletions ---------------------------------------------
update public.book_tags set name_ar = 'نادر', name_en = 'Rare' where id = 'e0000000-0000-4000-8000-000000000001';
select is((pg_temp.browse(null, $$p_query => 'نادر'$$)->>'total')::int, 2, 'renaming a tag refreshes the books');
delete from public.book_tag_links where book_id = 'd0000000-0000-4000-8000-000000000001';
select is((pg_temp.browse(null, $$p_query => 'rare'$$)->>'total')::int, 1, 'taking a tag off refreshes the book');
select lives_ok($$delete from public.books where id = 'd0000000-0000-4000-8000-000000000005'$$, 'a tagged book can be deleted');
select lives_ok(format($$select test_as(%L, $q$
  select public.books_delete_category('c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003')
$q$)$$, :admin), 'deleting a category ...');
select is((select count(*)::int from public.book_editorial where context = 'c0000000-0000-4000-8000-000000000002'), 0,
  '... removes its rules');

-- ---- 1000 books ------------------------------------------------------------------------------
insert into public.books (title, author, description, category_id, level, language, pages, status, rights_checked, created_at)
  select 'Volume ' || g || ' ' || (array['river', 'mountain', 'garden', 'letters'])[1 + g % 4], 'Author ' || (g % 50),
         'A long description of a book number ' || g, 'c0000000-0000-4000-8000-000000000003',
         (array['A1','A2','B1','B2','C1','C2'])[1 + g % 6], 'en', 50 + g % 500, 'published', true,
         now() - interval '30 days' + g * interval '1 second'
  from generate_series(1, 1000) as g;
analyze public.books;
create temp table timing (ms numeric);
grant all on timing to anon, authenticated;
do $$
declare t0 timestamptz := clock_timestamp(); r jsonb;
begin
  r := public.test_value(null, $q$select public.books_browse(p_query => 'garden', p_levels => '{B1,B2}', p_limit => 24)$q$);
  r := public.test_value(null, $q$select public.books_browse(p_sort => 'discover', p_seed => 's', p_context => 'discover')$q$);
  r := public.test_value(null, $q$select public.books_discover('s')$q$);
  insert into timing values (extract(epoch from clock_timestamp() - t0) * 1000);
end $$;
select cmp_ok((select ms from timing), '<', 1500::numeric, 'search, a seeded page and discover on 1000+ books stay fast');
select is((pg_temp.browse(null, $$p_query => 'garden'$$)->>'total')::int, 250, 'search on 1000+ books is exact');

select * from finish(true);
rollback;
