-- Isolated Postgres/pgTAP only. Storage rows simulate the API's metadata transaction;
-- actual MIME validation and binary-object deletion are performed by Storage, not SQL.
\set ON_ERROR_STOP on
begin;
select no_plan();
grant select, insert, update, delete on storage.objects to authenticated;
-- Supabase has this uniqueness rule; the minimal test stub does not.
create unique index if not exists test_storage_bucket_name on storage.objects(bucket_id, name collate "C") where archived_at is null;
insert into auth.users values
 ('a9000000-0000-4000-8000-000000000001'),
 ('a9000000-0000-4000-8000-000000000002');
\set alice '''a9000000-0000-4000-8000-000000000001'''
\set bob '''a9000000-0000-4000-8000-000000000002'''
create temp table public_book_count_before as select count(*) n from public.books;

select ok((select relrowsecurity from pg_class where oid='public.user_books'::regclass), 'private book rows have RLS');
select ok((select relrowsecurity from pg_class where oid='public.user_book_adds'::regclass), 'rate log has RLS');
select is((select public from storage.buckets where id='user-books'), false, 'PDF bucket is private');
select is((select file_size_limit from storage.buckets where id='user-books'), 52428800::bigint, '50 MiB bucket limit');
select is((select allowed_mime_types from storage.buckets where id='user-books'), array['application/pdf'], 'PDF MIME only');
select ok(not has_function_privilege('anon', 'public.user_books_lock_file(text)', 'execute'), 'anonymous cannot invoke write lock helper');
select ok(has_function_privilege('authenticated', 'public.user_books_lock_file(text)', 'execute'), 'reader can use own-file write check');
select ok(not has_function_privilege('authenticated', 'public.user_books_require_file_removed()', 'execute'), 'delete guard is trigger-only');

select lives_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$
 insert into public.user_books(id,slot,title,size_bytes,file_path) values
 ('b9000000-0000-4000-8000-000000000001',1,'My first PDF',100,
 'a9000000-0000-4000-8000-000000000001/b9000000-0000-4000-8000-000000000001/book.pdf')$$)$test$, 'reader adds first slot with default owner');
select lives_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$
 insert into public.user_books(id,slot,title,size_bytes,file_path) values
 ('b9000000-0000-4000-8000-000000000002',2,'My second PDF',52428800,
 'a9000000-0000-4000-8000-000000000001/b9000000-0000-4000-8000-000000000002/book.pdf')$$)$test$, 'reader adds second slot at maximum declared size');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$
 insert into public.user_books(id,slot,title,size_bytes,file_path) values
 ('b9000000-0000-4000-8000-000000000003',1,'Third',1,
 'a9000000-0000-4000-8000-000000000001/b9000000-0000-4000-8000-000000000003/book.pdf')$$)$test$, '23505', null, 'a third book cannot reuse a slot');
select is(test_value(:alice, $$select to_jsonb(count(*)) from public.user_books$$)::int, 2, 'reader sees own two books');
select is(test_value(:bob, $$select to_jsonb(count(*)) from public.user_books$$)::int, 0, 'other reader sees none');
select throws_ok($test$select test_value(null, $$select to_jsonb(count(*)) from public.user_books$$)$test$, '42501', null, 'visitor has no private table access');
select is(test_value(:alice, $$select to_jsonb(count(*)) from public.user_book_adds$$)::int, 2, 'failed third insert did not consume an add');
select is(test_value(:bob, $$select to_jsonb(count(*)) from public.user_book_adds$$)::int, 0, 'other reader cannot read add history');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$insert into public.user_book_adds(user_id) values('a9000000-0000-4000-8000-000000000001')$$)$test$, '42501', null, 'reader cannot forge rate history');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$delete from public.user_book_adds$$)$test$, '42501', null, 'reader has no delete privilege on rate history');
select is((select count(*)::int from public.user_book_adds), 2, 'reader cannot clear rate history');
select ok(not has_table_privilege('authenticated','public.user_books','truncate'), 'reader cannot bypass book limits with TRUNCATE');
select ok(not has_table_privilege('authenticated','public.user_book_adds','truncate'), 'reader cannot reset rate history with TRUNCATE');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000002', $$insert into public.user_books(id,user_id,slot,title,size_bytes,file_path) values('b9000000-0000-4000-8000-000000000004','a9000000-0000-4000-8000-000000000001',1,'Impersonation',1,'a9000000-0000-4000-8000-000000000001/b9000000-0000-4000-8000-000000000004/book.pdf')$$)$test$, '42501', null, 'wrong owner refused before looking at their rate history');

