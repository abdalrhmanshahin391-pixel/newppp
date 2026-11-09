# Book reader — research pack

For asking a research assistant (e.g. Perplexity) how to improve how book pages are shown, loaded
and turned in the reader (`/books/<book>/read`).

- `uzyra-book-reader-report.pdf`: how the reader works today, with screenshots, measured timings
  (requests per page, next page, fast flipping, jumping), the constraints any solution must keep,
  and the question to ask (section 6).
- `uzyra-reader-code.md`: the reader's source code and migration as they were when the report was
  written (the files in `src/` and `supabase/migrations/` are the current ones).
