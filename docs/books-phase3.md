# Library — phase 3 (popularity)

ملخص: المرحلة الثالثة فيها التقييم (1–5) والمفضلة لكل قارئ مسجّل، وعدّ المشاهدات والقراءات
(مرة باليوم لكل كتاب وشخص)، ورفّين جداد بـ«اكتشف»: «الرائج هالأسبوع» و«الأعلى تقييماً»، و«مفضلتي»،
وترتيبين جداد، وتبويب «الإحصائيات» للأدمن. كله بيتحسب وقت الطلب بدون أي مهمة مجدولة، وبدون ما
حدا يشوف تقييمات أو مفضلة غيره.

## What changed

| Area | Files |
| --- | --- |
| Database | `supabase/migrations/20261111120000_books_popularity.sql` (additive, safe to run twice) |
| Database tests | `supabase/tests/books/30_books_phase3_test.sql` (pgTAP, 67 checks, release targets included) |
| Rules (pure) | `src/lib/books.ts` (ratings on a book, «مفضلتي», the two new orders) |
| Data | `src/lib/books-data.ts` (`loadPopular`, `loadMine`, `trackBook`, `rateBook`, `favoriteBook`, `loadAnalytics`) |
| Page | `src/components/books/BookSheet.tsx`, `LibraryPage.tsx` |
| Admin | `src/components/books/admin/StatsTab.tsx`, `src/routes/admin.books.tsx` |

### Database

- People's own rows: `book_events` (view / read, primary key book + person + day + kind, so a
  repeat the same day is ignored), `book_favorites`, `book_ratings` (1–5, one per person and book).
  Each person reads and writes only their own; only published books; the person is `auth.uid()`.
  Visitors are not counted.
- Public numbers without identities: `book_stats` (per book: ratings count and sum, favourites,
  views, reads) and `book_daily` (per book and day). Readable for published books. The only
  writers are three triggers (security definer, limited to adding to these numbers).
- Top rated: `S = (v·R + m·C) / (v + m)`, `m = 10`, `C` the mean of all ratings; only books with at
  least 3 ratings. With real numbers: 41 ratings averaging ≈ 4.59 rank above three fives.
- Trending: `T = Σ (V + 3R + 2F) · exp(−ln2 · d / 3)` over the last 7 days.
- `books_popular` (the two shelves; discover exclusions apply), `books_browse` gains the
  "rating" and "trending" orders and `p_favorites`, book cards carry `rating_count` and
  `rating_avg`, `books_track`, `books_rate`, `books_favorite`, and `books_analytics` (admins).
- All reading calls are security invoker. No timer, no materialized view, no new Edge Function.

## Checks

- `scripts/test-books-db.sh`: phase 1 (65), phase 2 (63) and phase 3 (67) pgTAP checks on the real
  migrations, each applied twice. Phase 3 covers: visitors not counted, once a day, reads counted
  apart, drafts not counted, nobody records for someone else, readers cannot list events, rating
  set / changed (no double count) / removed / out of range / on a draft / by a visitor, nobody sees
  or changes other people's ratings or favourites, favourites once and taken off (both numbers go
  down), «my favourites», the Bayesian order and the 3-ratings rule, the trend's weights, decay and
  7-day window, a book back to draft leaving the shelves, a deletion taking everything with it, the
  admin's numbers, and the release targets.
- Release targets, measured on Postgres 16 with 1000+ books and 20,000 events (20 runs each):
  p95 `books_browse` by trend 74.5 ms, search + filters by rating 24.8 ms, `books_discover`
  12.6 ms, `books_popular` 58.1 ms (target 250 ms); the discover answer 18 KB and a page of 24
  16 KB (target 150 KB); a page shows 24 cards. CI prints these numbers on each run.
- Node tests (18 in `books.test.ts`), the whole CI list, `tsc`, the build.
- Chromium and WebKit, iPad and phone, with a mocked Supabase: the two shelves; opening a book is
  counted (a visitor's is not); rating 4 is sent; the favourite button; «مفضلتي» sends
  `p_favorites`; the two new orders; the admin's numbers. Found and fixed: hidden screen-reader
  text inside cards widened the page sideways.

Not tested here: the 700 ms end-to-end target (network included) — measured on the live site,
see `docs/books-lovable-steps.md`.
