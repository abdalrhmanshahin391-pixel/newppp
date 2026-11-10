# Uzyra — كل تحديثات قاعدة البيانات اللي لازم تتطبّق (النسخة الكاملة الجديدة)

**هاد الملف بيحل محل الملف القديم.** فيه كل تحديث بقاعدة البيانات من آخر شي طبّقناه لهلأ: تحديثين لمسار
الدروس (قبل المكتبة)، المكتبة الأولى، تصليح الزوار، المراحل الثلاث، حد الـ PDF، القارئ، تصليح الزوار
الجديد، و**الجديد هلأ: رقم 11 (أحجام الصفحات والفهرس، المرحلة 2 من خطة القارئ)**. نص كل تحديث كامل بالملاحق بآخر الملف، ومطابق حرف بحرف لملفات المشروع على `main`.

### شو الجديد عن النسخة اللي قبل (بصراحة)

- **انضاف رقم 11 بس** (`20261115120000_books_reader_tiers.sql`): أحجام إضافية لصور الصفحات، معاينة مموّهة
  صغيرة لكل صفحة، ولونها، وجدول `book_manifests` (فهرس كل كتاب بطلب واحد). كل إشي فيه بيضيف بس، وآمن لو
  انعاد. الأرقام 1–10 ما تغيّر فيها ولا حرف.
- **بعد رقم 11** الكتب اللي تجهّزت قبل بتضل تنقرأ عادي (بالحجم القديم). عشان تاخد الأحجام الجديدة والمعاينة،
  اكبس «حدّث الكتاب» لكل كتاب من `/admin/books` (الخطوة 6).

### شو كان جديد بالنسخة اللي قبلها

- **تحديثين للمكتبة ما كانوا بالملف القديم:** `books_public_read` و`books_visitor_access`. جلسة ثانية على حسابك
  (الطلب #148) ضافتهم لـ `main` **بعد** ما بعتلك الملف. بدونهم الزوار (مش مسجّلين) ممكن ما يشوفوا المكتبة.
- **تحديثين لمسار الدروس** (5 و7 نوفمبر، قبل المكتبة). ما حطيتهم بالملف القديم لأنهم مش من المكتبة،
  ومش متأكد إذا انطبقوا عندك. هلأ موجودين، والاستعلام بالخطوة 0 بيقلك إذا لازمين.
- **المهم:** رسالة الجلسة الثانية بتقول إنها طبّقت تحديثات على قاعدة البيانات الحقيقية. عشان هيك **ابدأ
  بالخطوة 0**: بتعرف منها شو انطبق عندك أصلاً، وما بتعيد إشي على الفاضي (مع إنه الإعادة آمنة).
- **ما تغيّر ولا حرف** بالتحديثات القديمة؛ اللي انضاف بس ملفات جديدة.

### القائمة الكاملة (بالترتيب، ما في غيرها)

| # | الملف | شو بيعمل | من وين | نصّه |
| --- | --- | --- | --- | --- |
| 1 | `20261105120000_rita_path_items.sql` | مسار الدروس: محطات التمارين والملفات | قبل المكتبة (5 نوفمبر) | الملحق 1 |
| 2 | `20261107120000_rita_path_finish_stops.sql` | مسار الدروس: خط نهاية كل مستوى | قبل المكتبة (7 نوفمبر) | الملحق 2 |
| 3 | `20261108120000_books_library.sql` | المكتبة الأولى | #146 | الملحق 3 |
| 4 | `20261108130000_books_public_read.sql` | تصليح قراءة الزوار للمكتبة الأولى | #148 (جلسة ثانية) | الملحق 4 |
| 5 | `20261109120000_books_admin_foundation.sql` | المرحلة 1: الإدارة والبيانات | #149 | الملحق 5 |
| 6 | `20261110120000_books_discovery.sql` | المرحلة 2: البحث والاكتشاف | #150 | الملحق 6 |
| 7 | `20261111120000_books_popularity.sql` | المرحلة 3: التقييم والشعبية | #151 | الملحق 7 |
| 8 | `20261112120000_books_pdf_limit.sql` | حد الـ PDF ‏500 ميغا | #152 | الملحق 8 |
| 9 | `20261113120000_books_reader.sql` | القارئ (صفحة صفحة) | #153 | الملحق 9 |
| 10 | `20261114120000_books_visitor_access.sql` | وصول الزوار للمكتبة الجديدة — بعد 1–9 دايماً | #148 (جلسة ثانية) | الملحق 10 |
| 11 | `20261115120000_books_reader_tiers.sql` | القارئ: أحجام الصفحات، المعاينة، الفهرس | المرحلة 2 من خطة القارئ | الملحق 11 |

وكمان، مش SQL:

- **الحد العام للرفع 500 ميغا** (إعداد بالتخزين) — الخطوة 3.
- **تجهيز كل كتاب للقراءة** من `/admin/books` ← «جهّز الكتاب للقراءة» (مرة لكل كتاب)، وللكتب اللي
  تجهّزت قبل رقم 11: «حدّث الكتاب» — الخطوة 6.

ما في Edge Functions جديدة، ولا مهام مجدولة (cron)، ولا مفاتيح سرية جديدة.

---

## الخطوة 0 — شو انطبق عندك أصلاً؟ (قراءة بس، ما بيغيّر إشي)

شغّل هالاستعلام بمحرر SQL. كل صف `true` معناه هالتحديث موجود عندك، و`false` معناه لازم تطبّقه.

```sql
select item, applied from (values
  (1, '1  مسار الدروس: محطات', to_regclass('public.rita_path_items') is not null),
  (2, '2  مسار الدروس: خط النهاية', exists (select 1 from pg_constraint where conname = 'rita_path_items_kind_check' and pg_get_constraintdef(oid) like '%finish%')),
  (3, '3  المكتبة الأولى', to_regclass('public.books') is not null and to_regclass('public.book_categories') is not null),
  (4, '4  قراءة الزوار (الأولى)', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'books' and (policyname = 'visitors read published books' or (policyname = 'published books are readable' and qual not like '%has_role%')))),
  (5, '5  المرحلة 1', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'status')),
  (6, '6  المرحلة 2', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'search_doc')),
  (7, '7  المرحلة 3', to_regclass('public.book_ratings') is not null),
  (8, '8  حد الـ PDF', exists (select 1 from storage.buckets where id = 'book-files' and file_size_limit = 524288000)),
  (9, '9  القارئ', to_regclass('public.book_pages') is not null),
  (10, '10 وصول الزوار', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'books' and policyname = 'visitors read published books')),
  (11, '11 أحجام الصفحات والفهرس', to_regclass('public.book_manifests') is not null)
) as t(n, item, applied) order by n;
```

- إذا الكل `true`: ما في إشي تطبّقه. روح على الخطوة 3 (الحد العام) والخطوة 4 (الفحص) والخطوة 6.
- إذا في `false`: طبّق **من أول رقم `false` لآخر القائمة بالترتيب** (الخطوة 2). تطبيق تحديث انطبق قبل ما
  بيضر، كلهم مكتوبين ليتكرّروا بأمان.
- إذا رقم 1 أو 2 `false` بس الباقي `true`، طبّق 1 و2 بس (مستقلين عن المكتبة).

## الخطوة 1 — نسخة احتياطية

خذ نسخة احتياطية: Lovable Cloud → Database → Backups (أو استنى النسخة اليومية `vault-daily-snapshot`).
وإذا جدول الكتب موجود، احفظ نتيجة هاد للمقارنة بعدين:

```sql
select published, count(*) from public.books group by 1;
```

## الخطوة 2 — طبّق اللي ناقص بالترتيب

قواعد:

- **بالترتيب بس**. **رقم 10 (وصول الزوار) دايماً بعد 1–9**: إذا طبّقت هلأ شي من 3–9، أعد 10 بعده. رقم 11
  مستقل عن 10 (ما بيلمس سياساته)، فبيجي آخر واحد بالترتيب العادي.
- **ما تعيد المرحلة 2 (رقم 6) بعد المرحلة 3 (رقم 7) لحالها.** إذا لازم تعيدها، كمّل بعدها 7 و8 و9 و10.
- كل تحديث بيضيف وما بيمسح بيانات، وآمن لو انعاد أو وقف بالنص.

### الطريقة أ — بإيدك من محرر SQL (الأضمن)

1. إذا 1 أو 2 `false`: الصق **الملحق 1** وشغّله، بعدين **الملحق 2**.
2. للمكتبة: الصق من أول ملحق ناقص (3 أو أكثر) **لحد الملحق 11، كلهم مع بعض بنفس المرة** وشغّلهم مرة
   وحدة. هيك بيتطبّقوا بعملية وحدة، فإذا وقف إشي ما بينطبق نصّه، والزوار ما بيشوفوا نسخة بالنص.
   (إذا المحرر ما قبل النص الطويل، طبّقهم واحد واحد بالترتيب: 10 بعد 9، و11 آخر واحد.)
3. **إذا 1–10 كلهم `true` وبس 11 `false`**: الصق **الملحق 11** لحاله وشغّله. هاد الغالب عندك.

### الطريقة ب — تعطيها لـ Lovable

انسخ هالنص كما هو، والصق تحته استعلام الخطوة 0:

> First run the read-only status query pasted below on the live database and tell me each row.
> Then apply, in this order and without changing them, only the migrations whose row is false,
> from the first false one to the end: `20261105120000_rita_path_items.sql`,
> `20261107120000_rita_path_finish_stops.sql`, `20261108120000_books_library.sql`,
> `20261108130000_books_public_read.sql`, `20261109120000_books_admin_foundation.sql`,
> `20261110120000_books_discovery.sql`, `20261111120000_books_popularity.sql`,
> `20261112120000_books_pdf_limit.sql`, `20261113120000_books_reader.sql`,
> `20261114120000_books_visitor_access.sql` (always after the ones before it), then
> `20261115120000_books_reader_tiers.sql` (all in `supabase/migrations/` on main). Apply the
> library ones, from the first missing one to the last, in one transaction. They are additive and
> safe to run again. Do not create Edge Functions, cron jobs or tables beyond what the files
> contain. Then run the status query again and tell me each row. Also raise the project's Storage
> "Upload file size limit" to 500 MB and tell me the value it allows.

بعدها الصقله استعلامات الخطوة 4 واطلب منه يقلك نتيجة كل صف.

## الخطوة 3 — ارفع الحد العام للرفع لـ 500 ميغا (إعداد، مش SQL)

**Supabase → Storage → Settings → Upload file size limit → 500 MB** (بـ Lovable Cloud: إعدادات التخزين
بالمشروع، أو اطلبها من Lovable بالنص فوق).

- بالخطة المجانية ما بيعلى عن 50 ميغا. إذا ضل 50، ملفات الـ PDF الأكبر بترفض برسالة واضحة بالمحرّر
  («أكبر من الحد المسموح بالمشروع»)، والأصغر بتنرفع عادي.
- مكان الكتب (`book-files`) صار 500 ميغا بالملحق 8. الحد الفعلي هو الأصغر بين الاثنين.

## الخطوة 4 — افحص (كل صف لازم يطلع `true`)

شغّل الخطوة 0 مرة ثانية: كلها لازم `true`. بعدين هدول:

### مسار الدروس (1 و2)

```sql
select 'path tables' as item, (select count(*) = 2 from information_schema.tables where table_schema = 'public' and table_name in ('rita_path_items', 'rita_path_item_resources')) as ok
union all select 'finish stops allowed', exists (select 1 from pg_constraint where conname = 'rita_path_items_kind_check' and pg_get_constraintdef(oid) like '%finish%')
union all select 'layout function', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'rita_set_path_layout')
union all select 'rls on path tables', (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace and relname in ('rita_path_items', 'rita_path_item_resources'));
```

### بعد المرحلة 1 (رقم 5)

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

### بعد المرحلة 2 (رقم 6)

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

### بعد المرحلة 3 (رقم 7)

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

### بعد حد الـ PDF (رقم 8)

```sql
select 'book PDFs up to 500 MB' as item, (select file_size_limit = 524288000 from storage.buckets where id = 'book-files') as ok
union all select 'still PDFs only', (select allowed_mime_types = array['application/pdf'] from storage.buckets where id = 'book-files')
union all select 'still private', (select not public from storage.buckets where id = 'book-files');
```

### بعد القارئ (رقم 9)

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

### بعد وصول الزوار (رقم 10)

```sql
select 'visitors read published books' as item, exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'books' and policyname = 'visitors read published books' and 'anon' = any (roles)) as ok
union all select 'visitors read visible shelves', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'book_shelves' and policyname = 'visitors read visible shelves')
union all select 'visitors read rules in force', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'book_editorial' and policyname = 'visitors read rules in force')
union all select 'visitors read public numbers', (select count(*) = 2 from pg_policies where schemaname = 'public' and tablename in ('book_stats', 'book_daily') and 'anon' = any (roles))
union all select 'signed-in policy kept for books', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'books' and policyname = 'published books are readable' and 'authenticated' = any (roles))
union all select 'books_read_at exists', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'books_read_at')
union all select 'still one books_browse', (select count(*) = 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'books_browse')
union all select 'visitors can browse', (select bool_and(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('books_browse', 'books_discover', 'books_popular'))
union all select 'no visitor policy on private rows', not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('book_ratings', 'book_favorites', 'book_events', 'book_pages', 'book_reading_progress', 'book_study_requests') and ('anon' = any (roles) or 'public' = any (roles)))
union all select 'browse answers', (public.books_browse() ? 'items');
```

### بعد أحجام الصفحات والفهرس (رقم 11)

```sql
select 'page size columns' as item, (select count(*) = 5 from information_schema.columns where table_schema = 'public' and table_name = 'book_pages' and column_name in ('thumb_path', 'mid_path', 'zoom_path', 'thumbhash', 'color')) as ok
union all select 'size and preview check', exists (select 1 from pg_constraint where conname = 'book_pages_tier_paths')
union all select 'manifests table with rls', coalesce((select relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = 'book_manifests'), false)
union all select 'manifest policies', (select count(*) = 2 from pg_policies where schemaname = 'public' and tablename = 'book_manifests' and policyname in ('readers read manifests of published books', 'admins manage book manifests'))
union all select 'visitors cannot read manifests', not has_table_privilege('anon', 'public.book_manifests', 'select')
union all select 'no visitor policy on manifests', not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'book_manifests' and ('anon' = any (roles) or 'public' = any (roles)))
union all select 'new PDF clears the manifest', (select prosrc like '%book_manifests%' from pg_proc where pronamespace = 'public'::regnamespace and proname = 'books_reader_reset')
union all select 'manifest not on books', not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'manifest');
```

ملاحظة: إذا طلعت رسالة `unique index not created yet` بالمرحلة 1، معناها في تصنيفين بنفس الاسم.
غيّر اسم واحد منهم وأعد تشغيل الملحق 1 (آمن).

## الخطوة 5 — تخزين الملفات

- Buckets: `book-covers` (public) and `book-files` (private) exist (Storage → Buckets).
- In `/admin/books`, edit a book and upload a PDF **over 6 MB** (try one between 60 and 200 MB
  too): the progress bar should move in parts and finish. Turn the network off for a few seconds
  in the middle: it should carry on.
- If a big PDF is refused with «أكبر من الحد المسموح بالمشروع», the project's Upload file size
  limit is still lower than the file: raise it (الخطوة 3). If it says «الرفع على أجزاء مش شغّال»,
  resumable uploads are off in the project: files up to 50 MB still go up in one request.
- Replace that book's cover: the new one shows, and the old file disappears from the bucket (or
  shows in «الاستيراد والجودة» → «ملفات قديمة لسا ما انشالت»; press «جرّب تشيلهم هلأ»).

