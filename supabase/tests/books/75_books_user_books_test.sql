-- Library, "Your books": two private PDFs per reader at most, seen by nobody else, files only at
-- their own path — on the real migrations (pgTAP).
\set ON_ERROR_STOP on
begin;
select no_plan();

insert into auth.users values
  ('a7000000-0000-4000-8000-000000000001'), ('b7000000-0000-4000-8000-000000000002'),
  ('b7000000-0000-4000-8000-000000000003');
insert into public.user_roles values ('a7000000-0000-4000-8000-000000000001', 'admin');
\set admin '''a7000000-0000-4000-8000-000000000001'''
\set one '''b7000000-0000-4000-8000-000000000002'''
\set two '''b7000000-0000-4000-8000-000000000003'''

-- ---- structure -------------------------------------------------------------------------------
select has_table('public', 'user_books', 'private books table');
select ok((select relrowsecurity from pg_class where oid = 'public.user_books'::regclass), 'row level security is on');
select is((select public from storage.buckets where id = 'user-books'), false, 'the files bucket is private');
select is((select allowed_mime_types from storage.buckets where id = 'user-books'), array['application/pdf'], 'PDF only');
select is((select file_size_limit from storage.buckets where id = 'user-books'), 52428800::bigint, 'a file is at most 50 MB');

-- ---- adding books: two at most -----------------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7000000-0000-4000-8000-000000000001', 1, 'My first', 1000,
     'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000001/book.pdf')
$q$)$$, :one), 'a reader adds a book in slot 1');
select lives_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7000000-0000-4000-8000-000000000002', 2, 'My second', 2000,
     'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000002/book.pdf')
$q$)$$, :one), '... and a second in slot 2');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7000000-0000-4000-8000-000000000003', 1, 'A third', 10,
     'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000003/book.pdf')
$q$)$$, :one), '23505', null, 'a third book is refused (slot 1 is taken)');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7000000-0000-4000-8000-000000000003', 3, 'A third', 10,
     'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000003/book.pdf')
$q$)$$, :one), '23514', null, '... and there is no slot 3');
select is((select count(*)::int from public.user_books where user_id = :one), 2, 'the reader has two books');

select throws_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7000000-0000-4000-8000-000000000004', 1, 'Too big', 52428801,
     'b7000000-0000-4000-8000-000000000003/d7000000-0000-4000-8000-000000000004/book.pdf')
$q$)$$, :two), '23514', null, 'a file over 50 MB is refused');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7000000-0000-4000-8000-000000000004', 1, 'Elsewhere', 10, 'somewhere/else.pdf')
$q$)$$, :two), '23514', null, 'the file path must be the book''s own');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, user_id, slot, title, size_bytes, file_path) values
    ('d7000000-0000-4000-8000-000000000004', 'b7000000-0000-4000-8000-000000000002', 1, 'For someone else', 10,
     'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000004/book.pdf')
$q$)$$, :two), '42501', null, 'nobody adds a book for someone else');
select throws_ok($$select test_as(null, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7000000-0000-4000-8000-000000000005', 1, 'Visitor', 10, 'x/y/book.pdf')
$q$)$$, '42501', null, 'a visitor adds nothing');

-- ---- nobody else sees them ---------------------------------------------------------------------
select is(test_value(:two, $$select to_jsonb(count(*)) from public.user_books$$)::int, 0, 'another reader sees none');
select is(test_value(:admin, $$select to_jsonb(count(*)) from public.user_books$$)::int, 0, 'not even the admin');
select is(test_value(null, $$select to_jsonb(count(*)) from public.user_books$$)::int, 0, 'nor a visitor');
select is(test_value(:one, $$select to_jsonb(count(*)) from public.user_books$$)::int, 2, 'the owner sees both');

-- ---- changing a book -------------------------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  update public.user_books set title = 'Renamed', page_count = 120, status = 'ready'
    where id = 'd7000000-0000-4000-8000-000000000001'
$q$)$$, :one), 'the owner renames it and marks it uploaded');
select is((select title from public.user_books where id = 'd7000000-0000-4000-8000-000000000001'), 'Renamed', 'renamed');
select throws_ok(format($$select test_as(%L, $q$
  update public.user_books set slot = 2 where id = 'd7000000-0000-4000-8000-000000000001'
$q$)$$, :one), '42501', null, 'the slot never changes');
select throws_ok(format($$select test_as(%L, $q$
  update public.user_books set size_bytes = 5 where id = 'd7000000-0000-4000-8000-000000000001'
$q$)$$, :one), '42501', null, 'the size never changes');
select is(test_value(:two, $$with x as (update public.user_books set title = 'Hijacked' where id = 'd7000000-0000-4000-8000-000000000001' returning 1) select to_jsonb(count(*)) from x$$)::int,
  0, 'another reader changes nothing');

