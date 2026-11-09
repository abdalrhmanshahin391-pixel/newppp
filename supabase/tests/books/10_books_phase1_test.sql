-- Library phase 1: the acceptance gate, on the real migrations (pgTAP).
-- Users: an admin, a learner, and a visitor (anon, null below). Every write a learner or a
-- visitor tries is made the way the API would make it, and must be refused.
\set ON_ERROR_STOP on
begin;
select no_plan();

insert into auth.users values
  ('a0000000-0000-4000-8000-000000000001'), ('b0000000-0000-4000-8000-000000000002');
insert into public.user_roles values ('a0000000-0000-4000-8000-000000000001', 'admin');

-- shorthand ids
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set learner '''b0000000-0000-4000-8000-000000000002'''

-- ---- structure -------------------------------------------------------------------------------
select has_column('public', 'books', 'status', 'books.status exists');
select has_table('public', 'book_tags', 'tags table');
select has_table('public', 'book_shelves', 'shelves table');
select has_table('public', 'book_imports', 'imports table');
select has_index('public', 'books', 'books_one_featured', 'one book of the week (unique index)');
select has_index('public', 'books', 'books_isbn_unique', 'one book per ISBN');

-- ---- admin: categories, drafts, readiness, publishing ---------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  insert into public.book_categories (id, name_ar, name_en, color, icon) values
    ('c0000000-0000-4000-8000-000000000001', 'روايات', 'Novels', 'rose', 'heart'),
    ('c0000000-0000-4000-8000-000000000002', 'علوم', 'Science', 'teal', 'flask')
$q$)$$, :admin), 'admin adds categories');

select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_categories (name_ar, name_en) values ('  روايات ', 'Other')
$q$)$$, :admin), '23505', null, 'a category name cannot repeat (case and spaces ignored)');

select lives_ok(format($$select test_as(%L, $q$
  insert into public.books (id, title, author, category_id, file_path) values
    ('d0000000-0000-4000-8000-000000000001', 'Pride and Prejudice', 'Jane Austen',
     'c0000000-0000-4000-8000-000000000001', 'x/pride.pdf'),
    ('d0000000-0000-4000-8000-000000000002', 'Draft Book', '', null, 'x/draft.pdf')
$q$)$$, :admin), 'admin creates drafts');

select is((select status from public.books where id = 'd0000000-0000-4000-8000-000000000001'),
  'draft', 'a new book starts as a draft');

select throws_like(format($$select test_as(%L, $q$
  update public.books set status = 'published' where id = 'd0000000-0000-4000-8000-000000000001'
$q$)$$, :admin), 'book_not_ready:rights%', 'publishing needs the rights check');

select throws_like(format($$select test_as(%L, $q$
  insert into public.books (title, published) values ('Old page insert', true)
$q$)$$, :admin), 'book_not_ready:category,rights%', 'the old published flag cannot skip the checks');

select lives_ok(format($$select test_as(%L, $q$
  update public.books set rights_checked = true, status = 'published'
  where id = 'd0000000-0000-4000-8000-000000000001'
$q$)$$, :admin), 'admin publishes a ready book (no ISBN, no year)');

select is((select published from public.books where id = 'd0000000-0000-4000-8000-000000000001'),
  true, 'status and the published flag stay in step');

select throws_ok(format($$select test_as(%L, $q$
  update public.books set isbn = '978-12345' where id = 'd0000000-0000-4000-8000-000000000002'
$q$)$$, :admin), '23514', null, 'an ISBN must have a valid shape');

select lives_ok(format($$select test_as(%L, $q$
  update public.books set isbn = '978-0-14-143951-8' where id = 'd0000000-0000-4000-8000-000000000001'
$q$)$$, :admin), 'an ISBN with dashes is saved');
select is((select isbn from public.books where id = 'd0000000-0000-4000-8000-000000000001'),
  '9780141439518', 'the ISBN is kept as digits only');

-- ---- learner and visitor: read published only, never write ----------------------------------
select is(test_value(:learner, 'select count(*) from public.books')::int, 1,
  'a learner sees published books only');
select is(test_value(null, 'select count(*) from public.books')::int, 1,
  'a visitor sees published books only');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.books (title) values ('x')
$q$)$$, :learner), '42501', null, 'a learner cannot add a book');
select lives_ok(format($$select test_as(%L, $q$
  update public.books set title = 'hacked'
$q$)$$, :learner), 'a learner update runs ...');
select is((select title from public.books where id = 'd0000000-0000-4000-8000-000000000001'),
  'Pride and Prejudice', '... but changes nothing');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_tags (name_ar, name_en) values ('x', 'x')