## الخطوة 6 — جرّب على الموقع

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

القارئ (بعد الملحق 9):

1. بـ `/admin/books` عدّل كتاب منشور فيه PDF: «القراءة داخل الموقع» → «جهّز الكتاب للقراءة». الشريط
   بيعدّ الصفحات؛ خلّي الصفحة مفتوحة لحد ما يقول «جاهز للقراءة داخل الموقع». جرّب «وقّف» بالنص،
   بعدين «كمّل التجهيز»: بيكمّل من وين وقف.
2. Storage → `book-pages` فيه مجلد باسم رقم الكتاب، وصورة لكل صفحة.
3. كمتعلّم مسجّل، افتح الكتاب من `/books` → «ابدأ القراءة»: بيفتح القارئ (و«افتح ملف PDF» لسا
   بيفتح الملف). قلّب الصفحات وكبّر، اطلع وارجع: بيفتح على نفس الصفحة.
4. حدّد كلمة أو جملة من الصفحة → الدائرة → «اشرحلي»: ريتا بتجاوب بعمودها. جرّب «تمارين اختيار»
   و«معنى ونطق».
5. ارفع PDF جديد لنفس الكتاب: ما بيصير يتقرأ بالموقع لحد ما يتجهّز من جديد (التجهيز بيبلّش لحاله
   لما تحفظ).

كل كتاب لازم يتجهّز مرة وحدة من متصفح الأدمن بعد الملحق 9؛ الكتب اللي لسا ما تجهّزت بتطلع
بـ«الاستيراد والجودة» → «جاهزية القراءة».

أحجام الصفحات والفهرس (بعد الملحق 11):

1. بـ `/admin/books` عدّل كتاب تجهّز قبل: بيطلع «حدّث الكتاب» (والكتاب بيطلع بـ«الاستيراد والجودة» →
   «جاهزية القراءة»). اكبسه وخلّي الصفحة مفتوحة: السطر بيقول «صفحة x من y · n صفحة/ثانية · باقي حوالي …».
2. Storage → `book-pages` → مجلد الكتاب: صار فيه `t/` و`m/` و`z/` جنب الصور العادية (على iPad أو تلفون ما
   بينعمل `z/`؛ جهّز من كمبيوتر للأحجام الكاملة).
3. Table editor → `book_manifests`: صف للكتاب، فيه `pages` (صف لكل صفحة) و`outline` (فصول الكتاب إذا الـ PDF
   فيه فهرس).
4. كمتعلّم، افتح الكتاب ونط لصفحة بعيدة (اكتب رقمها): بتشوف صورة مموّهة للصفحة نفسها فوراً، بعدين بتوضح.
   كبّر مرتين أو ثلاث: الصفحة ما بتختفي وهي تجيب الحجم الأكبر.
5. اطلع من القارئ وارجع: الصفحات اللي قريتها بتفتح فوراً من الجهاز. سجّل خروج: بتنمسح من الجهاز.

الزوار (بعد الملحق 10): افتح `/books` بنافذة خاصة (بدون تسجيل دخول): المكتبة بتطلع، البحث والفلاتر
شغّالين، وما في رسالة خطأ. «ابدأ القراءة» بيطلب تسجيل الدخول.

## الخطوة 7 — السرعة على الموقع الحقيقي (هدف 700ms)

Open `/books` in Chrome → DevTools → Network, filter `rpc`, and reload five times. Note the time
of `books_discover`, `books_popular` and (after a search) `books_browse`. 95% of them should be
under 700 ms. The database part alone was 13–75 ms on 1000 books in the tests; anything much
slower points to the network or the plan, not to the queries.

## إذا صار إشي غلط

- A migration stops with an error: send the error text; do not edit the file by hand. Every
  statement in these files is written to be repeated, so running the file again after a fix is
  safe, whether or not part of it went in.
- The phase 1 notice about duplicate category names (`unique index not created yet`) is only a
  notice: rename the duplicate categories, then run the migration again.
- To check nothing was lost, compare the counts from step 1 with
  `select status, count(*) from public.books group by 1;` — published books stay published.
- The site keeps working if you stop between migrations: each page falls back to what the
  database has.

---

## الملحق 1 — مسار الدروس: محطات التمارين والملفات

`supabase/migrations/20261105120000_rita_path_items.sql`

```sql
-- Extra stops on a learner's lesson path, placed by an admin between the lessons:
--   'exercises' — a practice stop (only its look for now: opening it does nothing yet);
--   'resources' — a stop holding files (PDF) and links the learner opens.
--
-- Lessons keep their integer rita_lessons.path_order. An item sits in the same number space with
-- a fractional order (between two lessons, e.g. 3.5), so adding or moving items never renumbers
-- lessons of other books. One function applies a whole new layout atomically.

create table if not exists public.rita_path_items (
  id uuid primary key default gen_random_uuid(),
  language text not null default 'en' check (language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  kind text not null check (kind in ('exercises', 'resources')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  path_order numeric not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rita_path_items_language
  on public.rita_path_items (language, path_order);

alter table public.rita_path_items enable row level security;

drop policy if exists "path items are readable" on public.rita_path_items;
create policy "path items are readable" on public.rita_path_items
  for select to authenticated using (true);
drop policy if exists "admins manage path items" on public.rita_path_items;
create policy "admins manage path items" on public.rita_path_items
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop trigger if exists rita_path_items_updated_at on public.rita_path_items;
create trigger rita_path_items_updated_at before update on public.rita_path_items
  for each row execute function public.set_updated_at();

-- The files and links of a 'resources' stop. Same shape as rita_lesson_resources; PDFs live in the
-- same private bucket under path-items/<item id>/ and reach learners only as signed links.
create table if not exists public.rita_path_item_resources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.rita_path_items (id) on delete cascade,
  kind text not null check (kind in ('pdf', 'link', 'video')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  url text check (url is null or (char_length(url) <= 2000 and url ~* '^https://')),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  file_size integer check (file_size is null or file_size between 1 and 15728640),
  position integer not null default 0 check (position >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint rita_path_item_resources_shape check (
    (kind = 'pdf' and file_path is not null and url is null)
    or (kind in ('link', 'video') and url is not null and file_path is null)
  )
);
create index if not exists rita_path_item_resources_item
  on public.rita_path_item_resources (item_id, position);

alter table public.rita_path_item_resources enable row level security;

drop policy if exists "path item resources are readable" on public.rita_path_item_resources;
create policy "path item resources are readable" on public.rita_path_item_resources
  for select to authenticated using (true);
drop policy if exists "admins manage path item resources" on public.rita_path_item_resources;
create policy "admins manage path item resources" on public.rita_path_item_resources
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Learners may read the stored files of path items (signed links are made with their session).
drop policy if exists "learners read path item files" on storage.objects;
create policy "learners read path item files" on storage.objects
  for select to authenticated
  using (bucket_id = 'rita-lesson-resources' and name like 'path-items/%');

-- Applies a whole path layout at once: integer orders for published lessons, fractional ones for
-- path items. Admins only; any unknown id rolls the whole change back.
create or replace function public.rita_set_path_layout(p_lessons jsonb, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'admin only';
  end if;
  if jsonb_typeof(p_lessons) <> 'array' or jsonb_typeof(p_items) <> 'array' then
    raise exception 'layout must be two jsonb arrays';
  end if;
  for item in select * from jsonb_array_elements(p_lessons) loop
    if (item->>'path_order')::int < 1 then raise exception 'invalid path order'; end if;
    update public.rita_lessons set path_order = (item->>'path_order')::int
    where id = (item->>'id')::uuid and status = 'published';
    if not found then
      raise exception 'lesson % is not a published lesson', item->>'id';
    end if;
  end loop;
  for item in select * from jsonb_array_elements(p_items) loop
    update public.rita_path_items set path_order = (item->>'path_order')::numeric
    where id = (item->>'id')::uuid;
    if not found then
      raise exception 'path item % does not exist', item->>'id';
    end if;
  end loop;
end;
$$;

revoke all on function public.rita_set_path_layout(jsonb, jsonb) from public, anon;
grant execute on function public.rita_set_path_layout(jsonb, jsonb) to authenticated;
```

## الملحق 2 — مسار الدروس: خط نهاية كل مستوى

`supabase/migrations/20261107120000_rita_path_finish_stops.sql`

```sql
-- A level's finish line on the learner's lesson path. The path is cut into one section per level
-- (a lesson's level is its book's level, rita_curricula.level). The finish of a level is drawn after
-- its last lesson; an admin can instead place their own finish stop and move it like any other
-- stop. Its title is the level it closes ("A1" .. "C2").
alter table public.rita_path_items drop constraint if exists rita_path_items_kind_check;
alter table public.rita_path_items
  add constraint rita_path_items_kind_check check (kind in ('exercises', 'resources', 'finish'));
```

## الملحق 3 — المكتبة الأولى

`supabase/migrations/20261108120000_books_library.sql`

```sql
-- The library (/books): books an admin adds, grouped into categories the admin manages.
--   book_categories: a shelf (Romance, Science, ...) with its colour and icon from fixed sets.
--   books: a book's details, its cover picture (public bucket "book-covers") and its PDF (private
--   bucket "book-files", opened with a short signed link).
-- Everyone may read the categories and the published books (the page works for visitors too);
-- only admins write. Nothing here runs on a timer.

create table if not exists public.book_categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 60),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 60),
  color text not null default 'slate'
    check (color in ('rose', 'teal', 'amber', 'violet', 'slate', 'indigo', 'green', 'sky')),
  icon text not null default 'book'
    check (icon in ('book', 'heart', 'flask', 'mountain', 'search', 'rocket', 'landmark', 'brain', 'globe', 'feather')),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  author text not null default '' check (char_length(author) <= 160),
  description text not null default '' check (char_length(description) <= 1200),
  category_id uuid references public.book_categories (id) on delete set null,
  level text not null default 'B1' check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  language text not null default 'en' check (language ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
  pages integer check (pages is null or pages between 1 and 5000),
  year integer check (year is null or year between -3000 and 2100),
  cover_path text check (cover_path is null or char_length(cover_path) <= 300),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  featured boolean not null default false,
  published boolean not null default false,
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists books_category on public.books (category_id, sort);
create index if not exists books_published on public.books (published, created_at desc);
-- One "book of the week" at most.
create unique index if not exists books_one_featured on public.books ((true)) where featured;

drop trigger if exists books_updated_at on public.books;
create trigger books_updated_at before update on public.books
  for each row execute function public.set_updated_at();

alter table public.book_categories enable row level security;
alter table public.books enable row level security;

drop policy if exists "book categories are readable" on public.book_categories;
create policy "book categories are readable" on public.book_categories
  for select to anon, authenticated using (true);
drop policy if exists "admins manage book categories" on public.book_categories;
create policy "admins manage book categories" on public.book_categories
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "published books are readable" on public.books;
create policy "published books are readable" on public.books
  for select to anon, authenticated
  using (published or public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "admins manage books" on public.books;
create policy "admins manage books" on public.books
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Covers: public pictures (5 MB, JPEG / PNG / WebP). Files: private PDFs (50 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-files', 'book-files', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "admins manage book covers and files" on storage.objects;
create policy "admins manage book covers and files" on storage.objects
  for all to authenticated
  using (bucket_id in ('book-covers', 'book-files') and public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (bucket_id in ('book-covers', 'book-files') and public.has_role(auth.uid(), 'admin'::public.app_role));

-- A signed-in reader may open the PDF of a published book (the signed link is made with their
-- own session, so this is checked against the book row).
drop policy if exists "readers open published book files" on storage.objects;
create policy "readers open published book files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'book-files'
    and exists (select 1 from public.books b where b.file_path = storage.objects.name and b.published)
  );
```

## الملحق 4 — تصليح قراءة الزوار للمكتبة الأولى

`supabase/migrations/20261108130000_books_public_read.sql`

```sql
-- has_role is executable by authenticated users, not anon. The original shared SELECT policy
-- called it for visitors too, so /books failed with 42501 even when the library was empty.
-- Visitors and ordinary users read published metadata. The separate permissive ALL policy
-- "admins manage books" still lets authenticated admins read drafts and manage the library.
-- No function grants, write policies, storage policies or existing migration files change.
alter policy "published books are readable" on public.books using (published);
```

## الملحق 5 — المرحلة 1: الإدارة والبيانات

`supabase/migrations/20261109120000_books_admin_foundation.sql`