select lives_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set title='Renamed', page_count=5000, status='ready' where slot=1$$)$test$, 'rename, page count and ready status remain supported');
select is((select title from public.user_books where slot=1), 'Renamed', 'rename persists');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set id=gen_random_uuid() where slot=1$$)$test$, '42501', null, 'book id is immutable');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set user_id='a9000000-0000-4000-8000-000000000002' where slot=1$$)$test$, '42501', null, 'owner is immutable');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set slot=2 where slot=1$$)$test$, '42501', null, 'slot is immutable');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set file_path='another.pdf' where slot=1$$)$test$, '42501', null, 'file path is immutable');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set size_bytes=200 where slot=1$$)$test$, '42501', null, 'declared size is immutable');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set created_at=now()-interval '1 day' where slot=1$$)$test$, '42501', null, 'creation time is immutable');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set title='  ' where slot=1$$)$test$, '23514', null, 'blank title refused');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set page_count=5001 where slot=1$$)$test$, '23514', null, 'page count beyond 5000 refused');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update public.user_books set status='published' where slot=1$$)$test$, '23514', null, 'private book cannot be marked publicly published');

select lives_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$insert into storage.objects(bucket_id,name) values('user-books','a9000000-0000-4000-8000-000000000001/b9000000-0000-4000-8000-000000000001/book.pdf')$$)$test$, 'own reserved path can be uploaded');
select is(test_value(:alice, $$select to_jsonb(count(*)) from storage.objects where bucket_id='user-books'$$)::int, 1, 'reader sees own file');
select is(test_value(:bob, $$select to_jsonb(count(*)) from storage.objects where bucket_id='user-books'$$)::int, 0, 'other reader sees no private files');
select is(test_value(null, $$select to_jsonb(count(*)) from storage.objects where bucket_id='user-books'$$)::int, 0, 'visitor sees no private files');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000002', $$insert into storage.objects(bucket_id,name) values('user-books','a9000000-0000-4000-8000-000000000001/b9000000-0000-4000-8000-000000000002/book.pdf')$$)$test$, '42501', null, 'other reader cannot upload into an existing reservation');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$insert into storage.objects(bucket_id,name) values('user-books','a9000000-0000-4000-8000-000000000001/not-reserved/book.pdf')$$)$test$, '42501', null, 'unreserved path refused');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$insert into storage.objects(bucket_id,name) values('user-books','a9000000-0000-4000-8000-000000000001/b9000000-0000-4000-8000-000000000001/other.pdf')$$)$test$, '42501', null, 'a second filename under a book refused');
select lives_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$update storage.objects set name=name where bucket_id='user-books'$$)$test$, 'own PDF replacement metadata passes the lock check');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$delete from public.user_books where slot=1$$)$test$, '23503', null, 'cannot abandon the PDF by deleting its book row');
select lives_ok($test$select test_as('a9000000-0000-4000-8000-000000000002', $$delete from storage.objects where bucket_id='user-books'$$)$test$, 'another reader file deletion is filtered');
select is((select count(*)::int from storage.objects where bucket_id='user-books'), 1, 'file remains after other reader tried deletion');
select lives_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$delete from storage.objects where bucket_id='user-books'$$)$test$, 'Storage API metadata deletion allowed for own folder');
select lives_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$delete from public.user_books where slot=1$$)$test$, 'book row can be deleted after the file is removed');

-- Eight additional committed adds (the two above count), reusing an empty slot.
do $$ declare i integer; v uuid; begin
 for i in 1..8 loop
  v := gen_random_uuid();
  perform test_as('a9000000-0000-4000-8000-000000000001', format(
   'insert into public.user_books(id,slot,title,size_bytes,file_path) values(%L,1,%L,1,%L)',
   v, 'Rate test', 'a9000000-0000-4000-8000-000000000001/'||v::text||'/book.pdf'));
  perform test_as('a9000000-0000-4000-8000-000000000001', 'delete from public.user_books where slot=1');
 end loop;
end $$;
select is((select count(*)::int from public.user_book_adds), 10, 'deletion does not refund the daily allowance');
select throws_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$insert into public.user_books(id,slot,title,size_bytes,file_path) values('b9000000-0000-4000-8000-000000000003',1,'Eleventh',1,'a9000000-0000-4000-8000-000000000001/b9000000-0000-4000-8000-000000000003/book.pdf')$$)$test$, 'P0001', 'too many books added today', 'eleventh add inside 24 hours refused');
update public.user_book_adds set added_at=now()-interval '49 hours';
select lives_ok($test$select test_as('a9000000-0000-4000-8000-000000000001', $$insert into public.user_books(id,slot,title,size_bytes,file_path) values('b9000000-0000-4000-8000-000000000003',1,'Next day',1,'a9000000-0000-4000-8000-000000000001/b9000000-0000-4000-8000-000000000003/book.pdf')$$)$test$, 'old additions no longer consume the daily quota');
select is((select count(*)::int from public.user_book_adds), 1, 'old log entries are pruned on the next add');
select is((select count(*) from public.books), (select n from public_book_count_before), 'private books do not enter public library counts');
select is((select count(*)::int from public.books where title in ('My first PDF','My second PDF','Renamed','Next day')), 0, 'private titles are absent from public books');
select * from finish(true);
rollback;
