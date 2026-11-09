-- Library: the book-files bucket takes PDFs up to 500 MB (the migration was applied twice).
\set ON_ERROR_STOP on
begin;
select no_plan();

select is((select file_size_limit from storage.buckets where id = 'book-files'), 524288000::bigint,
  'book PDFs may be up to 500 MB');
select is((select allowed_mime_types from storage.buckets where id = 'book-files'), array['application/pdf'],
  'still PDFs only');
select is((select public from storage.buckets where id = 'book-files'), false, 'still private');
select is((select file_size_limit from storage.buckets where id = 'book-covers'), 5242880::bigint,
  'covers keep their 5 MB limit');

select * from finish(true);
rollback;