```sql
-- Library, phase 1 (administration and data foundation). Additive only: it builds on
-- 20261108120000_books_library.sql, keeps every row, and can be run again.
--
--   * books: a status (draft / published / archived) kept in step with the old `published` flag,
--     an alternate title, an ISBN (one book per ISBN), a rights check, an import key, and the
--     period of the book of the week.
--   * A book is published only when it is ready (title, primary category, rights checked); a
--     missing ISBN or year never blocks it.
--   * Tags and optional secondary categories; names are unique whatever their case.
--   * A category with books cannot be deleted: books_delete_category moves them first.
--   * Manual shelves with an order and a display period (judged by the server's clock).
--   * One atomic call changes the book of the week; the unique index from the first migration
--     still guarantees there is never two.
--   * Bulk actions in one call; a file-cleanup list for replaced files that could not be removed
--     (retried by the admin, no scheduler); and a CSV import with a dry run that writes nothing
--     and an operation id that makes a retried import a no-op.
-- Every function runs with the caller's rights (security invoker) and checks the admin role.
-- Nothing runs on a timer.

-- ---------------------------------------------------------------------------------------------
-- Helpers

-- A loose key for "is this the same book": lower case, no Arabic diacritics or tatweel, no
-- Latin accents (Brontë = Bronte), no punctuation, single spaces. (The taa marbuta is kept.)
create or replace function public.book_key(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(
    translate(
      lower(regexp_replace(coalesce(p, ''), '[ً-ٰٟـ]', '', 'g')),
      'àáâãäåāèéêëēìíîïīòóôõöøōùúûüūýÿñçćčšžł',
      'aaaaaaaeeeeeiiiiiooooooouuuuuyyncccszl'),
    '[\s[:punct:]«»،؛؟–—]+', ' ', 'g'))
$$;

-- An ISBN with only its digits (and a final X), or null when it is empty.
create or replace function public.book_isbn(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(regexp_replace(upper(coalesce(p, '')), '[^0-9X]', '', 'g'), '')
$$;

-- ---------------------------------------------------------------------------------------------
-- Books: new columns

alter table public.books add column if not exists status text not null default 'draft';
alter table public.books add column if not exists alt_title text not null default '';
alter table public.books add column if not exists isbn text;
alter table public.books add column if not exists rights_checked boolean not null default false;
alter table public.books add column if not exists import_key text;
alter table public.books add column if not exists featured_from timestamptz;
alter table public.books add column if not exists featured_until timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_status_check') then
    alter table public.books
      add constraint books_status_check check (status in ('draft', 'published', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'books_alt_title_length') then
    alter table public.books
      add constraint books_alt_title_length check (char_length(alt_title) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'books_isbn_shape') then
    alter table public.books
      add constraint books_isbn_shape check (isbn is null or isbn ~ '^([0-9]{9}[0-9X]|97[89][0-9]{10})$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'books_featured_period') then
    alter table public.books
      add constraint books_featured_period
      check (featured_until is null or featured_from is null or featured_until > featured_from);
  end if;
end $$;

-- Rows from before: published books become "published" and count as reviewed (they were already
-- public); everything else stays a draft.
update public.books set status = 'published' where published and status = 'draft';
update public.books set rights_checked = true where status = 'published' and not rights_checked;

create unique index if not exists books_isbn_unique on public.books (isbn) where isbn is not null;
create index if not exists books_import_key on public.books (import_key) where import_key is not null;
create index if not exists books_status on public.books (status, created_at desc);

-- What stops a book from being published (empty when it is ready).
create or replace function public.book_publish_issues(b public.books)
returns text[]
language sql
stable
set search_path = public
as $$
  select array_remove(array[
    case when btrim(coalesce(b.title, '')) = '' then 'title' end,
    case when b.category_id is null then 'category' end,
    case when not coalesce(b.rights_checked, false) then 'rights' end
  ], null)
$$;

-- Keeps status and the old `published` flag in step (older pages still send `published`),
-- refuses to publish a book that is not ready, and takes the book-of-the-week mark off a book
-- that is no longer published.
create or replace function public.books_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  issues text[];
begin
  if tg_op = 'INSERT' then
    if new.published and new.status = 'draft' then
      new.status := 'published';
    end if;
  elsif new.status is not distinct from old.status and new.published is distinct from old.published then
    new.status := case
      when new.published then 'published'
      when old.status = 'archived' then 'archived'
      else 'draft'
    end;
  end if;
  new.published := new.status = 'published';
  new.isbn := public.book_isbn(new.isbn);

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    issues := public.book_publish_issues(new);
    if cardinality(issues) > 0 then
      raise exception 'book_not_ready:%', array_to_string(issues, ',')
        using errcode = 'P0001', hint = 'A book needs a title, a primary category and a rights check.';
    end if;
  end if;

  if new.status <> 'published' then
    new.featured := false;
    new.featured_from := null;
    new.featured_until := null;
  end if;
  return new;
end;
$$;

drop trigger if exists books_before_write on public.books;
create trigger books_before_write before insert or update on public.books
  for each row execute function public.books_before_write();

-- Readers see published books only (admins see all). Replaces the policy of the first migration.
drop policy if exists "published books are readable" on public.books;
create policy "published books are readable" on public.books
  for select to anon, authenticated
  using (status = 'published' or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "readers open published book files" on storage.objects;
create policy "readers open published book files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'book-files'
    and exists (
      select 1 from public.books b
      where b.file_path = storage.objects.name and b.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Categories: unique names, and no deletion while books use them

do $$
begin
  if not exists (
    select 1 from public.book_categories group by public.book_key(name_ar) having count(*) > 1
  ) then
    create unique index if not exists book_categories_name_ar_unique
      on public.book_categories (public.book_key(name_ar));
  else
    raise notice 'book_categories has duplicate Arabic names: unique index not created yet';
  end if;
  if not exists (
    select 1 from public.book_categories group by public.book_key(name_en) having count(*) > 1
  ) then
    create unique index if not exists book_categories_name_en_unique
      on public.book_categories (public.book_key(name_en));
  else
    raise notice 'book_categories has duplicate English names: unique index not created yet';
  end if;
end $$;

alter table public.books drop constraint if exists books_category_id_fkey;
alter table public.books
  add constraint books_category_id_fkey
  foreign key (category_id) references public.book_categories (id) on delete restrict;

-- ---------------------------------------------------------------------------------------------
-- Tags and secondary categories

create table if not exists public.book_tags (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 40),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index if not exists book_tags_name_ar_unique on public.book_tags (public.book_key(name_ar));
create unique index if not exists book_tags_name_en_unique on public.book_tags (public.book_key(name_en));

create table if not exists public.book_tag_links (
  book_id uuid not null references public.books (id) on delete cascade,
  tag_id uuid not null references public.book_tags (id) on delete cascade,
  primary key (book_id, tag_id)
);
create index if not exists book_tag_links_tag on public.book_tag_links (tag_id);

create table if not exists public.book_secondary_categories (
  book_id uuid not null references public.books (id) on delete cascade,
  category_id uuid not null references public.book_categories (id) on delete cascade,
  primary key (book_id, category_id)
);
create index if not exists book_secondary_categories_category
  on public.book_secondary_categories (category_id);

-- ---------------------------------------------------------------------------------------------
-- Manual shelves

create table if not exists public.book_shelves (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 60),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 60),
  visible boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint book_shelves_period check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.book_shelf_items (
  shelf_id uuid not null references public.book_shelves (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  position integer not null default 0,
  primary key (shelf_id, book_id)
);
create index if not exists book_shelf_items_order on public.book_shelf_items (shelf_id, position);

-- ---------------------------------------------------------------------------------------------
-- Imports and the file-cleanup list (admins only)

create table if not exists public.book_imports (
  id uuid primary key,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  file_name text not null default '' check (char_length(file_name) <= 200),
  on_duplicate text not null default 'skip' check (on_duplicate in ('skip', 'update', 'create')),
  result jsonb
);

create table if not exists public.book_file_trash (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('book-covers', 'book-files')),
  path text not null check (char_length(path) between 1 and 300),
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

-- ---------------------------------------------------------------------------------------------
-- Row-level security for the new tables

alter table public.book_tags enable row level security;
alter table public.book_tag_links enable row level security;
alter table public.book_secondary_categories enable row level security;
alter table public.book_shelves enable row level security;
alter table public.book_shelf_items enable row level security;
alter table public.book_imports enable row level security;
alter table public.book_file_trash enable row level security;

drop policy if exists "book tags are readable" on public.book_tags;
create policy "book tags are readable" on public.book_tags
  for select to anon, authenticated using (true);
drop policy if exists "book tag links are readable" on public.book_tag_links;
create policy "book tag links are readable" on public.book_tag_links
  for select to anon, authenticated using (true);
drop policy if exists "secondary categories are readable" on public.book_secondary_categories;
create policy "secondary categories are readable" on public.book_secondary_categories
  for select to anon, authenticated using (true);
drop policy if exists "visible shelves are readable" on public.book_shelves;
create policy "visible shelves are readable" on public.book_shelves
  for select to anon, authenticated
  using (visible or public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "shelf items are readable" on public.book_shelf_items;
create policy "shelf items are readable" on public.book_shelf_items
  for select to anon, authenticated using (true);

do $$
declare
  t text;
begin
  foreach t in array array[
    'book_tags', 'book_tag_links', 'book_secondary_categories', 'book_shelves',
    'book_shelf_items', 'book_imports', 'book_file_trash'
  ] loop
    execute format('drop policy if exists "admins manage %1$s" on public.%1$I', t);
    execute format(
      'create policy "admins manage %1$s" on public.%1$I for all to authenticated '
      'using (public.has_role(auth.uid(), ''admin''::public.app_role)) '
      'with check (public.has_role(auth.uid(), ''admin''::public.app_role))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- What is on show right now, by the server's clock

create or replace view public.book_shelves_now
with (security_invoker = true) as
  select s.*
  from public.book_shelves s
  where s.visible
    and (s.starts_at is null or s.starts_at <= now())
    and (s.ends_at is null or s.ends_at > now());

create or replace view public.book_featured_now
with (security_invoker = true) as
  select b.id
  from public.books b
  where b.featured
    and b.status = 'published'
    and (b.featured_from is null or b.featured_from <= now())
    and (b.featured_until is null or b.featured_until > now());

grant select on public.book_shelves_now, public.book_featured_now to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admin calls

create or replace function public.books_require_admin()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'admin only' using errcode = '42501';
  end if;
end;
$$;

-- The book of the week, in one step: the mark leaves the old book and reaches the new one in the
-- same transaction (null clears it). Concurrent calls queue on one lock.
create or replace function public.books_set_featured(
  p_book uuid,
  p_from timestamptz default null,
  p_until timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.books_require_admin();
  if p_until is not null and p_from is not null and p_until <= p_from then
    raise exception 'featured_period' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('public.books.featured'));
  update public.books
    set featured = false, featured_from = null, featured_until = null
    where featured and (p_book is null or id <> p_book);
  if p_book is not null then
    update public.books
      set featured = true, featured_from = p_from, featured_until = p_until
      where id = p_book and status = 'published';
    if not found then
      raise exception 'featured_not_published' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

-- Deletes a category; its books (and secondary links) move to p_move_to first. Without a target
-- a category that still has books is refused.
create or replace function public.books_delete_category(p_category uuid, p_move_to uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  moved integer := 0;
begin
  perform public.books_require_admin();
  if p_move_to = p_category then
    raise exception 'move_to_same' using errcode = '22023';
  end if;
  if exists (select 1 from public.books where category_id = p_category) then
    if p_move_to is null then
      raise exception 'category_has_books' using errcode = 'P0001';
    end if;
    update public.books set category_id = p_move_to where category_id = p_category;
    get diagnostics moved = row_count;
  end if;
  if p_move_to is not null then
    insert into public.book_secondary_categories (book_id, category_id)
      select book_id, p_move_to from public.book_secondary_categories where category_id = p_category
      on conflict do nothing;
    delete from public.book_secondary_categories
      where category_id = p_move_to
        and book_id in (select id from public.books where category_id = p_move_to);
  end if;
  delete from public.book_categories where id = p_category;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  return moved;
end;
$$;

-- One action on many books in one transaction. A book that cannot be published is skipped and
-- named in the result; anything else wrong stops the whole call.
create or replace function public.books_bulk_update(
  p_ids uuid[],
  p_action text,
  p_category uuid default null,
  p_tag uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer;
  v_done integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  perform public.books_require_admin();
  if coalesce(cardinality(p_ids), 0) = 0 then
    return jsonb_build_object('updated', 0, 'skipped', v_skipped);
  end if;
  if cardinality(p_ids) > 500 then
    raise exception 'too_many_books' using errcode = '22023';
  end if;
  if p_action not in ('publish', 'draft', 'archive', 'set_category', 'add_tag', 'remove_tag') then
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  if p_action = 'set_category' and p_category is null then
    raise exception 'category_required' using errcode = '22023';
  end if;
  if p_action in ('add_tag', 'remove_tag') and p_tag is null then
    raise exception 'tag_required' using errcode = '22023';
  end if;

  foreach v_id in array p_ids loop
    begin
      v_count := 0;
      if p_action = 'publish' then
        update public.books set status = 'published' where id = v_id and status <> 'published';
        get diagnostics v_count = row_count;
      elsif p_action = 'draft' then
        update public.books set status = 'draft' where id = v_id and status <> 'draft';
        get diagnostics v_count = row_count;
      elsif p_action = 'archive' then
        update public.books set status = 'archived' where id = v_id and status <> 'archived';
        get diagnostics v_count = row_count;
      elsif p_action = 'set_category' then
        update public.books set category_id = p_category where id = v_id;
        get diagnostics v_count = row_count;
        delete from public.book_secondary_categories where book_id = v_id and category_id = p_category;
      elsif p_action = 'add_tag' then
        insert into public.book_tag_links (book_id, tag_id) values (v_id, p_tag) on conflict do nothing;
        get diagnostics v_count = row_count;
      else
        delete from public.book_tag_links where book_id = v_id and tag_id = p_tag;
        get diagnostics v_count = row_count;
      end if;
      v_done := v_done + v_count;
    exception when sqlstate 'P0001' then
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('updated', v_done, 'skipped', v_skipped);
end;
$$;

-- CSV import (metadata only). p_rows is a JSON array of objects with: title, alt_title, author,
-- isbn, year, pages, level, language, category (Arabic or English name), tags (a list, or text
-- split by , ; ،), description. A row matches an existing book by ISBN, or by title + author.
-- p_on_duplicate decides what happens to a match: skip, update, or create anyway (never with a
-- taken ISBN). New books are drafts. A dry run reads only. A real run is recorded under
-- p_operation: calling again with the same id returns the first result and writes nothing.
create or replace function public.books_import(
  p_operation uuid,
  p_rows jsonb,
  p_on_duplicate text default 'skip',
  p_dry_run boolean default true,
  p_file_name text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r jsonb;
  i integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_errors text[];
  v_warnings text[];
  v_title text;
  v_alt text;
  v_author text;
  v_isbn_raw text;
  v_isbn text;
  v_year_raw text;
  v_year integer;
  v_pages_raw text;
  v_pages integer;
  v_level text;
  v_lang text;
  v_level_given boolean;
  v_lang_given boolean;
  v_desc text;
  v_cat_name text;
  v_cat uuid;
  v_tags text[];
  v_tag text;
  v_tag_id uuid;
  v_key text;
  v_existing uuid;
  v_action text;
  v_book uuid;
  v_seen_keys text[] := '{}';
  v_seen_isbns text[] := '{}';
  n_create integer := 0;
  n_update integer := 0;
  n_skip integer := 0;
  n_error integer := 0;
  v_result jsonb;
  v_previous jsonb;
begin
  perform public.books_require_admin();
  if p_operation is null then
    raise exception 'operation_required' using errcode = '22023';
  end if;
  if p_on_duplicate not in ('skip', 'update', 'create') then
    raise exception 'unknown_on_duplicate' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows_must_be_an_array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'too_many_rows' using errcode = '22023';
  end if;

  if not p_dry_run then
    insert into public.book_imports (id, file_name, on_duplicate)
      values (p_operation, left(coalesce(p_file_name, ''), 200), p_on_duplicate)
      on conflict (id) do nothing;
    if not found then
      select result into v_previous from public.book_imports where id = p_operation;
      if v_previous is null then
        raise exception 'import_in_progress' using errcode = '55P03';
      end if;
      return v_previous || jsonb_build_object('replayed', true);
    end if;
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_errors := '{}';
    v_warnings := '{}';
    v_book := null;
    v_existing := null;
    v_cat := null;

    if jsonb_typeof(r) is distinct from 'object' then
      v_rows := v_rows || jsonb_build_object('row', i, 'action', 'error', 'errors', jsonb_build_array('row_not_object'));
      n_error := n_error + 1;
      continue;
    end if;

    v_title := btrim(coalesce(r->>'title', ''));
    v_alt := btrim(coalesce(r->>'alt_title', ''));
    v_author := btrim(coalesce(r->>'author', ''));
    v_desc := btrim(coalesce(r->>'description', ''));
    v_isbn_raw := btrim(coalesce(r->>'isbn', ''));
    v_year_raw := btrim(coalesce(r->>'year', ''));
    v_pages_raw := btrim(coalesce(r->>'pages', ''));
    v_level_given := btrim(coalesce(r->>'level', '')) <> '';
    v_lang_given := btrim(coalesce(r->>'language', '')) <> '';
    v_level := case when v_level_given then upper(btrim(r->>'level')) else 'B1' end;
    v_lang := case when v_lang_given then lower(btrim(r->>'language')) else 'en' end;
    v_cat_name := btrim(coalesce(r->>'category', ''));

    if v_title = '' then v_errors := v_errors || 'title_missing'::text; end if;
    if char_length(v_title) > 200 then v_errors := v_errors || 'title_too_long'::text; end if;
    if char_length(v_alt) > 200 then v_errors := v_errors || 'alt_title_too_long'::text; end if;
    if char_length(v_author) > 160 then v_errors := v_errors || 'author_too_long'::text; end if;
    if char_length(v_desc) > 1200 then v_errors := v_errors || 'description_too_long'::text; end if;
    if v_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then v_errors := v_errors || 'level_invalid'::text; end if;
    if v_lang !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' then v_errors := v_errors || 'language_invalid'::text; end if;

    v_year := null;
    if v_year_raw <> '' then
      if v_year_raw ~ '^-?[0-9]{1,4}$' and v_year_raw::integer between -3000 and 2100 then
        v_year := v_year_raw::integer;
      else
        v_errors := v_errors || 'year_invalid'::text;
      end if;
    end if;
    v_pages := null;
    if v_pages_raw <> '' then
      if v_pages_raw ~ '^[0-9]{1,4}$' and v_pages_raw::integer between 1 and 5000 then
        v_pages := v_pages_raw::integer;
      else
        v_errors := v_errors || 'pages_invalid'::text;
      end if;
    end if;
    v_isbn := public.book_isbn(v_isbn_raw);
    if v_isbn is not null and v_isbn !~ '^([0-9]{9}[0-9X]|97[89][0-9]{10})$' then
      v_errors := v_errors || 'isbn_invalid'::text;
      v_isbn := null;
    end if;

    if v_cat_name <> '' then
      select id into v_cat from public.book_categories
        where public.book_key(name_ar) = public.book_key(v_cat_name)
           or public.book_key(name_en) = public.book_key(v_cat_name)
        limit 1;
      if v_cat is null then v_errors := v_errors || 'category_unknown'::text; end if;
    else
      v_warnings := v_warnings || 'no_category'::text;
    end if;

    if jsonb_typeof(r->'tags') = 'array' then
      select coalesce(array_agg(btrim(x)), '{}') into v_tags
        from jsonb_array_elements_text(r->'tags') as x where btrim(x) <> '';
    else
      select coalesce(array_agg(btrim(x)), '{}') into v_tags
        from regexp_split_to_table(coalesce(r->>'tags', ''), '[,;،]') as x where btrim(x) <> '';
    end if;
    foreach v_tag in array v_tags loop
      if char_length(v_tag) > 40 then
        v_errors := v_errors || 'tag_too_long'::text;
      elsif not exists (
        select 1 from public.book_tags
        where public.book_key(name_ar) = public.book_key(v_tag) or public.book_key(name_en) = public.book_key(v_tag)
      ) then
        v_warnings := v_warnings || ('new_tag:' || v_tag);
      end if;
    end loop;

    v_key := public.book_key(v_title) || '|' || public.book_key(v_author);
    if v_title <> '' and (v_key = any (v_seen_keys) or (v_isbn is not null and v_isbn = any (v_seen_isbns))) then
      v_errors := v_errors || 'duplicate_in_file'::text;
    end if;

    if cardinality(v_errors) = 0 then
      select id into v_existing from public.books
        where (v_isbn is not null and isbn = v_isbn) or import_key = v_key
           or (public.book_key(title) = public.book_key(v_title) and public.book_key(author) = public.book_key(v_author))
        order by (v_isbn is not null and isbn = v_isbn) desc, created_at
        limit 1;
      if v_existing is null then
        v_action := 'create';
      else
        v_action := p_on_duplicate;
        if v_action = 'create' and v_isbn is not null and exists (select 1 from public.books where isbn = v_isbn) then
          v_errors := v_errors || 'isbn_taken'::text;
        end if;
      end if;
    end if;
    if cardinality(v_errors) > 0 then
      v_action := 'error';
    end if;

    if not p_dry_run and v_action in ('create', 'update') then
      if v_action = 'create' then
        insert into public.books (
          title, alt_title, author, isbn, year, pages, level, language, description,
          category_id, status, import_key
        ) values (
          v_title, v_alt, v_author, v_isbn, v_year, v_pages, v_level, v_lang, v_desc,
          v_cat, 'draft', v_key
        ) returning id into v_book;
      else
        update public.books set
          title = v_title,
          alt_title = case when v_alt <> '' then v_alt else alt_title end,
          author = case when v_author <> '' then v_author else author end,
          isbn = coalesce(v_isbn, isbn),
          year = coalesce(v_year, year),
          pages = coalesce(v_pages, pages),
          level = case when v_level_given then v_level else level end,
          language = case when v_lang_given then v_lang else language end,
          description = case when v_desc <> '' then v_desc else description end,
          category_id = coalesce(v_cat, category_id),
          import_key = coalesce(import_key, v_key)
        where id = v_existing;
        v_book := v_existing;
      end if;
      foreach v_tag in array v_tags loop
        insert into public.book_tags (name_ar, name_en) values (v_tag, v_tag) on conflict do nothing;
        select id into v_tag_id from public.book_tags
          where public.book_key(name_ar) = public.book_key(v_tag) or public.book_key(name_en) = public.book_key(v_tag)
          limit 1;
        insert into public.book_tag_links (book_id, tag_id) values (v_book, v_tag_id) on conflict do nothing;
      end loop;
    end if;

    if v_action = 'create' then n_create := n_create + 1;
    elsif v_action = 'update' then n_update := n_update + 1;
    elsif v_action = 'skip' then n_skip := n_skip + 1;
    else n_error := n_error + 1;
    end if;
    if v_title <> '' then
      v_seen_keys := v_seen_keys || v_key;
      if v_isbn is not null then v_seen_isbns := v_seen_isbns || v_isbn; end if;
    end if;

    v_rows := v_rows || jsonb_build_object(
      'row', i,
      'action', v_action,
      'title', v_title,
      'existing_id', v_existing,
      'book_id', v_book,
      'errors', to_jsonb(v_errors),
      'warnings', to_jsonb(v_warnings)
    );
  end loop;

  v_result := jsonb_build_object(
    'dry_run', p_dry_run,
    'total', i,
    'create', n_create,
    'update', n_update,
    'skip', n_skip,
    'errors', n_error,
    'rows', v_rows
  );
  if not p_dry_run then
    update public.book_imports set result = v_result where id = p_operation;
  end if;
  return v_result;
end;
$$;

revoke all on function public.books_set_featured(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.books_delete_category(uuid, uuid) from public, anon;
revoke all on function public.books_bulk_update(uuid[], text, uuid, uuid) from public, anon;
revoke all on function public.books_import(uuid, jsonb, text, boolean, text) from public, anon;
revoke all on function public.books_require_admin() from public, anon;
grant execute on function public.books_set_featured(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.books_delete_category(uuid, uuid) to authenticated;
grant execute on function public.books_bulk_update(uuid[], text, uuid, uuid) to authenticated;
grant execute on function public.books_import(uuid, jsonb, text, boolean, text) to authenticated;
grant execute on function public.books_require_admin() to authenticated;
```