-- ---- the files -------------------------------------------------------------------------------
select lives_ok(format($$select test_as(%L, $q$
  insert into storage.objects (bucket_id, name) values
    ('user-books', 'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000001/book.pdf')
$q$)$$, :one), 'the owner uploads the file at the book''s own path');
select throws_ok(format($$select test_as(%L, $q$
  insert into storage.objects (bucket_id, name) values
    ('user-books', 'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000001/extra.pdf')
$q$)$$, :one), '42501', null, 'no other file in the book''s folder');
select throws_ok(format($$select test_as(%L, $q$
  insert into storage.objects (bucket_id, name) values
    ('user-books', 'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000009/book.pdf')
$q$)$$, :one), '42501', null, 'no file for a book that does not exist');
select throws_ok(format($$select test_as(%L, $q$
  insert into storage.objects (bucket_id, name) values
    ('user-books', 'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000002/book.pdf')
$q$)$$, :two), '42501', null, 'nobody uploads into someone else''s book');
select is(test_value(:one, $$select to_jsonb(count(*)) from storage.objects where bucket_id = 'user-books'$$)::int, 1,
  'the owner opens the file');
select is(test_value(:two, $$select to_jsonb(count(*)) from storage.objects where bucket_id = 'user-books'$$)::int, 0,
  'another reader cannot');
select is(test_value(:admin, $$select to_jsonb(count(*)) from storage.objects where bucket_id = 'user-books'$$)::int, 0,
  'nor the admin');

-- ---- deleting --------------------------------------------------------------------------------
select is(test_value(:two, $$with x as (delete from storage.objects where bucket_id = 'user-books' returning 1) select to_jsonb(count(*)) from x$$)::int, 0,
  'nobody deletes someone else''s file');
select is(test_value(:one, $$with x as (delete from storage.objects where bucket_id = 'user-books'
    and name = 'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000001/book.pdf' returning 1) select to_jsonb(count(*)) from x$$)::int, 1,
  'the owner deletes the file');
select is(test_value(:two, $$with x as (delete from public.user_books returning 1) select to_jsonb(count(*)) from x$$)::int, 0, 'nobody deletes someone else''s book');
select lives_ok(format($$select test_as(%L, $q$
  delete from public.user_books where id = 'd7000000-0000-4000-8000-000000000001'
$q$)$$, :one), 'the owner deletes the book');
select lives_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7000000-0000-4000-8000-000000000006', 1, 'Instead', 300,
     'b7000000-0000-4000-8000-000000000002/d7000000-0000-4000-8000-000000000006/book.pdf')
$q$)$$, :one), 'the freed slot takes a new book');

-- ---- adding and deleting over and over -------------------------------------------------------
-- The owner has added 3 books today; 7 more add-and-delete rounds reach the limit of 10.
do $$
declare i int;
begin
  perform set_config('request.jwt.claim.sub', 'b7000000-0000-4000-8000-000000000002', true);
  perform set_config('role', 'authenticated', true);
  delete from public.user_books where slot = 1;
  for i in 1..7 loop
    insert into public.user_books (id, slot, title, size_bytes, file_path)
      values (('d7100000-0000-4000-8000-00000000000' || i)::uuid, 1, 'Churn', 10,
              'b7000000-0000-4000-8000-000000000002/d7100000-0000-4000-8000-00000000000' || i || '/book.pdf');
    delete from public.user_books where slot = 1;
  end loop;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
select throws_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7200000-0000-4000-8000-000000000001', 1, 'One too many', 10,
     'b7000000-0000-4000-8000-000000000002/d7200000-0000-4000-8000-000000000001/book.pdf')
$q$)$$, :one), 'P0001', 'too many books added today', 'an 11th book in 24 hours is refused');
select lives_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7200000-0000-4000-8000-000000000002', 1, 'Fine', 10,
     'b7000000-0000-4000-8000-000000000003/d7200000-0000-4000-8000-000000000002/book.pdf')
$q$)$$, :two), '... while another reader still adds');
select is(test_value(:two, $$select to_jsonb(count(*)) from public.user_book_adds$$)::int, 1,
  'a reader sees only their own adds');

select * from finish();
rollback;
