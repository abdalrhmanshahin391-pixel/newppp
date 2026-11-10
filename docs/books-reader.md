# Library — the reader

ملخص: القارئ بيقرأ الكتاب جوّا الموقع صفحة صفحة، بنفس تصميم الدراسة التفاعلية (ريتا عالشمال
والصفحة عاليمين، والدائرة فوقهم). ما بينزل ملف الـ PDF أبداً: بس الصفحة اللي بيقرأها (صورة خفيفة
~٥٠–١٠٠ كيلو) واللي بعدها. فوق الصورة في نص شفاف بنفس مكان الكلمات، فبيقدر يحدد كلمة أو جملة
ويطلب من الدائرة: اشرحلي، معنى ونطق، فكّك الجملة، ليش هيك؟، بالعربي، فلاش كاردز، تمارين اختيار.
التجهيز بيصير مرة وحدة من متصفح الأدمن، بدون أي مهمة على السيرفر وبدون Edge Function.

## What changed

| Area | Files |
| --- | --- |
| Database | `supabase/migrations/20261113120000_books_reader.sql` (additive, safe to run twice) |
| Database tests | `supabase/tests/books/50_books_reader_test.sql` (pgTAP, 43 checks) |
| Rules (pure) | `src/lib/books-reader.ts` (words and places from pdf.js, the selection check, the quote and its context, kinds of selection), tested by `books-reader.test.ts` |
| Preparing (admin, browser) | `src/lib/book-prepare.ts`, `openPdfInParts` in `src/lib/pdf-page-render.ts`, `src/components/books/admin/ReaderPrepare.tsx`, `BookEditor.tsx`, `ImportTab.tsx` |
| Reading | `src/routes/books_.$bookId.read.tsx`, `src/components/books/reader/*`, `src/lib/book-reader-data.ts`, `BookSheet.tsx` |
| The circle on a page | `src/lib/books-study.functions.ts` (server functions) |

### Database

- `book_pages`: one row per prepared page — picture size, picture path, the page's text, and the
  pieces of text with their places (`runs`: `[text, left, top, width, height]` as parts of the
  page), `has_text`. Signed-in readers read pages of published books; admins write.
- `books.page_count`, `books.prepared_at`: the reader opens a book only once `prepared_at` is set.
  Replacing the PDF clears both and the old pages (trigger `books_reader_reset`).
- Private bucket `book-pages` (WebP or JPEG, 5 MB each), pictures under `<book id>/`. Signed-in
  readers may open the pictures of published books (with signed links made from their own
  session, an hour each); admins manage them.
- `book_reading_progress`: the page each reader stopped at (their own row only, published books).
- `book_study_requests` + `books_take_study_quota(...)`: the circle's requests on books, with the
  same generous limits as the lessons (a test keeps the numbers equal); written only through the
  function; admins are never limited.

### Preparing a book

- The admin's browser opens the PDF in parts (pdf.js range requests from a signed link, or slices
  of the file just picked), so even a 500 MB book is never held in memory at once.
- Each page is drawn at 1400 px wide, saved as WebP (JPEG where the browser cannot make WebP,
  such as Safari), lowered in quality if it is over 4.5 MB, uploaded, and its row written. Two
  uploads run while the next page is drawn.
- Stopping (or closing the tab) keeps what is done: «كمّل التجهيز» continues with the missing
  pages. «جهّز مرة ثانية» removes the old pages first. A newly uploaded PDF starts preparing on save.
- Measured (Chromium, desktop): 4 test pages in 1.7–3 s; an 80-slide deck with photos in 10 s,
  60 KB per page on average (86 KB at most).

### Reading

- Zoom in five steps; arrows / Page Up / Page Down turn pages; the place is saved after a second on
  a page, at once when the tab is hidden, and kept in the address (`?page=`).

### Loading (the page-pane plan, phase 1)

From `docs/books-reader-research/` and the plan "A Fast, Smooth and Beautiful Page Pane":

- **Light and heavy apart.** A page's light info (size, picture path, has-text) is read 40 pages
  per request; its words (`text`, `runs`) are read separately, so the picture never waits for them.
- **Links signed in batches and reused.** The page and the 40 around it (30 ahead, 10 behind) are
  signed in one `createSignedUrls` call, for 6 hours, kept per tab in `sessionStorage` (per
  signed-in user; cleared on sign-out; never `localStorage`) and reused until 10 minutes before
  they end — the same address each time, so the browser can reuse what it fetched. A new batch is
  signed only when fewer than 10 pages ahead have a link.