## الملحق 6 — المرحلة 2: البحث والاكتشاف

`supabase/migrations/20261110120000_books_discovery.sql`

```sql
-- Library, phase 2 (discovery). Additive only: builds on 20261109120000_books_admin_foundation.sql,
-- keeps every row, and can be run again.
--
--   * Search: each book keeps a search copy, refreshed by triggers whenever the book, its tags or a
--     tag's name change (no timer). Full-text weights: title and alternate title (A), author (B),
--     tags (C), description (D). The copy ignores case, accents, Arabic diacritics, tatweel and the
--     hamza forms of alef, and keeps the taa marbuta. pg_trgm finds a word with a small typo.
--   * books_browse: one call for every list a reader sees — search, filters (OR inside a group,
--     AND between groups), facet counts that ignore their own group, sort, pages of 24 or 48 read
--     from the database, a seeded "recommended" order, and a snapshot time (as_of) so paging does
--     not shift when books are added.
--   * books_discover: the discover page in one call — the book of the week, the admin's shelves,
--     a seeded set of picks, the newest books, and one shelf per category.
--   * Editorial rules: pin or exclude a book on the discover page or in one category, optionally
--     for a period. An exclusion always wins; pins come first, in their order.
-- Both reading calls run with the caller's rights (security invoker): readers only ever get
-- published books. A reader's as_of is never later than now; an admin may preview another time.
-- Nothing runs on a timer.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
-- Readers call the trigram functions through books_browse (Supabase already grants this).
grant usage on schema extensions to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The search copy

-- book_key (phase 1) plus the alef forms made one (أ إ آ ٱ → ا). The taa marbuta stays.
create or replace function public.book_search_norm(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(public.book_key(p), 'أإآٱ', 'اااا')
$$;

alter table public.books add column if not exists search_name text not null default '';
alter table public.books add column if not exists search_doc tsvector;

-- Refreshes the search copy of the row being written (its tags are read from the links).
create or replace function public.books_search_fill()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tags text;
begin
  select coalesce(string_agg(t.name_ar || ' ' || t.name_en, ' '), '') into v_tags
    from public.book_tag_links l
    join public.book_tags t on t.id = l.tag_id
    where l.book_id = new.id;
  new.search_name := public.book_search_norm(concat_ws(' ', new.title, new.alt_title, new.author, v_tags));
  new.search_doc :=
    setweight(to_tsvector('simple', public.book_search_norm(concat_ws(' ', new.title, new.alt_title))), 'A') ||
    setweight(to_tsvector('simple', public.book_search_norm(new.author)), 'B') ||
    setweight(to_tsvector('simple', public.book_search_norm(v_tags)), 'C') ||
    setweight(to_tsvector('simple', public.book_search_norm(new.description)), 'D');
  return new;
end;
$$;

drop trigger if exists books_search_fill on public.books;
create trigger books_search_fill before insert or update on public.books
  for each row execute function public.books_search_fill();

-- A tag added to or taken off a book, or a tag renamed: refresh the books concerned.
create or replace function public.books_search_touch_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.books set search_name = search_name
    where id = case when tg_op = 'DELETE' then old.book_id else new.book_id end;
  return null;
end;
$$;

drop trigger if exists book_tag_links_search on public.book_tag_links;
create trigger book_tag_links_search after insert or delete on public.book_tag_links
  for each row execute function public.books_search_touch_link();

create or replace function public.books_search_touch_tag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.books set search_name = search_name
    where id in (select book_id from public.book_tag_links where tag_id = new.id);
  return null;
end;
$$;

drop trigger if exists book_tags_search on public.book_tags;
create trigger book_tags_search after update of name_ar, name_en on public.book_tags
  for each row execute function public.books_search_touch_tag();

-- Fill the copy for books written before this migration (a second run finds nothing to do).
update public.books set search_name = search_name where search_doc is null;

create index if not exists books_search_doc on public.books using gin (search_doc);

do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm';
  execute format(
    'create index if not exists books_search_name_trgm on public.books using gin (search_name %I.gin_trgm_ops)',
    v_schema);
end $$;

create index if not exists books_published_new on public.books (created_at desc, id)
  where status = 'published';

-- ---------------------------------------------------------------------------------------------
-- Editorial rules: pin or exclude a book on the discover page or in one category

create table if not exists public.book_editorial (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  -- 'discover', or a category id (as text).
  context text not null check (context = 'discover' or context ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  kind text not null check (kind in ('pin', 'exclude')),
  position integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint book_editorial_period check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint book_editorial_one_rule unique (book_id, context)
);
create index if not exists book_editorial_context on public.book_editorial (context, kind, position);

alter table public.book_editorial enable row level security;

drop policy if exists "readers see rules in force" on public.book_editorial;
create policy "readers see rules in force" on public.book_editorial
  for select to anon, authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or ((starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
  );

drop policy if exists "admins manage book_editorial" on public.book_editorial;
create policy "admins manage book_editorial" on public.book_editorial
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- A deleted category takes its rules with it.
create or replace function public.book_categories_drop_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.book_editorial where context = old.id::text;
  return old;
end;
$$;

drop trigger if exists book_categories_drop_rules on public.book_categories;
create trigger book_categories_drop_rules after delete on public.book_categories
  for each row execute function public.book_categories_drop_rules();

-- True when a period (either end open) contains the moment.
create or replace function public.book_in_period(p_from timestamptz, p_until timestamptz, p_at timestamptz)
returns boolean
language sql
immutable
as $$
  select (p_from is null or p_from <= p_at) and (p_until is null or p_until > p_at)
$$;

-- Short under 150 pages, long from 350; no page count counts as medium (as on the page).
create or replace function public.book_length(p_pages integer)
returns text
language sql
immutable
as $$
  select case
    when p_pages is null then 'medium'
    when p_pages < 150 then 'short'
    when p_pages >= 350 then 'long'
    else 'medium'
  end
$$;

-- A book as the page reads it: its row without the search copy, with its tags and secondary
-- categories.
create or replace function public.book_card(b public.books)
returns jsonb
language sql
stable
set search_path = public
as $$
  select (to_jsonb(b) - 'search_doc' - 'search_name' - 'import_key') || jsonb_build_object(
    'tag_ids', coalesce((select jsonb_agg(l.tag_id) from public.book_tag_links l where l.book_id = b.id), '[]'::jsonb),
    'secondary_category_ids', coalesce((select jsonb_agg(s.category_id) from public.book_secondary_categories s where s.book_id = b.id), '[]'::jsonb)
  )
$$;

-- The moment a call reads at: now, or (for an admin) the time asked for.
create or replace function public.books_read_at(p_as_of timestamptz)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p_as_of is null then now()
    when public.has_role(auth.uid(), 'admin'::public.app_role) then p_as_of
    else least(p_as_of, now())
  end
$$;

-- ---------------------------------------------------------------------------------------------
-- books_browse: search, filters, facets, sort and pages

create or replace function public.books_browse(
  p_query text default '',
  p_categories uuid[] default '{}',
  p_levels text[] default '{}',
  p_languages text[] default '{}',
  p_lengths text[] default '{}',
  p_tags uuid[] default '{}',
  p_sort text default null,
  p_context text default null,
  p_seed text default '',
  p_as_of timestamptz default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
set pg_trgm.word_similarity_threshold = 0.5
as $$
declare
  v_at timestamptz := public.books_read_at(p_as_of);
  v_q text := btrim(left(public.book_search_norm(coalesce(p_query, '')), 80));
  v_isbn text := public.book_isbn(p_query);
  v_tsq tsquery;
  v_sort text;
  v_limit integer := case when p_limit = 48 then 48 else 24 end;
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_cats uuid[] := coalesce(p_categories, '{}');
  v_levels text[] := coalesce(p_levels, '{}');
  v_langs text[] := coalesce(p_languages, '{}');
  v_lens text[] := coalesce(p_lengths, '{}');
  v_tags uuid[] := coalesce(p_tags, '{}');
  v_result jsonb;
begin
  if v_q <> '' then
    select to_tsquery('simple', string_agg(quote_literal(w) || ':*', ' & '))
      into v_tsq
      from regexp_split_to_table(v_q, ' ') as w
      where w <> '';
  end if;
  if v_isbn is not null and char_length(v_isbn) < 10 then
    v_isbn := null;
  end if;
  v_sort := coalesce(p_sort, case
    when v_q <> '' then 'relevance'
    when p_context is not null then 'discover'
    else 'new'
  end);
  if v_sort not in ('relevance', 'discover', 'new', 'title', 'short') then
    v_sort := 'new';
  end if;
  if v_sort = 'relevance' and v_q = '' then
    v_sort := 'new';
  end if;

  with found as (
    select
      b,
      b.id,
      b.created_at,
      b.pages,
      b.title,
      case
        when v_q = '' then 0
        when v_isbn is not null and b.isbn = v_isbn then 3
        when v_tsq is not null and b.search_doc @@ v_tsq then 1 + ts_rank_cd(b.search_doc, v_tsq)
        else word_similarity(v_q, b.search_name) * 0.5
      end as rank,
      (select e.position from public.book_editorial e
        where e.book_id = b.id and e.kind = 'pin' and e.context = p_context
          and public.book_in_period(e.starts_at, e.ends_at, v_at)) as pin,
      (cardinality(v_cats) = 0 or b.category_id = any (v_cats) or exists (
        select 1 from public.book_secondary_categories s
        where s.book_id = b.id and s.category_id = any (v_cats))) as m_cat,
      (cardinality(v_levels) = 0 or b.level = any (v_levels)) as m_level,
      (cardinality(v_langs) = 0 or b.language = any (v_langs)) as m_lang,
      (cardinality(v_lens) = 0 or public.book_length(b.pages) = any (v_lens)) as m_len,
      (cardinality(v_tags) = 0 or exists (
        select 1 from public.book_tag_links l where l.book_id = b.id and l.tag_id = any (v_tags))) as m_tag
    from public.books b
    where b.status = 'published'
      and b.created_at <= v_at
      and (
        v_q = ''
        or (v_tsq is not null and b.search_doc @@ v_tsq)
        or (v_isbn is not null and b.isbn = v_isbn)
        or (char_length(v_q) >= 4 and v_q <% b.search_name)
      )
      and not exists (
        select 1 from public.book_editorial e
        where e.book_id = b.id and e.kind = 'exclude' and e.context = p_context
          and public.book_in_period(e.starts_at, e.ends_at, v_at))
  ),
  hits as (
    select * from found where m_cat and m_level and m_lang and m_len and m_tag
  ),
  ordered as (
    select h.b, h.id, row_number() over (
      order by
        (case when v_sort = 'discover' then coalesce(h.pin, 2147483647) end),
        (case when v_sort = 'discover' then md5(coalesce(p_seed, '') || ':' || h.id) end),
        (case when v_sort = 'relevance' then h.rank end) desc,
        (case when v_sort = 'title' then public.book_key(h.title) end),
        (case when v_sort = 'short' then coalesce(h.pages, 2147483647) end),
        h.created_at desc,
        h.id
    ) as ord
    from hits h
  ),
  page as (
    select o.b, o.id, o.ord
    from ordered o
    where o.ord > v_offset
    order by o.ord
    limit v_limit
  )
  select jsonb_build_object(
    'as_of', v_at,
    'sort', v_sort,
    'limit', v_limit,
    'offset', v_offset,
    'total', (select count(*) from hits),
    'items', coalesce((
      select jsonb_agg(public.book_card(p.b) order by p.ord)
      from page p
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'category', coalesce((
        select jsonb_object_agg(cid, n) from (
          select cid, count(distinct id) as n from (
            select f.id, (f.b).category_id as cid from found f
              where f.m_level and f.m_lang and f.m_len and f.m_tag
            union all
            select f.id, s.category_id from found f
              join public.book_secondary_categories s on s.book_id = f.id
              where f.m_level and f.m_lang and f.m_len and f.m_tag
          ) z where cid is not null group by cid
        ) c), '{}'::jsonb),
      'level', coalesce((
        select jsonb_object_agg(k, n) from (
          select (f.b).level as k, count(*) as n from found f
            where f.m_cat and f.m_lang and f.m_len and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'language', coalesce((
        select jsonb_object_agg(k, n) from (
          select (f.b).language as k, count(*) as n from found f
            where f.m_cat and f.m_level and f.m_len and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'length', coalesce((
        select jsonb_object_agg(k, n) from (
          select public.book_length(f.pages) as k, count(*) as n from found f
            where f.m_cat and f.m_level and f.m_lang and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'tag', coalesce((
        select jsonb_object_agg(k, n) from (
          select l.tag_id as k, count(*) as n from found f
            join public.book_tag_links l on l.book_id = f.id
            where f.m_cat and f.m_level and f.m_lang and f.m_len group by 1
        ) c), '{}'::jsonb)
    )
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- books_discover: the discover page in one call

create or replace function public.books_discover(
  p_seed text default '',
  p_as_of timestamptz default null,
  p_per integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select public.books_read_at(p_as_of) as at, least(greatest(coalesce(p_per, 12), 1), 24) as per
  ),
  live as (
    select b.id, b.category_id, b.sort, b.created_at
    from public.books b, params
    where b.status = 'published' and b.created_at <= params.at
  ),
  rules as (
    select e.book_id, e.context, e.kind, e.position
    from public.book_editorial e, params
    where public.book_in_period(e.starts_at, e.ends_at, params.at)
  ),
  -- Hidden from the discover page (the admin's own shelves and the book of the week excepted).
  shown as (
    select l.* from live l
    where not exists (
      select 1 from rules r where r.book_id = l.id and r.context = 'discover' and r.kind = 'exclude')
  ),
  picks as (
    select s.id, row_number() over (
      order by r.position nulls last, md5(coalesce(p_seed, '') || ':' || s.id), s.id) as n
    from shown s
    left join rules r on r.book_id = s.id and r.context = 'discover' and r.kind = 'pin'
  ),
  newest as (
    select s.id, row_number() over (order by s.created_at desc, s.id) as n from shown s
  ),
  loose as (
    select s.id, row_number() over (order by s.sort, s.created_at desc, s.id) as n
    from shown s
    left join public.book_categories c on c.id = s.category_id
    where c.id is null
  ),
  in_category as (
    select s.id, s.category_id, row_number() over (
      partition by s.category_id
      order by r.position nulls last, s.sort, s.created_at desc, s.id) as n
    from shown s
    left join rules r on r.book_id = s.id and r.context = s.category_id::text and r.kind = 'pin'
    where s.category_id is not null
      and not exists (
        select 1 from rules x
        where x.book_id = s.id and x.context = s.category_id::text and x.kind = 'exclude')
  ),
  categories as (
    select c.id, c.sort, count(i.id) as total,
      array_agg(i.id order by i.n) filter (where i.n <= (select per from params)) as ids
    from public.book_categories c
    join in_category i on i.category_id = c.id
    group by c.id, c.sort
  ),
  shelves as (
    select sh.id, sh.name_ar, sh.name_en, sh.sort,
      array(
        select i.book_id from public.book_shelf_items i
        join live l on l.id = i.book_id
        where i.shelf_id = sh.id
        order by i.position
        limit 24
      ) as ids
    from public.book_shelves sh, params
    where sh.visible and public.book_in_period(sh.starts_at, sh.ends_at, params.at)
  ),
  featured as (
    select b.id from public.books b, params
    where b.featured and b.status = 'published' and b.created_at <= params.at
      and public.book_in_period(b.featured_from, b.featured_until, params.at)
    limit 1
  ),
  wanted as (
    select id from picks where n <= (select per from params)
    union select id from newest where n <= (select per from params)
    union select id from loose where n <= (select per from params)
    union select unnest(ids) from categories
    union select unnest(ids) from shelves
    union select id from featured
  )
  select jsonb_build_object(
    'as_of', (select at from params),
    'total', (select count(*) from live),
    'featured_id', (select id from featured),
    'picks', coalesce((select jsonb_agg(id order by n) from picks where n <= (select per from params)), '[]'::jsonb),
    'newest', coalesce((select jsonb_agg(id order by n) from newest where n <= (select per from params)), '[]'::jsonb),
    'loose', coalesce((select jsonb_agg(id order by n) from loose where n <= (select per from params)), '[]'::jsonb),
    'shelves', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name_ar', name_ar, 'name_en', name_en, 'ids', to_jsonb(ids)) order by sort)
      from shelves where cardinality(ids) > 0), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'total', total, 'ids', to_jsonb(ids)) order by sort)
      from categories), '[]'::jsonb),
    'books', coalesce((
      select jsonb_object_agg(b.id, public.book_card(b))
      from public.books b where b.id in (select id from wanted)), '{}'::jsonb)
  )
$$;

revoke all on function public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer) from public;
revoke all on function public.books_discover(text, timestamptz, integer) from public;
grant execute on function public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer) to anon, authenticated;
grant execute on function public.books_discover(text, timestamptz, integer) to anon, authenticated;
grant execute on function public.book_search_norm(text), public.book_in_period(timestamptz, timestamptz, timestamptz),
  public.book_length(integer), public.book_card(public.books), public.books_read_at(timestamptz)
  to anon, authenticated;
grant select on public.book_editorial to anon, authenticated;
grant insert, update, delete on public.book_editorial to authenticated;
```

