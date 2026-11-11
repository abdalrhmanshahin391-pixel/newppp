-- Library: the starter shelf of 20 books (migration 20261117120000). The migrations were already
-- run twice by the runner, so the counts below also prove it is safe to run again (pgTAP).
-- Runs from the repository root (the runner's directory).
\set ON_ERROR_STOP on
begin;
select no_plan();

insert into auth.users values ('a8000000-0000-4000-8000-000000000001');
insert into public.user_roles values ('a8000000-0000-4000-8000-000000000001', 'admin');
\set admin '''a8000000-0000-4000-8000-000000000001'''

-- ---- what was added -------------------------------------------------------------------------
select is((select count(*)::int from public.books where cover_path like '/book-covers/%'), 20, 'twenty books, run twice');
select is((select count(distinct cover_path)::int from public.books where cover_path like '/book-covers/%'), 20, 'each with its own cover');
select is((select count(*)::int from public.book_categories where name_en in
  ('Wisdom & Strategy', 'Classic Novels', 'Mystery & Detective', 'Gothic & Horror', 'Adventure & Sci-Fi', 'Fantasy & Fairy Tales')), 6,
  'six categories, once each');
select is((select count(*)::int from public.books where status = 'published' and rights_checked and cover_path like '/book-covers/%'), 19,
  'nineteen are published with the rights check');
select is((select status || '/' || rights_checked::text || '/' || coalesce(file_path, 'none') from public.books where title = 'The Book of Five Rings'),
  'draft/false/none', 'Five Rings stays a draft: no rights check, no file');
select is((select count(*)::int from public.books where cover_path like '/book-covers/%' and file_path is not null), 0,
  'no book claims a file it does not have');
select is((select count(*)::int from public.books b where cover_path like '/book-covers/%'
  and not exists (select 1 from public.book_categories c where c.id = b.category_id)), 0, 'every book has its category');
select is((select category_id from public.books where title = 'Dracula'),
  (select category_id from public.books where title = 'Frankenstein'), 'the gothic books share a shelf');
select is((select pages from public.books where title = 'The Art of War'), 203, 'a page count that matches the PDF made from the text');
select is((select year from public.books where title = 'The Art of War'), null, 'an ancient book has no invented year');
select ok((select import_key = public.book_key(title) || '|' || public.book_key(author) from public.books where title = 'Dracula'),
  'the import key is the one the CSV import makes (a later import sees them as there)');

-- ---- who sees what ----------------------------------------------------------------------------
select is(test_value(null, $$select to_jsonb(count(*)) from public.books where cover_path like '/book-covers/%'$$)::int, 19,
  'a visitor sees the nineteen published books');
select is(test_value(null, $$select to_jsonb(count(*)) from public.books where title = 'The Book of Five Rings'$$)::int, 0,
  'and not the draft');
select is(test_value(:admin, $$select to_jsonb(count(*)) from public.books where cover_path like '/book-covers/%'$$)::int, 20,
  'the admin sees all twenty');

-- ---- searching them ---------------------------------------------------------------------------
select is(test_value(null, $$select public.books_browse(p_query => 'sherlock')$$) -> 'total', '1'::jsonb, 'English search finds Holmes');
select is(test_value(null, $$select public.books_browse(p_query => 'دراكولا')$$) -> 'total', '1'::jsonb, 'the Arabic title finds Dracula');
select is(test_value(null, $$select public.books_browse(p_query => 'فن الحرب')$$) -> 'total', '1'::jsonb, 'the Arabic title finds The Art of War');
select is(test_value(null, $$select public.books_browse(p_levels => '{B1}')$$) -> 'total', '1'::jsonb, 'one B1 book (Oz)');

-- ---- an admin who already has the same shelf or the same book -----------------------------------
-- A category with the same Arabic name is reused, not duplicated (its English name may differ).
delete from public.books where title in ('The Adventures of Sherlock Holmes', 'The Hound of the Baskervilles');
delete from public.book_categories where name_en = 'Mystery & Detective';
insert into public.book_categories (id, name_ar, name_en, color, icon, sort)
values ('c8000000-0000-4000-8000-000000000001', 'غموض وتحقيق', 'My own mystery shelf', 'slate', 'book', 99);
-- A book the admin added by hand (another spelling, upper case, no import key) is not added twice.
delete from public.books where title = 'Dracula';
insert into public.books (title, author, category_id, status, rights_checked)
values ('DRACULA ', 'bram stoker', 'c8000000-0000-4000-8000-000000000001', 'draft', false);
\i supabase/migrations/20261117120000_books_starter_library.sql
select is((select count(*)::int from public.book_categories where public.book_key(name_ar) = public.book_key('غموض وتحقيق')), 1,
  'the shelf with the same Arabic name is reused');
select is((select count(*)::int from public.books where category_id = 'c8000000-0000-4000-8000-000000000001' and cover_path like '/book-covers/%'), 2,
  'the two mystery books went into it');
select is((select count(*)::int from public.books where public.book_key(title) = 'dracula'), 1, 'a book that is already there is not added again');
select is((select status from public.books where public.book_key(title) = 'dracula'), 'draft', 'and it is left as the admin has it');
select is((select count(*)::int from public.books where cover_path like '/book-covers/%'), 19, 'nineteen with covers (the admin''s own Dracula has none)');

select * from finish(true);
rollback;