$q$)$$, :learner), '42501', null, 'a learner cannot add a tag');
select throws_ok(format($$select test_as(%L, $q$
  select public.books_set_featured('d0000000-0000-4000-8000-000000000001')
$q$)$$, :learner), '42501', null, 'a learner cannot change the book of the week');
select throws_ok(format($$select test_as(%L, $q$
  select public.books_import(gen_random_uuid(), '[]'::jsonb, 'skip', false)
$q$)$$, :learner), '42501', null, 'a learner cannot import');
select throws_ok($$select test_as(null, $q$
  select public.books_bulk_update(array['d0000000-0000-4000-8000-000000000001'::uuid], 'draft')
$q$)$$, '42501', null, 'a visitor cannot call the admin functions');
select is(test_value(:learner, 'select count(*) from public.book_imports')::int, 0,
  'a learner sees no import records');

-- files: a learner may open the PDF of a published book only
insert into storage.objects (bucket_id, name) values ('book-files', 'x/pride.pdf'), ('book-files', 'x/draft.pdf');
select is(test_value(:learner, $$select to_jsonb(array_agg(name)) from storage.objects$$),
  '["x/pride.pdf"]'::jsonb, 'a draft''s PDF stays closed to learners');

-- ---- book of the week: one atomic call -------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  insert into public.books (id, title, category_id, rights_checked, status) values
    ('d0000000-0000-4000-8000-000000000003', 'Dracula', 'c0000000-0000-4000-8000-000000000001', true, 'published')
$q$)$$, :admin), 'admin adds a second published book');
select lives_ok(format($$select test_as(%L, $q$
  select public.books_set_featured('d0000000-0000-4000-8000-000000000001')
$q$)$$, :admin), 'admin sets the book of the week');
select lives_ok(format($$select test_as(%L, $q$
  select public.books_set_featured('d0000000-0000-4000-8000-000000000003', now() - interval '1 day', now() + interval '6 days')
$q$)$$, :admin), 'admin moves the mark to another book, with a period');
select results_eq($$select id::text from public.books where featured$$,
  $$values ('d0000000-0000-4000-8000-000000000003')$$, 'the mark moved in one step: one book only');
select is(test_value(null, 'select to_jsonb(id) from public.book_featured_now')::text,
  '"d0000000-0000-4000-8000-000000000003"', 'the book of the week shows inside its period');
select throws_like(format($$select test_as(%L, $q$
  select public.books_set_featured('d0000000-0000-4000-8000-000000000002')
$q$)$$, :admin), 'featured_not_published%', 'a draft cannot be the book of the week');
select results_eq($$select id::text from public.books where featured$$,
  $$values ('d0000000-0000-4000-8000-000000000003')$$, 'a refused change keeps the current book');
select throws_ok($$update public.books set featured = true where id = 'd0000000-0000-4000-8000-000000000001'$$,
  '23505', null, 'the database itself refuses a second book of the week');
update public.books set featured_until = now() - interval '1 minute', featured_from = now() - interval '2 days'
  where id = 'd0000000-0000-4000-8000-000000000003';
select is(test_value(null, 'select count(*) from public.book_featured_now')::int, 0,
  'after its period the book of the week is no longer shown');
select lives_ok(format($$select test_as(%L, $q$
  update public.books set status = 'archived' where id = 'd0000000-0000-4000-8000-000000000003'
$q$)$$, :admin), 'admin archives a book');
select is((select featured from public.books where id = 'd0000000-0000-4000-8000-000000000003'),
  false, 'an archived book loses the book-of-the-week mark');
select is(test_value(:learner, 'select count(*) from public.books')::int, 1,
  'an archived book is hidden from learners');

-- ---- shelves with a period -----------------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  insert into public.book_shelves (id, name_ar, name_en, starts_at, ends_at) values
    ('e0000000-0000-4000-8000-000000000001', 'اختياراتنا', 'Our picks', now() - interval '1 day', null),
    ('e0000000-0000-4000-8000-000000000002', 'رمضان', 'Ramadan', now() + interval '10 days', now() + interval '40 days')
$q$)$$, :admin), 'admin adds shelves');
select lives_ok(format($$select test_as(%L, $q$
  insert into public.book_shelf_items (shelf_id, book_id, position) values
    ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 0)
$q$)$$, :admin), 'admin places a book on a shelf');
select is(test_value(null, 'select count(*) from public.book_shelves_now')::int, 1,
  'a shelf whose period has not started is not shown');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_shelf_items (shelf_id, book_id) values
    ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003')
$q$)$$, :learner), '42501', null, 'a learner cannot edit a shelf');

