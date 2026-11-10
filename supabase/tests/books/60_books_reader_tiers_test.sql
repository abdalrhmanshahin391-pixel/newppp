-- Library, the reader (phase 2): picture sizes, previews and the per-book manifest — who reads
-- them, what is checked, and that a new PDF clears them (pgTAP, on the real migrations).
\set ON_ERROR_STOP on
begin;
select no_plan();

insert into auth.users values
  ('a6000000-0000-4000-8000-000000000001'), ('b6000000-0000-4000-8000-000000000002');
insert into public.user_roles values ('a6000000-0000-4000-8000-000000000001', 'admin');
\set admin '''a6000000-0000-4000-8000-000000000001'''
\set one '''b6000000-0000-4000-8000-000000000002'''

insert into public.book_categories (id, name_ar, name_en, color, icon) values
  ('c6000000-0000-4000-8000-000000000001', 'كتب الأحجام', 'Tier books', 'teal', 'book');
insert into public.books (id, title, author, category_id, level, language, status, rights_checked, file_path) values
  ('e6000000-0000-4000-8000-000000000001', 'Open', 'W', 'c6000000-0000-4000-8000-000000000001', 'B1', 'en', 'published', true, 'f1/book.pdf'),
  ('e6000000-0000-4000-8000-000000000002', 'Draft', 'W', null, 'B1', 'en', 'draft', false, 'f2/book.pdf');
\set open '''e6000000-0000-4000-8000-000000000001'''
\set draft '''e6000000-0000-4000-8000-000000000002'''

-- ---- structure -------------------------------------------------------------------------------
select has_column('public', 'book_pages', 'thumb_path', 'book_pages.thumb_path');
select has_column('public', 'book_pages', 'mid_path', 'book_pages.mid_path');
select has_column('public', 'book_pages', 'zoom_path', 'book_pages.zoom_path');
select has_column('public', 'book_pages', 'thumbhash', 'book_pages.thumbhash');
select has_column('public', 'book_pages', 'color', 'book_pages.color');
select has_table('public', 'book_manifests', 'manifests table');
select ok((select relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = 'book_manifests'),
  'row level security on manifests');
select hasnt_column('public', 'books', 'manifest', 'the manifest is not on books (cards are built from the whole row)');

-- ---- the admin writes sizes and a manifest -----------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  insert into public.book_pages (book_id, page, width, height, image_path, thumb_path, mid_path, zoom_path, thumbhash, color, text, runs) values
    ('e6000000-0000-4000-8000-000000000001', 1, 1400, 1812, 'e6/1.webp', 'e6/t/1.webp', 'e6/m/1.webp', 'e6/z/1.webp', 'k/gJBYB5d4dneHd5eIeHdoeQiA==', '#fafafa', 'Hi', '[]'),
    ('e6000000-0000-4000-8000-000000000002', 1, 1400, 1812, 'e7/1.webp', null, null, null, null, null, '', '[]');
  insert into public.book_manifests (book_id, pages, outline, dir) values
    ('e6000000-0000-4000-8000-000000000001', '[[1400,1812,15,"w","k/gJBYB5d4dneHd5eIeHdoeQiA==","#fafafa"]]', '[["Chapter One",1,0]]', 'ltr'),
    ('e6000000-0000-4000-8000-000000000002', '[[1400,1812,0,"w",null,null]]', '[]', 'ltr')
$q$)$$, :admin), 'the admin writes sizes, previews and manifests');
select throws_ok($$update public.book_pages set color = 'red' where page = 1 and book_id = 'e6000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a colour must be #rrggbb');
select throws_ok($$update public.book_pages set thumbhash = 'not base64!' where page = 1 and book_id = 'e6000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a preview must be short base64');
select throws_ok($$update public.book_manifests set dir = 'up' where book_id = 'e6000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'the direction is ltr or rtl');
select throws_ok($$update public.book_manifests set pages = '{}' where book_id = 'e6000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'pages must be a list');

-- ---- who reads manifests -----------------------------------------------------------------------
select is(test_value(:one, $$select to_jsonb(array_agg(book_id)) from public.book_manifests$$),
  '["e6000000-0000-4000-8000-000000000001"]'::jsonb, 'a reader reads the manifest of a published book only');
select is(test_value(null, $$select to_jsonb(count(*)) from public.book_manifests$$)::int, 0, 'a visitor reads none');
select is(test_value(:admin, $$select to_jsonb(count(*)) from public.book_manifests$$)::int, 2, 'the admin reads every manifest');
select is(test_value(:one, $$with c as (update public.book_manifests set dir = 'rtl' returning 1) select to_jsonb(count(*)) from c$$)::int,
  0, 'a reader cannot change a manifest');
select is(test_value(:one, $$select to_jsonb(thumb_path) from public.book_pages where book_id = 'e6000000-0000-4000-8000-000000000001'$$),
  '"e6/t/1.webp"'::jsonb, 'a reader reads the sizes of a published book''s pages');

-- ---- a new PDF clears pages and manifest; other changes keep them ------------------------------
update public.books set title = 'Open again' where id = :open;
select is((select count(*)::int from public.book_manifests where book_id = :open), 1, 'other changes keep the manifest');
update public.books set file_path = 'f1/new.pdf' where id = :open;
select is((select count(*)::int from public.book_manifests where book_id = :open), 0, 'a new PDF removes the manifest');
select is((select count(*)::int from public.book_pages where book_id = :open), 0, '... and the pages');

-- ---- deleting a book removes its manifest --------------------------------------------------
delete from public.books where id = :draft;
select is((select count(*)::int from public.book_manifests where book_id = :draft), 0, 'the manifest goes with the book');

select * from finish(true);
rollback;
