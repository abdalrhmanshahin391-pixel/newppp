-- Library, the reader: prepared pages, their pictures, each reader's place, and the circle's
-- limits on books — on the real migrations (pgTAP).
\set ON_ERROR_STOP on
begin;
select no_plan();

insert into auth.users values
  ('a5000000-0000-4000-8000-000000000001'), ('b5000000-0000-4000-8000-000000000002'),
  ('b5000000-0000-4000-8000-000000000003');
insert into public.user_roles values ('a5000000-0000-4000-8000-000000000001', 'admin');
\set admin '''a5000000-0000-4000-8000-000000000001'''
\set one '''b5000000-0000-4000-8000-000000000002'''
\set two '''b5000000-0000-4000-8000-000000000003'''

insert into public.book_categories (id, name_ar, name_en, color, icon) values
  ('c5000000-0000-4000-8000-000000000001', 'روايات القارئ', 'Reader novels', 'rose', 'heart');
insert into public.books (id, title, author, category_id, level, language, status, rights_checked, file_path) values
  ('e5000000-0000-4000-8000-000000000001', 'Open book', 'Writer', 'c5000000-0000-4000-8000-000000000001', 'B1', 'en', 'published', true, 'e1/book.pdf'),
  ('e5000000-0000-4000-8000-000000000002', 'Draft book', 'Writer', null, 'B1', 'en', 'draft', false, 'e2/book.pdf');
\set open '''e5000000-0000-4000-8000-000000000001'''
\set draft '''e5000000-0000-4000-8000-000000000002'''

-- ---- structure -------------------------------------------------------------------------------
select has_table('public', 'book_pages', 'pages table');
select has_table('public', 'book_reading_progress', 'reading place table');
select has_table('public', 'book_study_requests', 'circle requests table');
select has_column('public', 'books', 'page_count', 'books.page_count');
select has_column('public', 'books', 'prepared_at', 'books.prepared_at');
select ok((select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace
  and relname in ('book_pages', 'book_reading_progress', 'book_study_requests')), 'row level security on all three');
select is((select public from storage.buckets where id = 'book-pages'), false, 'the pictures bucket is private');
select is((select allowed_mime_types from storage.buckets where id = 'book-pages'), array['image/webp', 'image/jpeg'],
  'pictures only (WebP or JPEG)');
select is((select file_size_limit from storage.buckets where id = 'book-pages'), 5242880::bigint, 'a page picture is at most 5 MB');

-- ---- the admin prepares pages ----------------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  insert into public.book_pages (book_id, page, width, height, image_path, text, runs) values
    ('e5000000-0000-4000-8000-000000000001', 1, 1400, 1980, 'e5000000-0000-4000-8000-000000000001/1.webp', 'It was a dark night.',
     '[["It was a dark night.", 0.1, 0.1, 0.5, 0.02]]'),
    ('e5000000-0000-4000-8000-000000000001', 2, 1400, 1980, 'e5000000-0000-4000-8000-000000000001/2.webp', '', '[]'),
    ('e5000000-0000-4000-8000-000000000002', 1, 1400, 1980, 'e5000000-0000-4000-8000-000000000002/1.webp', 'Secret', '[]');
  update public.books set page_count = 2, prepared_at = now() where id = 'e5000000-0000-4000-8000-000000000001'
$q$)$$, :admin), 'the admin writes pages and marks the book prepared');
select is((select has_text from public.book_pages where book_id = :open and page = 2), false, 'a page without words is marked');
select is((select has_text from public.book_pages where book_id = :open and page = 1), true, 'a page with words is marked');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_pages (book_id, page, width, height, image_path) values
    ('e5000000-0000-4000-8000-000000000001', 3, 1400, 1980, 'x/3.webp')
$q$)$$, :one), '42501', null, 'a reader cannot add pages');
select throws_ok($$insert into public.book_pages (book_id, page, width, height, image_path, runs)
  values ('e5000000-0000-4000-8000-000000000001', 9, 100, 100, 'e/9.webp', '{}')$$, '23514', null, 'runs must be a list');

-- ---- who reads pages -------------------------------------------------------------------------
select is(test_value(:one, $$select to_jsonb(count(*)) from public.book_pages$$)::int, 2,
  'a reader sees the pages of the published book only');
select is(test_value(null, $$select to_jsonb(count(*)) from public.book_pages$$)::int, 0, 'a visitor reads no pages');
select is(test_value(:admin, $$select to_jsonb(count(*)) from public.book_pages$$)::int, 3, 'the admin sees every page');

insert into storage.objects (bucket_id, name) values
  ('book-pages', 'e5000000-0000-4000-8000-000000000001/1.webp'),
  ('book-pages', 'e5000000-0000-4000-8000-000000000002/1.webp'),
  ('book-pages', 'not-a-book/1.webp');
select is(test_value(:one, $$select to_jsonb(array_agg(name)) from storage.objects where bucket_id = 'book-pages'$$),
  '["e5000000-0000-4000-8000-000000000001/1.webp"]'::jsonb, 'a reader opens the pictures of a published book only');