## الملحق 7 — المرحلة 3: التقييم والشعبية

`supabase/migrations/20261111120000_books_popularity.sql`

```sql
-- Library, phase 3 (popularity). Additive only: builds on 20261110120000_books_discovery.sql,
-- keeps every row, and can be run again.
--
--   * Events: a signed-in reader opening a book ("view") or starting to read it ("read"), counted
--     once per book, person, day and kind (a repeat is ignored). Visitors are not counted. The
--     person comes from auth.uid(), never from the page.
--   * Favourites and ratings (1–5, one per person and book, changeable). Each person reads and
--     writes only their own; only published books.
--   * The public numbers live in two tables without any identity: per book (ratings count and sum,
--     favourites, views, reads) and per book and day (views, reads, favourites, ratings). Three small
--     triggers keep them (security definer, which is all they can do); nothing reads people's rows.
--   * Top rated: a Bayesian average S = (v·R + m·C) / (v + m), m = 10, C the mean of all ratings;
--     only books with at least 3 ratings. Trending: T = Σ (V + 3R + 2F) · exp(−ln2 · d / 3) over the
--     last 7 days (d in days). Both are computed when asked: no timer, no materialized view.
--   * books_popular (the two discover shelves), books_browse gains the "rating" and "trending"
--     orders and "my favourites", book cards carry their rating, and books_analytics (admins).
-- Every reading call runs with the caller's rights (security invoker). Nothing runs on a timer.

-- ---------------------------------------------------------------------------------------------
-- People's own rows

create table if not exists public.book_events (
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('view', 'read')),
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  primary key (book_id, user_id, day, kind)
);

create table if not exists public.book_favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index if not exists book_favorites_book on public.book_favorites (book_id);

create table if not exists public.book_ratings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index if not exists book_ratings_book on public.book_ratings (book_id);

-- ---------------------------------------------------------------------------------------------
-- Public numbers (no identities)

create table if not exists public.book_stats (
  book_id uuid primary key references public.books (id) on delete cascade,
  rating_count integer not null default 0,
  rating_sum integer not null default 0,
  favorite_count integer not null default 0,
  views integer not null default 0,
  reads integer not null default 0
);

create table if not exists public.book_daily (
  book_id uuid not null references public.books (id) on delete cascade,
  day date not null,
  views integer not null default 0,
  reads integer not null default 0,
  favorites integer not null default 0,
  ratings integer not null default 0,
  primary key (book_id, day)
);
create index if not exists book_daily_day on public.book_daily (day, book_id);

alter table public.book_events enable row level security;
alter table public.book_favorites enable row level security;
alter table public.book_ratings enable row level security;
alter table public.book_stats enable row level security;
alter table public.book_daily enable row level security;

-- A published book (readers act only on these).
create or replace function public.book_is_published(p_book uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.books where id = p_book and status = 'published')
$$;

drop policy if exists "people record their own reading" on public.book_events;
create policy "people record their own reading" on public.book_events
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));
drop policy if exists "admins read reading events" on public.book_events;
create policy "admins read reading events" on public.book_events
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "people see their own favorites" on public.book_favorites;
create policy "people see their own favorites" on public.book_favorites
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "people add their own favorites" on public.book_favorites;
create policy "people add their own favorites" on public.book_favorites
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));
drop policy if exists "people remove their own favorites" on public.book_favorites;
create policy "people remove their own favorites" on public.book_favorites
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "people see their own ratings" on public.book_ratings;
create policy "people see their own ratings" on public.book_ratings
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "people rate published books" on public.book_ratings;
create policy "people rate published books" on public.book_ratings
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));
drop policy if exists "people change their own ratings" on public.book_ratings;
create policy "people change their own ratings" on public.book_ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.book_is_published(book_id));
drop policy if exists "people remove their own ratings" on public.book_ratings;
create policy "people remove their own ratings" on public.book_ratings
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "numbers of published books are public" on public.book_stats;
create policy "numbers of published books are public" on public.book_stats
  for select to anon, authenticated
  using (public.book_is_published(book_id) or public.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "daily numbers of published books are public" on public.book_daily;
create policy "daily numbers of published books are public" on public.book_daily
  for select to anon, authenticated
  using (public.book_is_published(book_id) or public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_events, public.book_favorites, public.book_ratings,
  public.book_stats, public.book_daily from anon;
revoke insert, update, delete on public.book_stats, public.book_daily from authenticated;
grant select on public.book_stats, public.book_daily to anon, authenticated;
grant select, insert on public.book_events to authenticated;
grant select, insert, delete on public.book_favorites to authenticated;
grant select, insert, update, delete on public.book_ratings to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The triggers that keep the public numbers (the only writers of book_stats and book_daily)

create or replace function public.book_numbers_add(
  p_book uuid, p_day date, p_views integer, p_reads integer, p_favorites integer, p_ratings integer,
  p_rating_count integer, p_rating_sum integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The book may be on its way out (a delete cascading): then there is nothing to count.
  if not exists (select 1 from public.books where id = p_book) then
    return;
  end if;
  insert into public.book_stats as s (book_id, rating_count, rating_sum, favorite_count, views, reads)
    values (p_book, greatest(p_rating_count, 0), greatest(p_rating_sum, 0), greatest(p_favorites, 0),
            greatest(p_views, 0), greatest(p_reads, 0))
    on conflict (book_id) do update set
      rating_count = greatest(s.rating_count + p_rating_count, 0),
      rating_sum = greatest(s.rating_sum + p_rating_sum, 0),
      favorite_count = greatest(s.favorite_count + p_favorites, 0),
      views = s.views + p_views,
      reads = s.reads + p_reads;
  if p_day is not null then
    insert into public.book_daily as d (book_id, day, views, reads, favorites, ratings)
      values (p_book, p_day, greatest(p_views, 0), greatest(p_reads, 0), greatest(p_favorites, 0),
              greatest(p_ratings, 0))
      on conflict (book_id, day) do update set
        views = greatest(d.views + p_views, 0),
        reads = greatest(d.reads + p_reads, 0),
        favorites = greatest(d.favorites + p_favorites, 0),
        ratings = greatest(d.ratings + p_ratings, 0);
  end if;
end;
$$;
revoke all on function public.book_numbers_add(uuid, date, integer, integer, integer, integer, integer, integer)
  from public, anon, authenticated;

create or replace function public.book_events_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.book_numbers_add(new.book_id, new.day,
    (new.kind = 'view')::int, (new.kind = 'read')::int, 0, 0, 0, 0);
  return null;
end;
$$;
drop trigger if exists book_events_count on public.book_events;
create trigger book_events_count after insert on public.book_events
  for each row execute function public.book_events_count();

create or replace function public.book_favorites_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.book_numbers_add(new.book_id, (new.created_at at time zone 'utc')::date, 0, 0, 1, 0, 0, 0);
  else
    perform public.book_numbers_add(old.book_id, (old.created_at at time zone 'utc')::date, 0, 0, -1, 0, 0, 0);
  end if;
  return null;
end;
$$;
drop trigger if exists book_favorites_count on public.book_favorites;
create trigger book_favorites_count after insert or delete on public.book_favorites
  for each row execute function public.book_favorites_count();

create or replace function public.book_ratings_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.book_numbers_add(new.book_id, (now() at time zone 'utc')::date, 0, 0, 0, 1, 1, new.rating);
  elsif tg_op = 'UPDATE' then
    perform public.book_numbers_add(new.book_id, null, 0, 0, 0, 0, 0, new.rating - old.rating);
  else
    perform public.book_numbers_add(old.book_id, null, 0, 0, 0, 0, -1, -old.rating);
  end if;
  return null;
end;
$$;
drop trigger if exists book_ratings_count on public.book_ratings;
create trigger book_ratings_count after insert or update of rating or delete on public.book_ratings
  for each row execute function public.book_ratings_count();

-- Ratings written before this file ran (none in practice; keeps a second run exact).
insert into public.book_stats (book_id, rating_count, rating_sum)
  select book_id, count(*), sum(rating) from public.book_ratings group by book_id
  on conflict (book_id) do update set rating_count = excluded.rating_count, rating_sum = excluded.rating_sum;

-- ---------------------------------------------------------------------------------------------
-- Scores

-- The mean of all ratings of published books (C in the Bayesian average).
create or replace function public.book_rating_mean()
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(s.rating_sum)::numeric / nullif(sum(s.rating_count), 0), 0)
  from public.book_stats s
  join public.books b on b.id = s.book_id and b.status = 'published'
$$;

-- A book as the page reads it, now with its rating (average and count).
create or replace function public.book_card(b public.books)
returns jsonb
language sql
stable
set search_path = public
as $$
  select (to_jsonb(b) - 'search_doc' - 'search_name' - 'import_key') || jsonb_build_object(
    'tag_ids', coalesce((select jsonb_agg(l.tag_id) from public.book_tag_links l where l.book_id = b.id), '[]'::jsonb),
    'secondary_category_ids', coalesce((select jsonb_agg(s.category_id) from public.book_secondary_categories s where s.book_id = b.id), '[]'::jsonb),
    'rating_count', coalesce((select st.rating_count from public.book_stats st where st.book_id = b.id), 0),
    'rating_avg', (select round(st.rating_sum::numeric / st.rating_count, 2) from public.book_stats st
                   where st.book_id = b.id and st.rating_count > 0)
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- books_browse: the "rating" and "trending" orders and "my favourites" (replaces phase 2's)

drop function if exists public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer);

create or replace function public.books_browse(
  p_query text default '',
  p_categories uuid[] default '{}',
  p_levels text[] default '{}',
  p_languages text[] default '{}',
  p_lengths text[] default '{}',
  p_tags uuid[] default '{}',
  p_sort text default null,
  p_context text default null,
  p_seed text default '',
  p_as_of timestamptz default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_favorites boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
set pg_trgm.word_similarity_threshold = 0.5
as $$
declare
  v_at timestamptz := public.books_read_at(p_as_of);
  v_q text := btrim(left(public.book_search_norm(coalesce(p_query, '')), 80));
  v_isbn text := public.book_isbn(p_query);
  v_tsq tsquery;
  v_sort text;
  v_limit integer := case when p_limit = 48 then 48 else 24 end;
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_cats uuid[] := coalesce(p_categories, '{}');
  v_levels text[] := coalesce(p_levels, '{}');
  v_langs text[] := coalesce(p_languages, '{}');
  v_lens text[] := coalesce(p_lengths, '{}');
  v_tags uuid[] := coalesce(p_tags, '{}');
  v_result jsonb;
  v_mean numeric := public.book_rating_mean();
  v_day date := (public.books_read_at(p_as_of) at time zone 'utc')::date;
begin
  if v_q <> '' then
    select to_tsquery('simple', string_agg(quote_literal(w) || ':*', ' & '))
      into v_tsq
      from regexp_split_to_table(v_q, ' ') as w
      where w <> '';
  end if;
  if v_isbn is not null and char_length(v_isbn) < 10 then
    v_isbn := null;
  end if;
  v_sort := coalesce(p_sort, case
    when v_q <> '' then 'relevance'
    when p_context is not null then 'discover'
    else 'new'
  end);
  if v_sort not in ('relevance', 'discover', 'new', 'title', 'short', 'rating', 'trending') then
    v_sort := 'new';
  end if;
  if v_sort = 'relevance' and v_q = '' then
    v_sort := 'new';
  end if;

  with found as (
    select
      b,
      b.id,
      b.created_at,
      b.pages,
      b.title,
      case
        when v_q = '' then 0
        when v_isbn is not null and b.isbn = v_isbn then 3
        when v_tsq is not null and b.search_doc @@ v_tsq then 1 + ts_rank_cd(b.search_doc, v_tsq)
        else word_similarity(v_q, b.search_name) * 0.5
      end as rank,
      case when v_sort = 'rating' then (
        select (s.rating_sum + 10 * v_mean) / (s.rating_count + 10)
        from public.book_stats s where s.book_id = b.id and s.rating_count >= 3)
      end as score,
      case when v_sort = 'trending' then (
        select sum((d.views + 3 * d.reads + 2 * d.favorites) * exp(-ln(2) * (v_day - d.day) / 3.0))
        from public.book_daily d
        where d.book_id = b.id and d.day > v_day - 7 and d.day <= v_day)
      end as trend,
      (select e.position from public.book_editorial e
        where e.book_id = b.id and e.kind = 'pin' and e.context = p_context
          and public.book_in_period(e.starts_at, e.ends_at, v_at)) as pin,
      (cardinality(v_cats) = 0 or b.category_id = any (v_cats) or exists (
        select 1 from public.book_secondary_categories s
        where s.book_id = b.id and s.category_id = any (v_cats))) as m_cat,
      (cardinality(v_levels) = 0 or b.level = any (v_levels)) as m_level,
      (cardinality(v_langs) = 0 or b.language = any (v_langs)) as m_lang,
      (cardinality(v_lens) = 0 or public.book_length(b.pages) = any (v_lens)) as m_len,
      (cardinality(v_tags) = 0 or exists (
        select 1 from public.book_tag_links l where l.book_id = b.id and l.tag_id = any (v_tags))) as m_tag
    from public.books b
    where b.status = 'published'
      and b.created_at <= v_at
      and (not coalesce(p_favorites, false) or exists (
        select 1 from public.book_favorites f where f.book_id = b.id and f.user_id = auth.uid()))
      and (
        v_q = ''
        or (v_tsq is not null and b.search_doc @@ v_tsq)
        or (v_isbn is not null and b.isbn = v_isbn)
        or (char_length(v_q) >= 4 and v_q <% b.search_name)
      )
      and not exists (
        select 1 from public.book_editorial e
        where e.book_id = b.id and e.kind = 'exclude' and e.context = p_context
          and public.book_in_period(e.starts_at, e.ends_at, v_at))
  ),
  hits as (
    select * from found where m_cat and m_level and m_lang and m_len and m_tag
  ),
  ordered as (
    select h.b, h.id, row_number() over (
      order by
        (case when v_sort = 'discover' then coalesce(h.pin, 2147483647) end),
        (case when v_sort = 'discover' then md5(coalesce(p_seed, '') || ':' || h.id) end),
        (case when v_sort = 'relevance' then h.rank end) desc,
        (case when v_sort = 'title' then public.book_key(h.title) end),
        (case when v_sort = 'short' then coalesce(h.pages, 2147483647) end),
        (case when v_sort = 'rating' then h.score end) desc nulls last,
        (case when v_sort = 'trending' then h.trend end) desc nulls last,
        h.created_at desc,
        h.id
    ) as ord
    from hits h
  ),
  page as (
    select o.b, o.id, o.ord
    from ordered o
    where o.ord > v_offset
    order by o.ord
    limit v_limit
  )
  select jsonb_build_object(
    'as_of', v_at,
    'sort', v_sort,
    'limit', v_limit,
    'offset', v_offset,
    'total', (select count(*) from hits),
    'items', coalesce((
      select jsonb_agg(public.book_card(p.b) order by p.ord)
      from page p
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'category', coalesce((
        select jsonb_object_agg(cid, n) from (
          select cid, count(distinct id) as n from (
            select f.id, (f.b).category_id as cid from found f
              where f.m_level and f.m_lang and f.m_len and f.m_tag
            union all
            select f.id, s.category_id from found f
              join public.book_secondary_categories s on s.book_id = f.id
              where f.m_level and f.m_lang and f.m_len and f.m_tag
          ) z where cid is not null group by cid
        ) c), '{}'::jsonb),
      'level', coalesce((
        select jsonb_object_agg(k, n) from (
          select (f.b).level as k, count(*) as n from found f
            where f.m_cat and f.m_lang and f.m_len and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'language', coalesce((
        select jsonb_object_agg(k, n) from (
          select (f.b).language as k, count(*) as n from found f
            where f.m_cat and f.m_level and f.m_len and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'length', coalesce((
        select jsonb_object_agg(k, n) from (
          select public.book_length(f.pages) as k, count(*) as n from found f
            where f.m_cat and f.m_level and f.m_lang and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'tag', coalesce((
        select jsonb_object_agg(k, n) from (
          select l.tag_id as k, count(*) as n from found f
            join public.book_tag_links l on l.book_id = f.id
            where f.m_cat and f.m_level and f.m_lang and f.m_len group by 1
        ) c), '{}'::jsonb)
    )
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- books_popular: the two discover shelves

create or replace function public.books_popular(
  p_as_of timestamptz default null,
  p_per integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select public.books_read_at(p_as_of) as at,
      (public.books_read_at(p_as_of) at time zone 'utc')::date as day,
      least(greatest(coalesce(p_per, 12), 1), 24) as per,
      public.book_rating_mean() as mean
  ),
  live as (
    select b.id from public.books b, params
    where b.status = 'published' and b.created_at <= params.at
      and not exists (
        select 1 from public.book_editorial e
        where e.book_id = b.id and e.context = 'discover' and e.kind = 'exclude'
          and public.book_in_period(e.starts_at, e.ends_at, params.at))
  ),
  rated as (
    select l.id, (s.rating_sum + 10 * p.mean) / (s.rating_count + 10) as score, s.rating_count
    from live l
    join public.book_stats s on s.book_id = l.id and s.rating_count >= 3
    cross join params p
  ),
  trending as (
    select d.book_id as id,
      sum((d.views + 3 * d.reads + 2 * d.favorites) * exp(-ln(2) * (p.day - d.day) / 3.0)) as score
    from public.book_daily d
    cross join params p
    where d.book_id in (select id from live) and d.day > p.day - 7 and d.day <= p.day
    group by d.book_id
    having sum(d.views + d.reads + d.favorites) > 0
  ),
  top_rated as (
    select id, row_number() over (order by score desc, rating_count desc, id) as n from rated
  ),
  top_trending as (
    select id, row_number() over (order by score desc, id) as n from trending
  ),
  wanted as (
    select id from top_rated where n <= (select per from params)
    union select id from top_trending where n <= (select per from params)
  )
  select jsonb_build_object(
    'as_of', (select at from params),
    'top_rated', coalesce((select jsonb_agg(id order by n) from top_rated where n <= (select per from params)), '[]'::jsonb),
    'trending', coalesce((select jsonb_agg(id order by n) from top_trending where n <= (select per from params)), '[]'::jsonb),
    'books', coalesce((
      select jsonb_object_agg(b.id, public.book_card(b))
      from public.books b where b.id in (select id from wanted)), '{}'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- What a signed-in reader does

-- Records that the reader opened ("view") or started ("read") a published book; once a day.
create or replace function public.books_track(p_book uuid, p_kind text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or p_kind not in ('view', 'read') or not public.book_is_published(p_book) then
    return false;
  end if;
  insert into public.book_events (book_id, user_id, kind) values (p_book, auth.uid(), p_kind)
    on conflict do nothing;
  return found;
end;
$$;

-- Sets (1–5) or removes (null) the reader's rating; returns the book's new numbers.
create or replace function public.books_rate(p_book uuid, p_rating integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;
  if p_rating is null then
    delete from public.book_ratings where user_id = auth.uid() and book_id = p_book;
  else
    if p_rating not between 1 and 5 then
      raise exception 'rating_out_of_range' using errcode = '22023';
    end if;
    insert into public.book_ratings (user_id, book_id, rating) values (auth.uid(), p_book, p_rating)
      on conflict (user_id, book_id) do update set rating = excluded.rating, updated_at = now();
  end if;
  return jsonb_build_object(
    'rating', p_rating,
    'rating_count', coalesce((select rating_count from public.book_stats where book_id = p_book), 0),
    'rating_avg', (select round(rating_sum::numeric / rating_count, 2) from public.book_stats
                   where book_id = p_book and rating_count > 0));
end;
$$;

-- Adds the book to the reader's favourites (p_on) or takes it off.
create or replace function public.books_favorite(p_book uuid, p_on boolean)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;
  if p_on then
    insert into public.book_favorites (user_id, book_id) values (auth.uid(), p_book) on conflict do nothing;
  else
    delete from public.book_favorites where user_id = auth.uid() and book_id = p_book;
  end if;
  return p_on;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- books_analytics: the admin's numbers for the last p_days days and the days before them

create or replace function public.books_analytics(p_days integer default 7)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_days integer := case when p_days in (7, 30) then p_days else 7 end;
  v_today date := (now() at time zone 'utc')::date;
  v_from date := v_today - v_days + 1;
  v_prev date := v_today - 2 * v_days + 1;
  v_mean numeric;
begin
  perform public.books_require_admin();
  v_mean := public.book_rating_mean();
  return jsonb_build_object(
    'days', v_days,
    'now', (select jsonb_build_object(
        'views', coalesce(sum(views), 0), 'reads', coalesce(sum(reads), 0),
        'favorites', coalesce(sum(favorites), 0), 'ratings', coalesce(sum(ratings), 0))
      from public.book_daily where day between v_from and v_today),
    'before', (select jsonb_build_object(
        'views', coalesce(sum(views), 0), 'reads', coalesce(sum(reads), 0),
        'favorites', coalesce(sum(favorites), 0), 'ratings', coalesce(sum(ratings), 0))
      from public.book_daily where day between v_prev and v_from - 1),
    'trending', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'score', round(score::numeric, 2),
                                          'views', views, 'reads', reads) order by score desc)
      from (
        select b.id, b.title,
          sum((d.views + 3 * d.reads + 2 * d.favorites) * exp(-ln(2) * (v_today - d.day) / 3.0)) as score,
          sum(d.views) as views, sum(d.reads) as reads
        from public.book_daily d join public.books b on b.id = d.book_id and b.status = 'published'
        where d.day > v_today - 7
        group by b.id, b.title
        order by score desc
        limit 10
      ) t), '[]'::jsonb),
    'top_rated', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'score', round(score, 2),
                                          'average', average, 'count', rating_count) order by score desc)
      from (
        select b.id, b.title, s.rating_count,
          round(s.rating_sum::numeric / s.rating_count, 2) as average,
          (s.rating_sum + 10 * v_mean) / (s.rating_count + 10) as score
        from public.book_stats s join public.books b on b.id = s.book_id and b.status = 'published'
        where s.rating_count >= 3
        order by score desc
        limit 10
      ) t), '[]'::jsonb),
    'stars', (select jsonb_build_object(
        '1', count(*) filter (where rating = 1), '2', count(*) filter (where rating = 2),
        '3', count(*) filter (where rating = 3), '4', count(*) filter (where rating = 4),
        '5', count(*) filter (where rating = 5))
      from public.book_ratings r join public.books b on b.id = r.book_id and b.status = 'published'),
    'unopened_count', (select count(*) from public.books b
      where b.status = 'published' and not exists (
        select 1 from public.book_daily d where d.book_id = b.id and d.day between v_from and v_today and d.views > 0)),
    'unopened', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title) order by title)
      from (
        select b.id, b.title from public.books b
        where b.status = 'published' and not exists (
          select 1 from public.book_daily d where d.book_id = b.id and d.day between v_from and v_today and d.views > 0)
        order by b.title
        limit 20
      ) t), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer, boolean) from public;
grant execute on function public.books_browse(text, uuid[], text[], text[], text[], uuid[], text, text, text, timestamptz, integer, integer, boolean) to anon, authenticated;
revoke all on function public.books_popular(timestamptz, integer) from public;
grant execute on function public.books_popular(timestamptz, integer) to anon, authenticated;
-- A visitor's books_track simply answers false (nothing is recorded).
revoke all on function public.books_track(uuid, text) from public;
grant execute on function public.books_track(uuid, text) to anon, authenticated;
revoke all on function public.books_rate(uuid, integer), public.books_favorite(uuid, boolean),
  public.books_analytics(integer) from public, anon;
grant execute on function public.books_rate(uuid, integer), public.books_favorite(uuid, boolean),
  public.books_analytics(integer) to authenticated;
grant execute on function public.book_is_published(uuid), public.book_rating_mean() to anon, authenticated;
```