-- ---- bulk actions ---------------------------------------------------------------------------
select is(
  (test_value(:admin, $$select public.books_bulk_update(array[
     'd0000000-0000-4000-8000-000000000002'::uuid, 'd0000000-0000-4000-8000-000000000003'::uuid], 'publish')$$)
   ->> 'updated')::int, 1, 'bulk publish publishes the ready book ...');
select is(
  (select status from public.books where id = 'd0000000-0000-4000-8000-000000000002'), 'draft',
  '... and skips the one that is not ready');

-- ---- categories cannot be deleted while books use them -------------------------------------
select throws_ok($$delete from public.book_categories where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '23503', null, 'the database refuses to delete a category that has books');
select throws_like(format($$select test_as(%L, $q$
  select public.books_delete_category('c0000000-0000-4000-8000-000000000001')
$q$)$$, :admin), 'category_has_books%', 'deleting a used category needs a target');
select is(test_value(:admin, $$select public.books_delete_category(
  'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002')$$)::int, 2,
  'deleting with a target moves its books');
select is((select count(*)::int from public.books where category_id = 'c0000000-0000-4000-8000-000000000002'),
  2, 'the books now belong to the target category');

-- ---- CSV import ----------------------------------------------------------------------------
create temp table import_rows as select $j$[
  {"title": "Jane Eyre", "author": "Charlotte Brontë", "category": "science", "level": "b2",
   "pages": "480", "year": "1847", "tags": "classic; romance"},
  {"title": "Pride and Prejudice", "author": "Jane Austen", "isbn": "9780141439518"},
  {"title": "", "author": "Nobody"},
  {"title": "Bad ISBN", "isbn": "123"},
  {"title": "Unknown category", "category": "Cooking"},
  {"title": "Jane Eyre", "author": "Charlotte Bronte"}
]$j$::jsonb as rows;
grant select on import_rows to authenticated;

select is(
  test_value(:admin, $$select public.books_import('f0000000-0000-4000-8000-000000000001', (select rows from import_rows), 'skip', true)$$)
    - 'rows',
  '{"dry_run": true, "total": 6, "create": 1, "update": 0, "skip": 1, "errors": 4}'::jsonb,
  'a dry run reports: 1 new, 1 existing (skipped), 4 rows with errors');
select is((select count(*)::int from public.books), 3, 'a dry run writes no book');
select is((select count(*)::int from public.book_tags), 0, 'a dry run creates no tag');
select is((select count(*)::int from public.book_imports), 0, 'a dry run records no import');

select is(
  (test_value(:admin, $$select public.books_import('f0000000-0000-4000-8000-000000000002', (select rows from import_rows), 'skip', false, 'books.csv')$$)
    ->> 'create')::int, 1, 'a real import creates the new book');
select is((select status from public.books where title = 'Jane Eyre'), 'draft',
  'an imported book starts as a draft');
select is((select count(*)::int from public.book_tag_links l join public.books b on b.id = l.book_id
  where b.title = 'Jane Eyre'), 2, 'its tags are created and linked');
select is(
  (test_value(:admin, $$select public.books_import('f0000000-0000-4000-8000-000000000002', (select rows from import_rows), 'skip', false, 'books.csv')$$)
    ->> 'replayed')::boolean, true, 'retrying the same import returns the first result ...');
select is((select count(*)::int from public.books where title = 'Jane Eyre'), 1, '... and creates nothing twice');
select is(
  (test_value(:admin, $$select public.books_import('f0000000-0000-4000-8000-000000000003',
     '[{"title": "Jane Eyre", "author": "Charlotte Brontë", "pages": "500"}]'::jsonb, 'update', false)$$)
    ->> 'update')::int, 1, 'a new import can update a matching book');
select is((select pages from public.books where title = 'Jane Eyre'), 500, 'the matching book was updated, not copied');
select is((select level from public.books where title = 'Jane Eyre'), 'B2', 'fields the file leaves empty keep their values');
select is(
  (test_value(:admin, $$select public.books_import('f0000000-0000-4000-8000-000000000004',
     '[{"title": "Pride and Prejudice", "author": "Jane Austen", "isbn": "9780141439518"}]'::jsonb, 'create', true)$$)
    -> 'rows' -> 0 -> 'errors'), '["isbn_taken"]'::jsonb, 'creating a copy with a taken ISBN is refused');

-- ---- file-cleanup list ----------------------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  insert into public.book_file_trash (bucket, path, reason) values ('book-covers', 'old/cover.jpg', 'replaced')
$q$)$$, :admin), 'admin records a file to clean up');
select is(test_value(:learner, 'select count(*) from public.book_file_trash')::int, 0,
  'learners cannot see the cleanup list');

select * from finish(true);
rollback;