- **Fetched ahead in the reading direction**, once the reader has stayed 150 ms on a page:
  pictures +3 ahead and 1 behind (+5 while skimming — the last turns under 8 s apart; +1 when the
  last picture took over 1.5 s), words +2 / −1. The pages right beside are also decoded; at most 3
  decoded pages are kept (5 on a desktop). Requests for pages flipped past are cancelled. The page
  shown is fetched with `fetchpriority="high"`, the others low.
- **Measured** (Chromium, 80-page book, 250 ms added to every request): next page 64–117 ms
  (before 70–240), a jump to page 40 586–594 ms (before 830), five quick taps — the last page sharp
  0.46 s after the last tap (before 1.4 s after the first); no signing request on a normal turn.

### Sizes, previews and the manifest (the page-pane plan, phase 2)

Migration `20261115120000_books_reader_tiers.sql`, then each book prepared again («حدّث الكتاب»):

- **Four sizes of each page:** 160 px (`t/`, for a later thumbnail strip), 900 px (`m/`, phones),
  1400 px (the existing picture) and 2200 px (`z/`, zooming on sharp screens). The reader asks for
  the smallest size at least 90% as wide as the sheet × the screen's density (zoom included). An
  admin preparing on an iPad or a phone makes 160/900/1400 only (2200 px canvases are what makes
  Safari close the tab); a computer makes all four.
- **A preview of every page:** a ThumbHash (~28 characters) and the page's main colour, kept in
  the row and the manifest. A page not in yet shows its blurred preview (10 px blur) on a sheet of
  its colour, instead of a blank sheet; books prepared before this keep the ghost text.
- **One manifest per book** (`book_manifests`, its own table because book cards are built from the
  whole books row): every page's size, which sizes exist, picture type, preview and colour, the
  PDF's outline `[[title, page, level]]` and the reading direction. One request when the book
  opens; without it (older books, or before the migration) pages load the phase 1 way.
- **Pictures kept across visits:** Cache Storage `uzyra-pages-v1`, keyed by the picture's path (not
  its signed link, which changes), the last 300 pages, emptied on sign-out. Where it cannot be
  used (no Cache Storage, or the storage server refuses CORS), pictures load straight from links.
- **Order:** the page on screen is fetched first; the pages ahead start once it is in (or after
  1.5 s), so a jump is never queued behind them. Read-ahead waits for the manifest, and a zoom
  that needs a bigger size reads the pages beside again in that size.
- **Safari makes WebP:** its canvas cannot, so a worker encodes with libwebp compiled to
  WebAssembly (`@jsquash/webp`, ~115 KB gzipped, loaded only while preparing). If the worker fails
  or does not answer in 20 s, pages are made as JPEG as before.
- **Preparing:** up to 4 uploads at once, rows written 25 at a time, the line says «صفحة x من y ·
  n صفحة/ثانية · باقي حوالي …», a warning when the tab is hidden (browsers slow hidden tabs), and
  leaving the page asks first. A book prepared before phase 2 shows «حدّث الكتاب»; resuming counts
  a page as done only once it has every size.
- **Measured** (Chromium, 80-page book, 250 ms added to every request): next page 107–119 ms
  (60–70 ms for the one after), a jump to page 40 566–602 ms with the blurred preview at once; a
  second visit downloads no picture already read. Sizes on the test book: 160 px 1–5 KB, 900 px
  4–25 KB, 1400 px 8–47 KB, 2200 px 16–74 KB.
- The selection is checked on the server against the page's own text (spaces and line breaks do
  not count) and Rita gets the page's text around it, never the browser's text. Written answers
  only in this version (no live voice here).
- A page with no words (a scan) shows its picture with one line saying it cannot be selected.

## Not in this version

- Reading scanned pages (OCR): they show as pictures only.
- Rita by voice beside a book, and linking lessons to book pages.

## Checks

- `scripts/test-books-db.sh`: the reader's 43 pgTAP checks (structure, private bucket, who reads
  pages and pictures, a new PDF clears pages, each reader's place, the circle's limits, deletes).
- `node --test src/lib/books-reader.test.ts` (19 tests, in CI).
- `supabase/tests/books/60_books_reader_tiers_test.sql`: 22 checks (the new columns and their
  checks, who reads manifests, a new PDF removes the manifest, deleting the book removes it).
- Browser runs (Chromium and WebKit, iPad 1180×820 and phone 390×844, Supabase mocked in memory):
  preparing a 4-page book (two text pages, a landscape slide with pictures, a picture-only page),
  the words lying exactly over the picture, the circle, a written answer, questions, turning pages,
  zoom, the saved place, no horizontal scroll, no page errors. Selecting with the real mouse in
  both browsers: a double click gives «hound», a drag over two lines gives the two lines' text, a
  drag across the blank between paragraphs gives «before. The hound» (no jump), and a drag over
  «hound of the Baskervilles» gives exactly that to the circle. A long press on a real iPad could
  not be tried here.
