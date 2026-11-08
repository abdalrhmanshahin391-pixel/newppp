# Library — what to do on the database and in Lovable

ملف واحد فيه كل اللي لازم تعمله إنت بقاعدة البيانات وبـ Lovable للمكتبة. بنضيف عليه بكل
مرحلة، وبالآخر بتطبّق كل إشي مرة وحدة بالترتيب. الموقع بضل شغّال قبل ما تطبّق: الصفحة ولوحة
الأدمن بيرجعوا للنسخة اللي قبل، وبتطلع للأدمن رسالة صغيرة.

| Phase | Migration | Status in this file |
| --- | --- | --- |
| Library (first page) | `20261108120000_books_library.sql` | already applied (PR #146) |
| 1 — admin and data | `20261109120000_books_admin_foundation.sql` | to apply |
| 2 — discovery | `20261110120000_books_discovery.sql` | to apply |
| 3 — popularity | (comes with phase 3) | — |

## 1. Before you start

- Make a backup (Lovable Cloud → Database → Backups, or wait for the daily `vault-daily-snapshot`).
- Note the numbers you will compare after: run
  `select status, count(*) from public.books group by 1;` (before phase 1 the column is
  `published`: `select published, count(*) from public.books group by 1;`).

## 2. Apply the migrations, in this order

Every one of them only adds; each can be run again safely if one stops halfway.

1. `supabase/migrations/20261109120000_books_admin_foundation.sql`
2. `supabase/migrations/20261110120000_books_discovery.sql`

Text you can give Lovable (or Codex) as is:

> Apply these two Supabase migrations from the repository, in this order, on the live database,
> without changing them: `supabase/migrations/20261109120000_books_admin_foundation.sql`, then
> `supabase/migrations/20261110120000_books_discovery.sql`. They are additive and safe to run
> twice. Do not create Edge Functions, cron jobs or new tables beyond what the files contain. After
> each one, run the verification query from `docs/books-lovable-steps.md` and tell me every row's
> result.

## 3. Check each phase (every row must say `true`)

### Phase 1

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

### Phase 2

```sql
select 'pg_trgm installed' as item, exists (select 1 from pg_extension where extname = 'pg_trgm') as ok
union all select 'search columns', (select count(*) = 2 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name in ('search_name', 'search_doc'))
union all select 'every book has a search copy', not exists (select 1 from public.books where search_doc is null)
union all select 'search indexes', (select count(*) = 2 from pg_indexes where schemaname = 'public' and indexname in ('books_search_doc', 'books_search_name_trgm'))
union all select 'editorial table with rls', (select relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = 'book_editorial')
union all select 'functions', (select count(*) = 2 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('books_browse', 'books_discover'))
union all select 'search triggers', (select count(*) = 3 from pg_trigger where not tgisinternal and tgname in ('books_search_fill', 'book_tag_links_search', 'book_tags_search'))
union all select 'visitors can call them', has_function_privilege('anon', 'public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer)', 'execute')
  and has_function_privilege('anon', 'public.books_discover(text, timestamptz, integer)', 'execute')
union all select 'browse answers', (public.books_browse() ? 'items')
union all select 'browse counts what discover counts', ((public.books_browse()->>'total')::int = (public.books_discover()->>'total')::int);
```

## 4. Storage (phase 1)

- Buckets: `book-covers` (public) and `book-files` (private) exist (Storage → Buckets).
- In `/admin/books`, edit a book and upload a PDF **over 6 MB**: the progress bar should move in
  parts and finish. Turn the network off for a few seconds in the middle: it should carry on.
- Replace that book's cover: the new one shows, and the old file disappears from the bucket (or
  shows in «الاستيراد والجودة» → «ملفات قديمة لسا ما انشالت»; press «جرّب تشيلهم هلأ»).

## 5. Try it on the live site

Phase 1 (`/admin/books`):

1. Add a book as a draft; it is not on `/books` (also not when signed out).
2. Try to publish it without «راجعت حقوق الكتاب»: it refuses and says why. Tick it and publish.
3. Archive a book: it leaves `/books`; publish it again.
4. Choose several books → «أضف وسم»; check the toast says how many changed.
5. Delete a category that has books: it asks where they move; they move.
6. Make a shelf with a period starting tomorrow: not on `/books` now; «افتح المعاينة» with
   tomorrow's date shows it.
7. Set the book of the week with a period; check `/books`.
8. Import a CSV of 3 rows: «جرّب بدون حفظ» first (nothing changes), then «استورد»; the books are
   drafts. Press «استورد» again with the same file and choices: nothing is added twice.

Phase 2 (`/books`):

1. Type a title without pressing anything: nothing happens. Press Enter: the results come.
2. Search an author, a word with one wrong letter (e.g. `baskervile`), a word with or without
   hamza (`احمد` / `أحمد`), and a full ISBN.
3. In «فلترة» choose two levels (more books), then a category (fewer). The counts beside each
   chip change; «امسح الكل» clears them.
4. «كل الكتب» → «التالي»: the next 24; «بالصفحة 48»; the back button returns to the same page.
5. On «اكتشف», «اقتراحات جديدة» changes «مختارات لك»; a refresh keeps the same picks.
6. In `/admin/books` → «ترتيب المكتبة» → «التثبيت والاستبعاد»: pin a book on «اكتشف» (it comes
   first in «مختارات لك») and hide another (it leaves «اكتشف» but is still found by search).

## 6. If something fails

- A migration stops with an error: send the error text; do not edit the file by hand. Every
  statement in these files is written to be repeated, so running the file again after a fix is
  safe, whether or not part of it went in.
- The phase 1 notice about duplicate category names (`unique index not created yet`) is only a
  notice: rename the duplicate categories, then run the migration again.
- To check nothing was lost, compare the counts from step 1 with
  `select status, count(*) from public.books group by 1;` — published books stay published.
- The site keeps working if you stop between migrations: each page falls back to what the
  database has.
