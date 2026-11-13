-- Library, "Your books": Uzyra's circle on a private book counts only the owner's own, ready book,
-- with the same limits as library books and one allowance for both (pgTAP, real migrations).
\set ON_ERROR_STOP on
begin;
select no_plan();

insert into auth.users values
  ('a7700000-0000-4000-8000-000000000001'), ('b7700000-0000-4000-8000-000000000002'),
  ('b7700000-0000-4000-8000-000000000003');
insert into public.user_roles values ('a7700000-0000-4000-8000-000000000001', 'admin');
\set admin '''a7700000-0000-4000-8000-000000000001'''
\set one '''b7700000-0000-4000-8000-000000000002'''
\set two '''b7700000-0000-4000-8000-000000000003'''
\set ready '''d7700000-0000-4000-8000-000000000001'''
\set half '''d7700000-0000-4000-8000-000000000002'''

select lives_ok(format($$select test_as(%L, $q$
  insert into public.user_books (id, slot, title, size_bytes, file_path) values
    ('d7700000-0000-4000-8000-000000000001', 1, 'Mine', 1000,
     'b7700000-0000-4000-8000-000000000002/d7700000-0000-4000-8000-000000000001/book.pdf'),
    ('d7700000-0000-4000-8000-000000000002', 2, 'Half uploaded', 1000,
     'b7700000-0000-4000-8000-000000000002/d7700000-0000-4000-8000-000000000002/book.pdf')
$q$)$$, :one), 'a reader adds two books');
select lives_ok(format($$select test_as(%L, $q$
  update public.user_books set status = 'ready', page_count = 69
   where id = 'd7700000-0000-4000-8000-000000000001'
$q$)$$, :one), 'the first is ready, 69 pages');

select has_function('public', 'books_take_my_study_quota',
  array['uuid', 'uuid', 'integer', 'text', 'text', 'integer'], 'the private-book counter exists');
select ok(not has_function_privilege('anon',
  'public.books_take_my_study_quota(uuid, uuid, integer, text, text, integer)', 'execute'),
  'visitors cannot ask');

select is(test_value(:one, $$select public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000001', 3, 'explain', 'explain', 10)$$)->>'ok',
  'true', 'the owner asks about their ready book');
select is((select count(*)::int from public.book_study_requests
            where user_book_id = :ready and book_id is null), 1, '... counted against the private book');
select is(test_value(:one, $$select public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000001', 70, 'explain', 'explain', 10)$$)->>'code',
  'not_found', 'not past the last page');
select is(test_value(:one, $$select public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000002', 1, 'explain', 'explain', 10)$$)->>'code',
  'not_found', 'not a book still uploading');
select is(test_value(:two, $$select public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000001', 1, 'explain', 'explain', 10)$$)->>'code',
  'not_found', 'nobody asks about someone else''s book');
select is(test_value(:admin, $$select public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000001', 1, 'explain', 'explain', 10)$$)->>'code',
  'not_found', 'not even the admin');
select is(test_value(:one, $$select public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000001', 1, 'explain', 'report', 10)$$)->>'code',
  'bad_request', 'an unknown group is refused');

-- The same allowance as library books: four practice requests a minute in all.
select is(test_value(:one, $$select public.books_take_my_study_quota('f7700000-0000-4000-8000-000000000001', 'd7700000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)
  || public.books_take_my_study_quota('f7700000-0000-4000-8000-000000000001', 'd7700000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)$$)->>'ok',
  'true', 'the same request twice ...');
select is((select count(*)::int from public.book_study_requests where quota_group = 'practice'), 1, '... counts once');
select is(test_value(:one, $$select public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)
  || public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)
  || public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)$$)->>'ok',
  'true', 'practice 2–4');
select is(test_value(:one, $$select public.books_take_my_study_quota(gen_random_uuid(), 'd7700000-0000-4000-8000-000000000001', 1, 'make_mcq', 'practice', 10)$$)->>'scope',
  'minute', 'the fifth in a minute waits');

select throws_ok($$insert into public.book_study_requests (request_id, user_id, page, action, quota_group)
  values (gen_random_uuid(), 'b7700000-0000-4000-8000-000000000002', 1, 'x', 'explain')$$,
  '23514', null, 'a request is about exactly one book');
select throws_ok(format($$select test_as(%L, $q$
  insert into public.book_study_requests (request_id, user_id, user_book_id, page, action, quota_group)
    values (gen_random_uuid(), 'b7700000-0000-4000-8000-000000000002', 'd7700000-0000-4000-8000-000000000001', 1, 'x', 'explain')
$q$)$$, :one), '42501', null, 'requests are written only through the limit check');

select lives_ok(format($$select test_as(%L, $q$
  delete from public.user_books where id = 'd7700000-0000-4000-8000-000000000001'
$q$)$$, :one), 'the reader deletes the book');
select is((select count(*)::int from public.book_study_requests where user_book_id = :ready), 0,
  'its requests go with it');

select * from finish();
rollback;
