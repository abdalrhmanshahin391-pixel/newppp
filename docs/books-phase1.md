# Library — phase 1 (administration and data foundation)

ملخص: هاي المرحلة الأولى من خطة المكتبة. فيها حالات الكتاب (مسودة / منشور / مؤرشف)، ISBN،
مراجعة الحقوق قبل النشر، الوسوم والتصنيفات الثانوية، الرفوف اليدوية بمدة عرض، كتاب الأسبوع بمدة،
إجراءات على كذا كتاب مرة وحدة، رفع الملفات الكبيرة على أجزاء، استبدال الملفات بأمان، واستيراد
CSV بتجربة أولى ما بتحفظ إشي. البحث المتقدّم والصفحات (المرحلة 2) والشعبية والتقييمات (المرحلة 3)
لسا.

## What changed

| Area | Files |
| --- | --- |
| Database | `supabase/migrations/20261109120000_books_admin_foundation.sql` (additive, safe to run twice) |
| Database tests | `supabase/tests/books/*.sql` (pgTAP, 65 checks), `scripts/test-books-db.sh`, CI job `study-database` |
| Rules (pure) | `src/lib/books.ts` (status, readiness, ISBN, periods, admin filters, quality report), `src/lib/books-import.ts` (CSV) |
| Data | `src/lib/books-data.ts` (reads phase 1 when present, falls back to the first migration otherwise) |
| Admin | `src/routes/admin.books.tsx`, `src/components/books/admin/*` |
| Library page | `src/components/books/LibraryPage.tsx`, `src/routes/books.tsx` (manual shelves, server book of the week, `?preview=`) |

### Database (migration `20261109120000_books_admin_foundation.sql`)

- `books`: `status` (`draft` / `published` / `archived`, kept in step with the old `published`
  flag by the `books_before_write` trigger), `alt_title`, `isbn` (digits only, unique, 10 or 13),
  `rights_checked`, `import_key`, `featured_from`, `featured_until`. Existing published books are
  marked `rights_checked = true` so nothing disappears.
- Publishing is refused unless the book has a title, a primary category and the rights check
  (`book_not_ready:<what>`). A missing ISBN, year, cover or PDF only warns.
- `book_tags`, `book_tag_links`, `book_secondary_categories`; names unique whatever the case,
  accents or Arabic diacritics (`book_key`).
- `book_shelves` (visible, `starts_at`, `ends_at`, `sort`) and `book_shelf_items` (order).
  Views `book_shelves_now` and `book_featured_now` judge periods by the server clock
  (`security_invoker`, so row-level security still applies).
- `book_imports` (one row per real import; its id is the operation id) and `book_file_trash`
  (files that could not be removed after a replacement or a delete).
- Functions (security invoker, admin role checked, not callable by visitors):
  `books_set_featured`, `books_delete_category` (moves the books first; the category foreign key
  is now `on delete restrict`), `books_bulk_update`, `books_import`.
- Nothing runs on a timer: no cron, no polling, no new Edge Function.

### Files

- Up to 6 MB: one request. Larger: resumable TUS upload to `/storage/v1/upload/resumable` in 6 MB
  parts with the admin's own token (`tus-js-client`); it resumes after a dropped connection.
- Replacing a file: the new file goes up, the book points to it, then the old one is removed. If
  the removal fails, the path goes to `book_file_trash` and the admin retries from
  «الاستيراد والجودة». If the book cannot point to the new file, the new file is removed and the
  old one stays. A book chosen as «منشور» is published only after its files are up.

### CSV import

1. Choose the file (comma, semicolon or tab; quotes, line breaks inside quotes, a BOM; up to
   2000 rows). Columns are matched in English and Arabic; every field can be changed by hand.
2. Choose what happens to a book that exists (same ISBN, or same title and author): leave it,
   update it (only the fields the file fills), or add a copy (refused when the ISBN is taken).
3. «جرّب بدون حفظ» runs the same checks in the database and writes nothing.
4. «استورد» runs it for real under one operation id. Sending the same id again (a retry after a
   network error) returns the first result and imports nothing twice. New books are drafts.
   Covers and PDFs are added by hand afterwards; nothing is guessed from file names.

## Applying it (Lovable Cloud)

1. Apply `supabase/migrations/20261109120000_books_admin_foundation.sql` (after
   `20261108120000_books_library.sql`). It can be applied again safely.
2. Check the schema with the query below; every row should say `true`.
3. Open `/admin/books`: the yellow notice about «النسخة الأولى» disappears once phase 1 is there.

```sql
select 'books.status' as item, exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'status') as ok
union all select 'books.isbn', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'isbn')
union all select 'books.rights_checked', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'rights_checked')
union all select 'books.featured_from', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'featured_from')
union all select 'tables', (select count(*) = 7 from information_schema.tables where table_schema = 'public' and table_name in ('book_tags', 'book_tag_links', 'book_secondary_categories', 'book_shelves', 'book_shelf_items', 'book_imports', 'book_file_trash'))
union all select 'views', (select count(*) = 2 from information_schema.views where table_schema = 'public' and table_name in ('book_shelves_now', 'book_featured_now'))
union all select 'functions', (select count(*) = 4 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('books_set_featured', 'books_delete_category', 'books_bulk_update', 'books_import'))
union all select 'publish check trigger', exists (select 1 from pg_trigger where tgname = 'books_before_write' and not tgisinternal)
union all select 'rls on new tables', (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace and relname in ('book_tags', 'book_tag_links', 'book_secondary_categories', 'book_shelves', 'book_shelf_items', 'book_imports', 'book_file_trash'))
union all select 'status in step with published', not exists (select 1 from public.books where (status = 'published') <> published)
union all select 'one book of the week at most', (select count(*) <= 1 from public.books where featured);
```

## How it was checked

- `scripts/test-books-db.sh`: the real migrations on Postgres 16 (each one applied twice), then
  65 pgTAP checks as a visitor, a learner and an admin — reading rules, refused writes, publish
  readiness, status sync, ISBN shape and uniqueness, the atomic book of the week and its period,
  archive, shelf periods, bulk actions that skip unready books, category delete with move, dry run
  writes nothing, a real import, a replayed import, update keeps fields, the cleanup list. Runs in
  CI (`study-database` job).
- Node tests: `src/lib/books.test.ts` (14) and `src/lib/books-import.test.ts` (5), plus the rest of
  the CI list; `tsc`; the production build.
- Chromium and WebKit, iPad (1180) and phone (390), with a mocked Supabase: every admin tab, the
  editor, bulk selection, the import dry run (the rows sent to the database were checked), the
  quality list, the library page and the admin preview (a shelf with a February period appears
  only in a February preview).

Not tested here, and worth one real run on the live project:

- Real Storage uploads, especially the resumable path for a PDF over 6 MB (needs the live
  bucket), and a replaced file being removed.
- The migration on the live database itself (only on a local Postgres 16 with the same
  migrations).

## Next

- Phase 2 (discovery): Discover / All books / Search / Category modes, pages of 24 or 48 from the
  database, Postgres full-text search with weights and `pg_trgm`, search on button or Enter (no
  timer), OR-within / AND-between filters with chips and counts, editorial pins and exclusions,
  a seeded order and «اقتراحات جديدة».
- Phase 3 (popularity): daily-deduplicated events, favourites, 1–5 ratings, a Bayesian score and a
  seven-day trend computed when asked (no cron), an analytics view, release and speed checks.
