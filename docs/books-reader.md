# Library — the reader

> **Update (Nov 2026):** library books are now read straight from their PDF (pdf.js on the
> reader's device, opened in parts; `src/components/books/reader/library-book-source.ts`), the
> same way as a reader's own books. Preparing pages as pictures was removed (it failed on Safari
> and its many uploads timed out the database); a book can be read as soon as its file is saved.
> Books prepared earlier that have no file still read their pictures. The sections below describe
> the original prepared-pictures design.

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

### Turning by touch (the page-pane plan, phase 3a)

- Swipe and edge taps, by the plan's rules: touch only (the mouse keeps selecting), a swipe turns
  past 60 px sideways (more than twice the up/down travel, under 600 ms or faster than 0.4 px/ms),
  the outer 12% of each side turns on a tap, the book's direction (its manifest's `dir`, else its
  language) decides which side is "next", and the progress line fills from where the book starts.
- Selection always wins: nothing starts while text is selected, after a 300 ms long press (how a
  selection begins on iPhone and iPad), from a button or field, or with the circle's menu open.
- One deviation from the plan: an edge tap turns even on a word, because a single tap never
  selects on an iPad and books with narrow margins would otherwise have edges that do not work.
- Touch events, not pointer events: they keep arriving while the browser scrolls a zoomed page.
  `touch-action: pan-y pinch-zoom` only while the page is no wider than its pane; a zoomed page
  scrolls sideways itself and turns only from its edge.
- Rules in `src/lib/book-gestures.ts` (tested in `book-gestures.test.ts`), wiring in
  `src/components/books/reader/useTurnGestures.ts`.
- Checked in Chromium with real touch input (31 checks: swipes both ways, up/down, diagonal, slow
  drags, a long press, with text selected, edge and middle taps, a mouse click, zoomed in the
  middle and at the edge, a right-to-left book, the phone's scroll-then-turn, reduced motion) and
  in WebKit with made-up touch events and real taps (29). The four selection checks still pass in
  both. Not tried on a real iPad or iPhone.

### Scrubber (the page-pane plan, phase 3b)

- The progress line is the scrubber (`BookScrubber.tsx`): drag or click it, or hover on a computer.
  The card shows the page's 160 px picture (ThumbHash first), its number and its chapter from the
  manifest's outline (`chapterAt`). The full page is fetched only on release.
- The little pictures' links are signed in one batch for the 41 pages around the pointer and
  reused (`scrubWindow`, then only when the page under the pointer has no link or 8+ around it are
  missing): one signing request in the tests for a drag across the whole book.
- Pointer events with pointer capture (`touch-action: none` on the line's 28 px band only), so
  the page's swipe and scrolling are untouched. `scrubPage` / `scrubSpot` map the line to pages by
  the book's direction.
- Checked in Chromium and WebKit (iPad and phone): hover, drag, release, click, Escape, Home/End,
  arrows, a right-to-left book, a book without little pictures, a long chapter title, the card
  inside a 390 px screen, the signing count, and a finger drag (Chromium, real touch input). The
  swipe and selection checks still pass.

### Contents, chapter ticks, minutes left (the page-pane plan, phase 3c)

- From the outline the prepare step stores in the manifest; no database change. Books whose PDF
  has no outline get none of it (no empty button).
- `BookOutline.tsx`: a Radix dialog (focus kept inside, Escape and outside taps close, focus back
  on the button), rendered inside the reader so the colour tokens apply; a panel above the button,
  a bottom sheet under 600 px. Its arrow keys never reach the reader's page turning.
- Ticks: `chapterTicks` (top-level starts, at least 6 px apart). Minutes: `paceSample`,
  `secondsPerPage`, `nextChapterStart`, `minutesLeftLabel`; the pace is kept per browser
  (`uzyra-book-pace`), never sent anywhere. On an iPad in the split view the bar is about 620 px,
  so there the minutes show only in the contents panel.
- Checked in Chromium and WebKit (iPad and phone, 25 checks each): the button only with an
  outline, the panel's place, the current chapter marked and focused, ↑/↓ without turning, going
  to a chapter, Escape, focus back, the phone sheet, ticks (and mirrored), no outline, no sideways
  scroll. The scrubber, swipe and selection checks still pass.

### Search, bookmarks, finger zoom, resume, milestones (the page-pane plan, phase 3d–g)

- Migration `20261116120000_books_reader_search_bookmarks.sql`: `book_pages.fts` (generated from
  `text`, `simple` config, GIN index) and `books_search_pages(book, q)` (security invoker, so the
  pages' rules apply; `websearch_to_tsquery`; 50 pages; a `ts_headline` line with the match in
  ⟦ ⟧); `book_bookmarks` (own rows, published books, no visitors). 27 pgTAP checks
  (`70_books_reader_search_test.sql`).
- `BookPanel.tsx` (replaces `BookOutline.tsx`): contents, search and bookmarks as tabs. A result
  marks its words on the page with a CSS highlight (`bkr-found`, whole words, until the page
  turns). Before the migration the panel says search needs the update and the bookmark icon stays
  away (`searchBookPages` → "missing", `fetchBookmarks` → null).
- Bookmarks are optimistic (React Query cache), with «تراجع»; a failure puts them back and says so.
- Finger zoom is behind a per-browser switch until a real iPad shows selection is unharmed; with it
  on, `touch-action: pan-y` (the reader takes the pinch) and a pinch settles on the nearest step.
- Resume chip from the route (`resumed`: opened at the saved place, not page 1, not `?page=`);
  milestones per browser (`uzyra-book-milestones:<book>`), `crossedMilestone`.
- Checked in Chromium (57 checks, iPad and phone, finger zoom with real touch input) and WebKit
  (50): search (results, pictures, the word marked, kept, nothing found, cleared on turning),
  bookmarks (mark, note, undo, dot, list, remove, go), without the migration, without an outline,
  the resume chip, milestones once, finger zoom off and on (double tap, pinch, selection wins).
  The contents, scrubber, swipe and selection checks still pass.

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
