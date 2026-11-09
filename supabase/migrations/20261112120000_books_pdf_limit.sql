-- Library: book PDFs up to 500 MB (was 50 MB). Changes only the "book-files" bucket's own limit
-- and can be run again. Files this large go up in resumable 6 MB parts (TUS).
--
-- The project's global upload limit (Supabase → Storage → Settings → "Upload file size limit")
-- must be raised to at least 500 MB too, or larger files are still refused; that setting is not
-- part of the database and cannot be set from a migration.
update storage.buckets
  set file_size_limit = 524288000
  where id = 'book-files'
    and file_size_limit is distinct from 524288000;
