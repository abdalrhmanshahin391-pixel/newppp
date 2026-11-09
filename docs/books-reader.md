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

- Only the page on screen is loaded, then the next and previous wait in the background (row +
  picture). Zoom in five steps; arrows / Page Up / Page Down turn pages; the place is saved after a
  second on a page and kept in the address (`?page=`).
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
- `node --test src/lib/books-reader.test.ts` (9 tests, in CI).
- Browser runs (Chromium and WebKit, iPad 1180×820 and phone 390×844, Supabase mocked in memory):
  preparing a 4-page book (two text pages, a landscape slide with pictures, a picture-only page),
  the words lying exactly over the picture, selecting across pieces, the circle, a written answer,
  questions, turning pages, zoom, the saved place, no horizontal scroll, no page errors.
