# Library — what to do on the database and in Lovable

ملف واحد فيه كل اللي لازم تعمله إنت بقاعدة البيانات وبـ Lovable للمكتبة. بنضيف عليه بكل
مرحلة، وبالآخر بتطبّق كل إشي مرة وحدة بالترتيب. الموقع بضل شغّال قبل ما تطبّق: الصفحة ولوحة
الأدمن بيرجعوا للنسخة اللي قبل، وبتطلع للأدمن رسالة صغيرة.

| Phase | Migration | Status in this file |
| --- | --- | --- |
| Library (first page) | `20261108120000_books_library.sql` | already applied (PR #146) |
| 1 — admin and data | `20261109120000_books_admin_foundation.sql` | to apply |
| 2 — discovery | `20261110120000_books_discovery.sql` | to apply |
| 3 — popularity | `20261111120000_books_popularity.sql` | to apply |
| PDFs up to 500 MB | `20261112120000_books_pdf_limit.sql` | to apply |
| The reader (page by page) | `20261113120000_books_reader.sql` | to apply |

## 1. Before you start

- Make a backup (Lovable Cloud → Database → Backups, or wait for the daily `vault-daily-snapshot`).
- Note the numbers you will compare after: run
  `select status, count(*) from public.books group by 1;` (before phase 1 the column is
  `published`: `select published, count(*) from public.books group by 1;`).

## 2. Apply the migrations, in this order

Every one of them only adds; each can be run again safely if one stops halfway.

1. `supabase/migrations/20261109120000_books_admin_foundation.sql`
2. `supabase/migrations/20261110120000_books_discovery.sql`
3. `supabase/migrations/20261111120000_books_popularity.sql`
4. `supabase/migrations/20261112120000_books_pdf_limit.sql` (book PDFs up to 500 MB)
5. `supabase/migrations/20261113120000_books_reader.sql` (the reader: pages, place, circle limits)

Then raise the project's own limit, which no migration can change: **Supabase → Storage →
Settings → Upload file size limit → 500 MB** (in Lovable Cloud: the project's storage settings).
On Supabase's free plan this limit cannot go over 50 MB; then PDFs over 50 MB are refused with a
clear message in the editor until the plan allows more.

Keep this order. Do not run phase 2 again after phase 3 (it would bring back the older
`books_browse` beside the new one); running any file again in order is safe.

Text you can give Lovable (or Codex) as is:

> Apply these five Supabase migrations from the repository, in this order, on the live
> database, without changing them: `supabase/migrations/20261109120000_books_admin_foundation.sql`,
> then `supabase/migrations/20261110120000_books_discovery.sql`, then
> `supabase/migrations/20261111120000_books_popularity.sql`, then
> `supabase/migrations/20261112120000_books_pdf_limit.sql`, then
> `supabase/migrations/20261113120000_books_reader.sql`. They are additive and safe to run
> again in this order. Also raise the project's Storage "Upload file size limit" to 500 MB and
> tell me the value it allows. Do not create Edge Functions, cron jobs or new tables beyond what the files contain. After
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
union all select 'visitors can call them', (select bool_and(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('books_browse', 'books_discover'))
union all select 'browse answers', (public.books_browse() ? 'items')
union all select 'browse counts what discover counts', ((public.books_browse()->>'total')::int = (public.books_discover()->>'total')::int);
```

### Phase 3

```sql
select 'tables' as item, (select count(*) = 5 from information_schema.tables where table_schema = 'public' and table_name in ('book_events', 'book_favorites', 'book_ratings', 'book_stats', 'book_daily')) as ok
union all select 'rls on all five', (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace and relname in ('book_events', 'book_favorites', 'book_ratings', 'book_stats', 'book_daily'))
union all select 'counting triggers', (select count(*) = 3 from pg_trigger where not tgisinternal and tgname in ('book_events_count', 'book_favorites_count', 'book_ratings_count'))
union all select 'functions', (select count(*) = 5 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('books_popular', 'books_track', 'books_rate', 'books_favorite', 'books_analytics'))
union all select 'one books_browse', (select count(*) = 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'books_browse')
union all select 'visitors cannot rate', not has_function_privilege('anon', 'public.books_rate(uuid, integer)', 'execute')
union all select 'no visitor policy on ratings or favourites', not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('book_ratings', 'book_favorites', 'book_events') and ('anon' = any (roles) or 'public' = any (roles)))
union all select 'popular answers', (public.books_popular() ? 'top_rated')
union all select 'cards carry ratings', ((public.books_browse()->'items'->0) is null or (public.books_browse()->'items'->0) ? 'rating_count');
```

### PDF limit

```sql
select 'book PDFs up to 500 MB' as item, (select file_size_limit = 524288000 from storage.buckets where id = 'book-files') as ok
union all select 'still PDFs only', (select allowed_mime_types = array['application/pdf'] from storage.buckets where id = 'book-files')
union all select 'still private', (select not public from storage.buckets where id = 'book-files');
```

### The reader

```sql
select 'tables' as item, (select count(*) = 3 from information_schema.tables where table_schema = 'public' and table_name in ('book_pages', 'book_reading_progress', 'book_study_requests')) as ok
union all select 'rls on all three', (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace and relname in ('book_pages', 'book_reading_progress', 'book_study_requests'))
union all select 'books.page_count and prepared_at', (select count(*) = 2 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name in ('page_count', 'prepared_at'))
union all select 'new PDF clears pages trigger', exists (select 1 from pg_trigger where tgname = 'books_reader_reset' and not tgisinternal)
union all select 'pictures bucket is private', (select not public from storage.buckets where id = 'book-pages')
union all select 'pictures only (WebP or JPEG)', (select allowed_mime_types = array['image/webp', 'image/jpeg'] from storage.buckets where id = 'book-pages')
union all select 'picture policies', (select count(*) = 2 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('admins manage book pages pictures', 'readers open pages of published books'))
union all select 'circle limit function', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'books_take_study_quota')
union all select 'visitors cannot ask the circle', not has_function_privilege('anon', 'public.books_take_study_quota(uuid, uuid, integer, text, text, integer)', 'execute')
union all select 'no visitor policy on pages or places', not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('book_pages', 'book_reading_progress', 'book_study_requests') and ('anon' = any (roles) or 'public' = any (roles)));
```

## 4. Storage (phase 1)

- Buckets: `book-covers` (public) and `book-files` (private) exist (Storage → Buckets).
- In `/admin/books`, edit a book and upload a PDF **over 6 MB** (try one between 60 and 200 MB
  too): the progress bar should move in parts and finish. Turn the network off for a few seconds
  in the middle: it should carry on.
- If a big PDF is refused with «أكبر من الحد المسموح بالمشروع», the project's Upload file size
  limit is still lower than the file: raise it (step 2). If it says «الرفع على أجزاء مش شغّال»,
  resumable uploads are off in the project: files up to 50 MB still go up in one request.
- Replace that book's cover: the new one shows, and the old file disappears from the bucket (or
  shows in «الاستيراد والجودة» → «ملفات قديمة لسا ما انشالت»; press «جرّب تشيلهم هلأ»).

## 5. Try it on the live site

The reader (after its migration):

1. In `/admin/books`, edit a published book with a PDF: «القراءة داخل الموقع» → «جهّز الكتاب
   للقراءة». The bar counts the pages; keep the tab open until it says «جاهز للقراءة داخل الموقع».
   Try «وقّف» in the middle, then «كمّل التجهيز»: it carries on from where it stopped.
2. Storage → `book-pages` has a folder with the book's id and one picture per page.
3. Signed in as a learner, open the book on `/books` → «ابدأ القراءة»: the reader opens on page 1
   (and «افتح ملف PDF» still opens the file). Turn pages, zoom, leave and come back: it opens on
   the same page.
4. Select a word or a sentence on the page → the circle → «اشرحلي»: Rita answers in her column.
   Try «تمارين اختيار» and «معنى ونطق».
5. Upload a new PDF for that book: it is not readable in the site until it is prepared again
   (it starts by itself on save).

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

Phase 3 (signed in as a learner, on `/books`):

1. Open a book: the stars and «للمفضلة» show. Rate it 4; tap the 4th star again: the rating goes.
2. Add two books to favourites: «مفضلتي» appears in the row with 2; it lists them.
3. Sign out: the stars say «سجّل دخولك لتقيّم», and a tap asks you to sign in.
4. In `/admin/books` → «الإحصائيات»: your views, reads, favourites and ratings show for 7 days.
5. «الأعلى تقييماً» shows only once a book has 3 ratings from 3 different people.

### Speed on the live site (the 700 ms target)

Open `/books` in Chrome → DevTools → Network, filter `rpc`, and reload five times. Note the time
of `books_discover`, `books_popular` and (after a search) `books_browse`. 95% of them should be
under 700 ms. The database part alone was 13–75 ms on 1000 books in the tests; anything much
slower points to the network or the plan, not to the queries.

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