## الملحق 8 — حد الـ PDF ‏500 ميغا

`supabase/migrations/20261112120000_books_pdf_limit.sql`

```sql
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
```

## الملحق 9 — القارئ (صفحة صفحة)

`supabase/migrations/20261113120000_books_reader.sql`

```sql
-- Library, the reader: a book is read page by page, never as one big PDF download.
--
-- When the admin prepares a book («جهّز الكتاب للقراءة»), their own browser opens the PDF once,
-- turns every page into a light picture (WebP, or JPEG where the browser cannot make WebP) and
-- reads the page's words with where each one sits. The pictures go to the private bucket
-- book-pages under "<book id>/", one row per page goes to book_pages. A reader then loads only
-- the page they look at (and the next one), and the words lie over the picture so they can be
-- chosen and sent to Rita's circle.
--
--   book_pages            one row per prepared page (picture, size, words and their places)
--   books.page_count      how many pages the PDF has (set when preparing starts)
--   books.prepared_at     set once every page is in; the reader opens only then
--   book_reading_progress the page each reader stopped at (their own rows only)
--   book_study_requests   what readers asked the circle, written only by books_take_study_quota
--
-- Replacing a book's PDF clears its pages and prepared_at (the old pages belong to the old PDF).
-- Everything here only adds, and the file can be run again safely.

-- ---------------------------------------------------------------------------------------------
-- The book's own numbers

alter table public.books add column if not exists page_count integer;
alter table public.books add column if not exists prepared_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_page_count_range') then
    alter table public.books add constraint books_page_count_range
      check (page_count is null or page_count between 1 and 5000);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The pages

create table if not exists public.book_pages (
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  -- The picture's size in pixels (its shape is the page's shape).
  width integer not null check (width between 16 and 6000),
  height integer not null check (height between 16 and 6000),
  image_path text not null check (char_length(image_path) between 3 and 300),
  -- The page's words in reading order, and each piece of text with its place on the page:
  -- [text, left, top, width, height], the four numbers as parts of the page (0 to 1).
  text text not null default '' check (char_length(text) <= 60000),
  runs jsonb not null default '[]'::jsonb check (jsonb_typeof(runs) = 'array'),
  has_text boolean generated always as (char_length(btrim(text)) > 0) stored,
  created_at timestamptz not null default now(),
  primary key (book_id, page)
);

alter table public.book_pages enable row level security;

drop policy if exists "readers read pages of published books" on public.book_pages;
create policy "readers read pages of published books" on public.book_pages
  for select to authenticated
  using (public.book_is_published(book_id) or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "admins manage book pages" on public.book_pages;
create policy "admins manage book pages" on public.book_pages
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_pages from anon;
grant select, insert, update, delete on public.book_pages to authenticated;

-- A new PDF means new pages: the old ones go, and the book waits to be prepared again.
create or replace function public.books_reader_reset()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.file_path is distinct from old.file_path then
    delete from public.book_pages where book_id = new.id;
    new.prepared_at := null;
    new.page_count := null;
  end if;
  return new;
end;
$$;

drop trigger if exists books_reader_reset on public.books;
create trigger books_reader_reset
  before update of file_path on public.books
  for each row execute function public.books_reader_reset();

-- ---------------------------------------------------------------------------------------------
-- The pictures: a private bucket, read with links made from the reader's own session

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-pages', 'book-pages', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "admins manage book pages pictures" on storage.objects;
create policy "admins manage book pages pictures" on storage.objects
  for all to authenticated
  using (bucket_id = 'book-pages' and public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (bucket_id = 'book-pages' and public.has_role(auth.uid(), 'admin'::public.app_role));

-- A signed-in reader may open the pictures under "<book id>/" of a published book.
drop policy if exists "readers open pages of published books" on storage.objects;
create policy "readers open pages of published books" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'book-pages'
    and exists (
      select 1 from public.books b
      where b.id::text = split_part(storage.objects.name, '/', 1) and b.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Where each reader stopped

create table if not exists public.book_reading_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.book_reading_progress enable row level security;

drop policy if exists "readers read their place" on public.book_reading_progress;
create policy "readers read their place" on public.book_reading_progress
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "readers keep their place" on public.book_reading_progress;
create policy "readers keep their place" on public.book_reading_progress
  for insert to authenticated
  with check (user_id = auth.uid() and public.book_is_published(book_id));

drop policy if exists "readers move their place" on public.book_reading_progress;
create policy "readers move their place" on public.book_reading_progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.book_is_published(book_id));

drop policy if exists "readers forget their place" on public.book_reading_progress;
create policy "readers forget their place" on public.book_reading_progress
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.book_reading_progress from anon;
grant select, insert, update, delete on public.book_reading_progress to authenticated;

-- ---------------------------------------------------------------------------------------------
-- What readers ask Rita's circle about a page (limits like the lessons' study page)

create table if not exists public.book_study_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  action text not null check (char_length(action) between 1 and 40),
  quota_group text not null check (quota_group in ('explain', 'practice', 'cards')),
  selection_len integer not null default 0 check (selection_len between 0 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists book_study_requests_quota
  on public.book_study_requests (user_id, quota_group, created_at desc);

alter table public.book_study_requests enable row level security;

drop policy if exists "readers read their book requests" on public.book_study_requests;
create policy "readers read their book requests" on public.book_study_requests
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_study_requests from anon;
revoke insert, update, delete on public.book_study_requests from authenticated;
grant select on public.book_study_requests to authenticated;

-- The same generous limits as rita_study_take_quota (src/lib/study/study-limits.ts; a test keeps
-- them equal). A day starts at midnight in Amman. Admins are never limited.
create or replace function public.books_take_study_quota(
  p_request uuid,
  p_book uuid,
  p_page integer,
  p_action text,
  p_group text,
  p_selection_len integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  admin boolean;
  per_min integer;
  per_day integer;
  used_min integer;
  used_day integer;
  day_start timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if p_request is null or p_book is null or p_page is null or p_page not between 1 and 5000
    or char_length(coalesce(p_action, '')) not between 1 and 40 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  admin := public.has_role(uid, 'admin'::public.app_role);
  if not admin and not public.book_is_published(p_book) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  case p_group
    when 'explain' then
      per_min := 20;
      per_day := 400;
    when 'practice' then
      per_min := 4;
      per_day := 40;
    when 'cards' then
      per_min := 6;
      per_day := 60;
    else
      return jsonb_build_object('ok', false, 'code', 'bad_request');
  end case;

  if not admin then
    -- One reader's requests are counted one at a time.
    perform pg_advisory_xact_lock(hashtext('books_study_quota:' || uid::text));
    day_start := date_trunc('day', now() at time zone 'Asia/Amman') at time zone 'Asia/Amman';
    select
      count(*) filter (where created_at > now() - interval '1 minute'),
      count(*) filter (where created_at >= day_start)
    into used_min, used_day
    from public.book_study_requests
    where user_id = uid
      and quota_group = p_group
      and created_at >= least(day_start, now() - interval '1 minute');
    if used_day >= per_day then
      return jsonb_build_object(
        'ok', false, 'code', 'rate_limited', 'scope', 'day',
        'retry_after', ceil(extract(epoch from (day_start + interval '1 day' - now())))::integer
      );
    end if;
    if used_min >= per_min then
      return jsonb_build_object('ok', false, 'code', 'rate_limited', 'scope', 'minute', 'retry_after', 60);
    end if;
  end if;

  insert into public.book_study_requests (request_id, user_id, book_id, page, action, quota_group, selection_len)
  values (p_request, uid, p_book, p_page, p_action, p_group,
          greatest(0, least(coalesce(p_selection_len, 0), 4000)))
  on conflict (request_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.books_take_study_quota(uuid, uuid, integer, text, text, integer) from public;
grant execute on function public.books_take_study_quota(uuid, uuid, integer, text, text, integer) to authenticated;
```

