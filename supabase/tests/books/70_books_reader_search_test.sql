-- Library, the reader (phase 3): searching inside a book and bookmarks — who may do what, what a
-- search finds, and that bookmarks stay with their reader (pgTAP, on the real migrations).
\set ON_ERROR_STOP on
begin;
select no_plan();

insert into auth.users values
  ('a7000000-0000-4000-8000-000000000001'), ('b7000000-0000-4000-8000-000000000002'),
  ('c7000000-0000-4000-8000-000000000003');
insert into public.user_roles values ('a7000000-0000-4000-8000-000000000001', 'admin');
\set admin '''a7000000-0000-4000-8000-000000000001'''
\set one '''b7000000-0000-4000-8000-000000000002'''
\set two '''c7000000-0000-4000-8000-000000000003'''

insert into public.book_categories (id, name_ar, name_en, color, icon) values
  ('c7000000-0000-4000-8000-000000000009', 'كتب البحث', 'Search books', 'teal', 'book');
insert into public.books (id, title, author, category_id, level, language, status, rights_checked, file_path) values
  ('e7000000-0000-4000-8000-000000000001', 'Open', 'W', 'c7000000-0000-4000-8000-000000000009', 'B1', 'en', 'published', true, 'g1/book.pdf'),
  ('e7000000-0000-4000-8000-000000000002', 'Draft', 'W', null, 'B1', 'en', 'draft', false, 'g2/book.pdf');
\set open '''e7000000-0000-4000-8000-000000000001'''
\set draft '''e7000000-0000-4000-8000-000000000002'''
insert into public.book_pages (book_id, page, width, height, image_path, text, runs) values
  (:open, 1, 1400, 1812, 'e7/1.webp', 'It was a bright cold day in April.', '[]'),
  (:open, 2, 1400, 1812, 'e7/2.webp', 'The Hound of the Baskervilles came at night.', '[]'),
  (:open, 3, 1400, 1812, 'e7/3.webp', 'الكلب الكبير كان يصطاد في الليل، والقرية نايمة.', '[]'),
  (:open, 4, 1400, 1812, 'e7/4.webp', '', '[]'),
  (:draft, 1, 1400, 1812, 'e8/1.webp', 'A hound in a draft.', '[]');

-- ---- structure -------------------------------------------------------------------------------
select has_column('public', 'book_pages', 'fts', 'book_pages.fts');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'book_pages_fts'), 'search index');
select has_function('public', 'books_search_pages', array['uuid', 'text'], 'books_search_pages');
select has_table('public', 'book_bookmarks', 'bookmarks table');
select ok((select relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = 'book_bookmarks'),
  'row level security on bookmarks');
select ok(not has_function_privilege('anon', 'public.books_search_pages(uuid, text)', 'execute'), 'visitors cannot search');

-- ---- searching --------------------------------------------------------------------------------
select is(test_value(:one, $$select to_jsonb(array_agg(page)) from public.books_search_pages('e7000000-0000-4000-8000-000000000001', 'hound')$$),
  '[2]'::jsonb, 'a reader finds the page a word is on (case aside)');
select is(test_value(:one, $$select to_jsonb(snippet) from public.books_search_pages('e7000000-0000-4000-8000-000000000001', 'baskervilles')$$),
  '"The Hound of the ⟦Baskervilles⟧ came at night"'::jsonb, 'the line around it, the match marked');
select is(test_value(:one, $$select to_jsonb(array_agg(page)) from public.books_search_pages('e7000000-0000-4000-8000-000000000001', 'الكلب')$$),
  '[3]'::jsonb, 'Arabic words are found too');
select is(test_value(:one, $$select to_jsonb(array_agg(page)) from public.books_search_pages('e7000000-0000-4000-8000-000000000001', '"cold day"')$$),
  '[1]'::jsonb, 'a quoted phrase');
select is(test_value(:one, $$select to_jsonb(count(*)) from public.books_search_pages('e7000000-0000-4000-8000-000000000001', '   ')$$)::int,
  0, 'an empty search finds nothing (and does not fail)');
select is(test_value(:one, $$select to_jsonb(count(*)) from public.books_search_pages('e7000000-0000-4000-8000-000000000002', 'hound')$$)::int,
  0, 'a reader cannot search a draft');
select is(test_value(:admin, $$select to_jsonb(count(*)) from public.books_search_pages('e7000000-0000-4000-8000-000000000002', 'hound')$$)::int,
  1, 'the admin can');
select throws_ok(format($$select test_as(null, %L)$$, $q$select * from public.books_search_pages('e7000000-0000-4000-8000-000000000001', 'hound')$q$),
  '42501', null, 'a visitor cannot search');
update public.book_pages set text = 'A different hound now.' where book_id = :open and page = 1;
select is(test_value(:one, $$select to_jsonb(array_agg(page order by page)) from public.books_search_pages('e7000000-0000-4000-8000-000000000001', 'hound')$$),
  '[1, 2]'::jsonb, 'changed words are searched at once');

-- ---- bookmarks --------------------------------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$insert into public.book_bookmarks (book_id, page) values ('e7000000-0000-4000-8000-000000000001', 2), ('e7000000-0000-4000-8000-000000000001', 3)$q$)$$, :one),
  'a reader marks pages');
select throws_ok(format($$select test_as(%L, $q$insert into public.book_bookmarks (book_id, page) values ('e7000000-0000-4000-8000-000000000002', 1)$q$)$$, :one),
  '42501', null, 'not in a draft');
select throws_ok(format($$select test_as(%L, $q$insert into public.book_bookmarks (user_id, book_id, page) values ('c7000000-0000-4000-8000-000000000003', 'e7000000-0000-4000-8000-000000000001', 1)$q$)$$, :one),
  '42501', null, 'not for someone else');
select throws_ok(format($$select test_as(%L, $q$insert into public.book_bookmarks (book_id, page) values ('e7000000-0000-4000-8000-000000000001', 2)$q$)$$, :one),
  '23505', null, 'the same page once');
select throws_ok(format($$select test_as(%L, $q$insert into public.book_bookmarks (book_id, page) values ('e7000000-0000-4000-8000-000000000001', 0)$q$)$$, :one),
  '23514', null, 'a real page number');
select is(test_value(:one, $$select to_jsonb(array_agg(page order by page)) from public.book_bookmarks$$),
  '[2, 3]'::jsonb, 'a reader reads their bookmarks');
select is(test_value(:two, $$select to_jsonb(count(*)) from public.book_bookmarks$$)::int, 0, 'another reader sees none of them');
select is(test_value(:admin, $$select to_jsonb(count(*)) from public.book_bookmarks$$)::int, 0, 'nor does the admin');
select is(test_value(null, $$select to_jsonb(count(*)) from public.book_bookmarks$$)::int, 0, 'nor a visitor');
select is(test_value(:two, $$with d as (delete from public.book_bookmarks returning 1) select to_jsonb(count(*)) from d$$)::int,
  0, 'another reader cannot remove them');
select is(test_value(:one, $$with d as (delete from public.book_bookmarks where page = 3 returning 1) select to_jsonb(count(*)) from d$$)::int,
  1, 'a reader removes their own');
delete from public.books where id = :open;
select is((select count(*)::int from public.book_bookmarks), 0, 'bookmarks go with the book');

select * from finish(true);
rollback;
