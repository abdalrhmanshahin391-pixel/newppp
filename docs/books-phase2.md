# Library — phase 2 (discovery)

ملخص: المرحلة الثانية فيها البحث الحقيقي من قاعدة البيانات (بالأولوية للعنوان، وبيتحمّل
الأغلاط الصغيرة والهمزات)، الفلاتر المتعددة مع أعدادها، الصفحات (24 أو 48)، أربع طرق للتصفح
(اكتشف، كل الكتب، البحث، التصنيف)، «مختارات لك» بترتيب ثابت للزيارة مع «اقتراحات جديدة»،
والتثبيت والاستبعاد للأدمن مع المعاينة.

## What changed

| Area | Files |
| --- | --- |
| Database | `supabase/migrations/20261110120000_books_discovery.sql` (additive, safe to run twice) |
| Database tests | `supabase/tests/books/20_books_phase2_test.sql` (pgTAP, 63 checks) |
| Rules (pure) | `src/lib/books.ts` (the address state, modes, OR/AND filters, facet counts, seeded order — the same rules as the database, used as a fallback) |
| Data | `src/lib/books-data.ts` (`loadDiscover`, `browseBooks`, `loadCatalog`, pins and exclusions) |
| Library page | `src/components/books/LibraryPage.tsx`, `src/routes/books.tsx` |
| Admin | `src/components/books/admin/EditorialRules.tsx`, `ArrangeTab.tsx` |

### Database (migration `20261110120000_books_discovery.sql`)

- `pg_trgm` (in the `extensions` schema; nothing changes if it is already installed).
- `books.search_name` and `books.search_doc`, refreshed by triggers when a book, its tags or a
  tag's name change. Weights: title and alternate title A, author B, tags C, description D. The
  text ignores case, accents, Arabic diacritics, tatweel and the hamza forms of alef; the taa
  marbuta is kept. GIN indexes on both (`books_search_doc`, `books_search_name_trgm`).
- `books_browse(...)`: search (every word as a word start; a full ISBN; a word of four letters or
  more with a small typo), filters (category including secondary categories, level, language,
  length, tag: OR inside a group, AND between groups), facet counts that ignore their own group,
  sort (best match, recommended, newest, title, shortest), pages of 24 or 48, a seeded
  recommended order (`md5(seed || ':' || id)`), pins first and exclusions hidden in the place they
  are set, and a snapshot time (`as_of`) that keeps the pages of one list steady.
- `books_discover(...)`: the discover page in one call (book of the week, the admin's shelves,
  12 picks, 12 newest, one shelf per category with its count, books without a category).
- `book_editorial`: one rule per book and place (`discover` or a category), pin (with an order) or
  exclude, with an optional period. Readers only see rules in force; admins manage them. A
  deleted category takes its rules with it.
- Both calls run with the caller's rights: only published books, ever. A reader's `as_of` is never
  later than now; an admin can preview another time.
- Nothing runs on a timer; no new Edge Function.

### Page

- Four ways in: «اكتشف», «كل الكتب», a search, a category. Everything is in the address
  (`?q=&cat=a,b&level=B1,B2&lang=&len=&tag=&sort=&view=all&page=&size=`); older links such as
  `?cat=<id>&level=B1` still work.
- Searching happens on «ابحث» or Enter only (no timer while typing). A newer request cancels the
  older one, so an old answer never replaces a new one.
- Without the phase 2 migration the page loads the library once and applies the same rules in
  the browser; admins see a dashed notice.

## Checks

- `scripts/test-books-db.sh`: phase 1 (65) and phase 2 (63) pgTAP checks on the real migrations,
  each applied twice. Phase 2 covers: title above description, title above author, every word,
  a typo, the alef hamza, the taa marbuta, a full ISBN, tags, a query of only symbols, drafts never
  found (visitor, learner, admin's reader view), OR/AND, secondary categories, lengths, tags,
  facet counts, pages of 24/48 that do not overlap, the snapshot, a visitor cannot read the future,
  the seeded order, pins and their order, exclusions, a pin inside a category, rule periods
  (visitor vs. admin preview), the discover call, tag renames and removals refreshing the search,
  deleting a tagged book, deleting a category with rules, and a timed run on 1000+ books.
- Node tests: `src/lib/books.test.ts` (17), `src/lib/books-import.test.ts` (5) and the rest of
  the CI list; `tsc`; the build.
- Chromium and WebKit, iPad and phone, with a mocked Supabase: typing alone sends nothing and
  Enter searches; two levels are sent as one OR group; a category sends its own place; page 2
  reuses page 1's snapshot time; the back button returns to the list; «اقتراحات جديدة» draws a new
  order; the admin's pins and exclusions; and the fallback when the calls are missing.

Not tested here: the real database's speed with its own data (the 1000-book run is on a local
Postgres 16), and Arabic search quality on real titles.