## الملحق 10 — وصول الزوار للمكتبة الجديدة — بعد 1–9 دايماً

`supabase/migrations/20261114120000_books_visitor_access.sql`

```sql
-- Run AFTER the library phase 1/2/3 and PDF-limit migrations.
-- Preserve authenticated/admin policies, but give anon separate reader expressions
-- which never execute the protected has_role function. No private-user-table grants,
-- no security-definer functions, no storage policy changes or scheduled work.

alter policy "published books are readable" on public.books to authenticated;
drop policy if exists "visitors read published books" on public.books;
create policy "visitors read published books" on public.books
  for select to anon using (status = 'published');

alter policy "visible shelves are readable" on public.book_shelves to authenticated;
drop policy if exists "visitors read visible shelves" on public.book_shelves;
create policy "visitors read visible shelves" on public.book_shelves
  for select to anon using (visible);

alter policy "readers see rules in force" on public.book_editorial to authenticated;
drop policy if exists "visitors read rules in force" on public.book_editorial;
create policy "visitors read rules in force" on public.book_editorial
  for select to anon using (
    (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
  );

alter policy "numbers of published books are public" on public.book_stats to authenticated;
drop policy if exists "visitors read published book numbers" on public.book_stats;
create policy "visitors read published book numbers" on public.book_stats
  for select to anon using (public.book_is_published(book_id));

alter policy "daily numbers of published books are public" on public.book_daily to authenticated;
drop policy if exists "visitors read published daily numbers" on public.book_daily;
create policy "visitors read published daily numbers" on public.book_daily
  for select to anon using (public.book_is_published(book_id));

-- Visitors may page through a past snapshot but never preview a future one.
-- CASE keeps anon out of has_role; a boolean OR is not an execution guard.
create or replace function public.books_read_at(p_as_of timestamptz)
returns timestamptz
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when p_as_of is null then now()
    when auth.uid() is null then least(p_as_of, now())
    when public.has_role(auth.uid(), 'admin'::public.app_role) then p_as_of
    else least(p_as_of, now())
  end
$$;

create or replace function public.books_browse(
  p_query text default '',
  p_categories uuid[] default '{}',
  p_levels text[] default '{}',
  p_languages text[] default '{}',
  p_lengths text[] default '{}',
  p_tags uuid[] default '{}',
  p_sort text default null,
  p_context text default null,
  p_seed text default '',
  p_as_of timestamptz default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_favorites boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
set pg_trgm.word_similarity_threshold = 0.5
as $$
declare
  v_at timestamptz := public.books_read_at(p_as_of);
  v_q text := btrim(left(public.book_search_norm(coalesce(p_query, '')), 80));
  v_isbn text := public.book_isbn(p_query);
  v_tsq tsquery;
  v_sort text;
  v_limit integer := case when p_limit = 48 then 48 else 24 end;
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_cats uuid[] := coalesce(p_categories, '{}');
  v_levels text[] := coalesce(p_levels, '{}');
  v_langs text[] := coalesce(p_languages, '{}');
  v_lens text[] := coalesce(p_lengths, '{}');
  v_tags uuid[] := coalesce(p_tags, '{}');
  v_favorite_ids uuid[] := '{}';
  v_result jsonb;
  v_mean numeric := public.book_rating_mean();
  v_day date := (public.books_read_at(p_as_of) at time zone 'utc')::date;
begin
  -- Private favourites are queried only for a signed-in favourites request. Even a
  -- short-circuited EXISTS in the main query requires table rights at plan time.
  if coalesce(p_favorites, false) and auth.uid() is not null then
    select coalesce(array_agg(f.book_id), '{}'::uuid[]) into v_favorite_ids
    from public.book_favorites f where f.user_id = auth.uid();
  end if;
  if v_q <> '' then
    select to_tsquery('simple', string_agg(quote_literal(w) || ':*', ' & '))
      into v_tsq
      from regexp_split_to_table(v_q, ' ') as w
      where w <> '';
  end if;
  if v_isbn is not null and char_length(v_isbn) < 10 then
    v_isbn := null;
  end if;
  v_sort := coalesce(p_sort, case
    when v_q <> '' then 'relevance'
    when p_context is not null then 'discover'
    else 'new'
  end);
  if v_sort not in ('relevance', 'discover', 'new', 'title', 'short', 'rating', 'trending') then
    v_sort := 'new';
  end if;
  if v_sort = 'relevance' and v_q = '' then
    v_sort := 'new';
  end if;

  with found as (
    select
      b,
      b.id,
      b.created_at,
      b.pages,
      b.title,
      case
        when v_q = '' then 0
        when v_isbn is not null and b.isbn = v_isbn then 3
        when v_tsq is not null and b.search_doc @@ v_tsq then 1 + ts_rank_cd(b.search_doc, v_tsq)
        else word_similarity(v_q, b.search_name) * 0.5
      end as rank,
      case when v_sort = 'rating' then (
        select (s.rating_sum + 10 * v_mean) / (s.rating_count + 10)
        from public.book_stats s where s.book_id = b.id and s.rating_count >= 3)
      end as score,
      case when v_sort = 'trending' then (
        select sum((d.views + 3 * d.reads + 2 * d.favorites) * exp(-ln(2) * (v_day - d.day) / 3.0))
        from public.book_daily d
        where d.book_id = b.id and d.day > v_day - 7 and d.day <= v_day)
      end as trend,
      (select e.position from public.book_editorial e
        where e.book_id = b.id and e.kind = 'pin' and e.context = p_context
          and public.book_in_period(e.starts_at, e.ends_at, v_at)) as pin,
      (cardinality(v_cats) = 0 or b.category_id = any (v_cats) or exists (
        select 1 from public.book_secondary_categories s
        where s.book_id = b.id and s.category_id = any (v_cats))) as m_cat,
      (cardinality(v_levels) = 0 or b.level = any (v_levels)) as m_level,
      (cardinality(v_langs) = 0 or b.language = any (v_langs)) as m_lang,
      (cardinality(v_lens) = 0 or public.book_length(b.pages) = any (v_lens)) as m_len,
      (cardinality(v_tags) = 0 or exists (
        select 1 from public.book_tag_links l where l.book_id = b.id and l.tag_id = any (v_tags))) as m_tag
    from public.books b
    where b.status = 'published'
      and b.created_at <= v_at
      and (not coalesce(p_favorites, false) or b.id = any (v_favorite_ids))
      and (
        v_q = ''
        or (v_tsq is not null and b.search_doc @@ v_tsq)
        or (v_isbn is not null and b.isbn = v_isbn)
        or (char_length(v_q) >= 4 and v_q <% b.search_name)
      )
      and not exists (
        select 1 from public.book_editorial e
        where e.book_id = b.id and e.kind = 'exclude' and e.context = p_context
          and public.book_in_period(e.starts_at, e.ends_at, v_at))
  ),
  hits as (
    select * from found where m_cat and m_level and m_lang and m_len and m_tag
  ),
  ordered as (
    select h.b, h.id, row_number() over (
      order by
        (case when v_sort = 'discover' then coalesce(h.pin, 2147483647) end),
        (case when v_sort = 'discover' then md5(coalesce(p_seed, '') || ':' || h.id) end),
        (case when v_sort = 'relevance' then h.rank end) desc,
        (case when v_sort = 'title' then public.book_key(h.title) end),
        (case when v_sort = 'short' then coalesce(h.pages, 2147483647) end),
        (case when v_sort = 'rating' then h.score end) desc nulls last,
        (case when v_sort = 'trending' then h.trend end) desc nulls last,
        h.created_at desc,
        h.id
    ) as ord
    from hits h
  ),
  page as (
    select o.b, o.id, o.ord
    from ordered o
    where o.ord > v_offset
    order by o.ord
    limit v_limit
  )
  select jsonb_build_object(
    'as_of', v_at,
    'sort', v_sort,
    'limit', v_limit,
    'offset', v_offset,
    'total', (select count(*) from hits),
    'items', coalesce((
      select jsonb_agg(public.book_card(p.b) order by p.ord)
      from page p
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'category', coalesce((
        select jsonb_object_agg(cid, n) from (
          select cid, count(distinct id) as n from (
            select f.id, (f.b).category_id as cid from found f
              where f.m_level and f.m_lang and f.m_len and f.m_tag
            union all
            select f.id, s.category_id from found f
              join public.book_secondary_categories s on s.book_id = f.id
              where f.m_level and f.m_lang and f.m_len and f.m_tag
          ) z where cid is not null group by cid
        ) c), '{}'::jsonb),
      'level', coalesce((
        select jsonb_object_agg(k, n) from (
          select (f.b).level as k, count(*) as n from found f
            where f.m_cat and f.m_lang and f.m_len and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'language', coalesce((
        select jsonb_object_agg(k, n) from (
          select (f.b).language as k, count(*) as n from found f
            where f.m_cat and f.m_level and f.m_len and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'length', coalesce((
        select jsonb_object_agg(k, n) from (
          select public.book_length(f.pages) as k, count(*) as n from found f
            where f.m_cat and f.m_level and f.m_lang and f.m_tag group by 1
        ) c), '{}'::jsonb),
      'tag', coalesce((
        select jsonb_object_agg(k, n) from (
          select l.tag_id as k, count(*) as n from found f
            join public.book_tag_links l on l.book_id = f.id
            where f.m_cat and f.m_level and f.m_lang and f.m_len group by 1
        ) c), '{}'::jsonb)
    )
  ) into v_result;
  return v_result;
end;
$$;
```