select is(test_value(:admin, $$select to_jsonb(count(*)) from storage.objects where bucket_id = 'book-pages'$$)::int, 3,
  'the admin opens every picture');

-- ---- a new PDF clears the old pages ----------------------------------------------------------
update public.books set file_path = 'e2/new.pdf', page_count = 1, prepared_at = now() where id = :draft;
select is((select count(*)::int from public.book_pages where book_id = :draft), 0, 'replacing the PDF removes its pages');
select is((select prepared_at from public.books where id = :draft), null, '... and the book waits to be prepared again');
update public.books set title = 'Open book' where id = :open;
select is((select count(*)::int from public.book_pages where book_id = :open), 2, 'other changes keep the pages');
select isnt((select prepared_at from public.books where id = :open), null, '... and keep it prepared');

-- ---- each reader's place ---------------------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  insert into public.book_reading_progress (book_id, page) values ('e5000000-0000-4000-8000-000000000001', 2)
    on conflict (user_id, book_id) do update set page = excluded.page, updated_at = now()
$q$)$$, :one), 'a reader keeps their place');
select lives_ok(format($$select test_as(%L, $q$
  insert into public.book_reading_progress (book_id, page) values ('e5000000-0000-4000-8000-000000000001', 1)
    on conflict (user_id, book_id) do update set page = excluded.page, updated_at = now()
$q$)$$, :one), '... and moves it');
select is((select page from public.book_reading_progress where user_id = :one and book_id = :open), 1, 'one row, the latest page');
select is(test_value(:two, $$select to_jsonb(count(*)) from public.book_reading_progress$$)::int, 0,
  'another reader does not see it');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_reading_progress (book_id, page) values ('e5000000-0000-4000-8000-000000000002', 1)
$q$)$$, :one), '42501', null, 'no place in a book that is not published');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_reading_progress (user_id, book_id, page)
    values ('b5000000-0000-4000-8000-000000000003', 'e5000000-0000-4000-8000-000000000001', 1)
$q$)$$, :one), '42501', null, 'no place written for someone else');

-- ---- the circle's limits ---------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.books_take_study_quota(uuid, uuid, integer, text, text, integer)', 'execute'),
  'visitors cannot ask the circle');
select is(test_value(:one, $$select public.books_take_study_quota(gen_random_uuid(), 'e5000000-0000-4000-8000-000000000001', 1, 'explain', 'explain', 10)$$)->>'ok',
  'true', 'a reader asks about a published book');
select is(test_value(:one, $$select public.books_take_study_quota(gen_random_uuid(), 'e5000000-0000-4000-8000-000000000002', 1, 'explain', 'explain', 10)$$)->>'code',
  'not_found', 'not about a draft');
select is(test_value(:one, $$select public.books_take_study_quota(gen_random_uuid(), 'e5000000-0000-4000-8000-000000000001', 1, 'explain', 'report', 10)$$)->>'code',
  'bad_request', 'an unknown group is refused');
select is(test_value(:one, $$select public.books_take_study_quota('f5000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)$$)->>'ok',
  'true', 'practice 1');
select is(test_value(:one, $$select public.books_take_study_quota('f5000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)$$)->>'ok',
  'true', 'the same request twice counts once');
select is((select count(*)::int from public.book_study_requests where quota_group = 'practice'), 1, '... one row');
select is(test_value(:one, $$select public.books_take_study_quota(gen_random_uuid(), 'e5000000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)
  || public.books_take_study_quota(gen_random_uuid(), 'e5000000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)
  || public.books_take_study_quota(gen_random_uuid(), 'e5000000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)$$)->>'ok',
  'true', 'practice 2–4');
select is(test_value(:one, $$select public.books_take_study_quota(gen_random_uuid(), 'e5000000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)$$)->>'scope',
  'minute', 'the fifth in a minute waits');
select is(test_value(:admin, $$select public.books_take_study_quota(gen_random_uuid(), 'e5000000-0000-4000-8000-000000000002', 1, 'make_mcq', 'practice', 10)$$)->>'ok',
  'true', 'the admin is never limited, drafts included');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_study_requests (request_id, user_id, book_id, page, action, quota_group)
    values (gen_random_uuid(), 'b5000000-0000-4000-8000-000000000002', 'e5000000-0000-4000-8000-000000000001', 1, 'x', 'explain')
$q$)$$, :one), '42501', null, 'requests are written only through the limit check');
select is(test_value(:two, $$select to_jsonb(count(*)) from public.book_study_requests$$)::int, 0,
  'a reader sees only their own requests');

-- ---- deleting a book removes everything of it ------------------------------------------------
delete from public.books where id = :open;
select is((select count(*)::int from public.book_pages where book_id = :open), 0, 'pages go with the book');
select is((select count(*)::int from public.book_reading_progress where book_id = :open), 0, 'places go with the book');

select * from finish(true);
rollback;