## الملحق 11 — القارئ: أحجام الصفحات، المعاينة، الفهرس

`supabase/migrations/20261115120000_books_reader_tiers.sql`

```sql
-- Library, the reader (page-pane plan, phase 2): more sizes of each page picture, an instant
-- blurred placeholder, and one small "manifest" per book, all made once when the admin prepares
-- the book.
--
--   book_pages.thumb_path / mid_path / zoom_path   160 / 900 / 2200 px pictures beside the
--                                                  existing 1400 px one (image_path)
--   book_pages.thumbhash                           a ~25-byte blurred preview (base64)
--   book_pages.color                               the page's main colour (#rrggbb)
--   book_manifests                                 one row per book: every page's size, sizes
--                                                  available and preview, the outline (chapters)
--                                                  and the reading direction, read in one request
--
-- The manifest lives in its own table, not on `books`: book cards are built from the whole books
-- row (to_jsonb), and a manifest can be 200 KB. Same readers as the pages: signed-in readers of
-- published books, and admins. Replacing a book's PDF removes its manifest with its pages.
-- Everything here only adds, and the file can be run again safely.

alter table public.book_pages add column if not exists thumb_path text;
alter table public.book_pages add column if not exists mid_path text;
alter table public.book_pages add column if not exists zoom_path text;
alter table public.book_pages add column if not exists thumbhash text;
alter table public.book_pages add column if not exists color text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'book_pages_tier_paths') then
    alter table public.book_pages add constraint book_pages_tier_paths check (
      (thumb_path is null or char_length(thumb_path) between 3 and 300)
      and (mid_path is null or char_length(mid_path) between 3 and 300)
      and (zoom_path is null or char_length(zoom_path) between 3 and 300)
      and (thumbhash is null or thumbhash ~ '^[A-Za-z0-9+/=]{4,64}$')
      and (color is null or color ~ '^#[0-9a-f]{6}$')
    );
  end if;
end;
$$;

create table if not exists public.book_manifests (
  book_id uuid primary key references public.books (id) on delete cascade,
  -- [[width, height, flags, ext, thumbhash, color], …] for pages 1..n (flags: 1 words,
  -- 2 thumb, 4 phone size, 8 zoom size; ext "w" WebP or "j" JPEG).
  pages jsonb not null check (jsonb_typeof(pages) = 'array'),
  -- [[title, page, level], …] from the PDF's own outline, or [].
  outline jsonb not null default '[]'::jsonb check (jsonb_typeof(outline) = 'array'),
  dir text not null default 'ltr' check (dir in ('ltr', 'rtl')),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.book_manifests enable row level security;

drop policy if exists "readers read manifests of published books" on public.book_manifests;
create policy "readers read manifests of published books" on public.book_manifests
  for select to authenticated
  using (public.book_is_published(book_id) or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "admins manage book manifests" on public.book_manifests;
create policy "admins manage book manifests" on public.book_manifests
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

revoke all on public.book_manifests from anon;
grant select, insert, update, delete on public.book_manifests to authenticated;

-- A new PDF means new pages: the old pages and manifest go, and the book waits to be prepared.
create or replace function public.books_reader_reset()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.file_path is distinct from old.file_path then
    delete from public.book_pages where book_id = new.id;
    delete from public.book_manifests where book_id = new.id;
    new.prepared_at := null;
    new.page_count := null;
  end if;
  return new;
end;
$$;
```
