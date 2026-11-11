# The starter library (20 books)

A first shelf for `/books`: 20 well-known books with covers and short Arabic descriptions, and a
button for the admin to add each book's PDF later.

## What is in it

| Shelf (category)                        | Books                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| حكمة واستراتيجية — Wisdom & Strategy    | The Art of War, Meditations, The Book of Five Rings, The Prince, Tao Te Ching, The Autobiography of Benjamin Franklin |
| روايات كلاسيكية — Classic Novels        | Pride and Prejudice, Jane Eyre, The Great Gatsby, A Christmas Carol                                                   |
| غموض وتحقيق — Mystery & Detective       | The Adventures of Sherlock Holmes, The Hound of the Baskervilles                                                      |
| رعب وقوطي — Gothic & Horror             | Dracula, Frankenstein, The Picture of Dorian Gray, The Strange Case of Dr. Jekyll and Mr. Hyde                        |
| مغامرات وخيال علمي — Adventure & Sci-Fi | Treasure Island, The Time Machine                                                                                     |
| خيال وحكايات — Fantasy & Fairy Tales    | Alice's Adventures in Wonderland, The Wonderful Wizard of Oz                                                          |

Five of the twenty are strategy and wisdom; the rest are stories.

## Where it comes from (and the rights)

- **Texts:** the editions of [Standard Ebooks](https://standardebooks.org), which are in the public
  domain (the originals and the translations used: Giles 1910, Long 1862, Marriott 1908, Legge 1891).
  They are what the PDFs below are made from.
- **Covers:** the covers of the same editions. Each is adapted from a public-domain painting (the
  editions' colophons name them: for example _Portrait of the Imperial Bodyguard Zhanyinbao_ for
  The Art of War). They were scaled to 600×900 WebP.
- **«The Book of Five Rings»:** every English translation in circulation (Harris 1974, Cleary,
  Bennett, Wilson…) is protected. An Internet Archive copy carries a "public domain" label, but its
  first pages show it is Victor Harris's 1974 translation, so it is **not** used. The book is added
  as a **draft** (hidden from readers, no rights check) with a cover drawn for Uzyra
  (`docs/books-starter-library/five-rings-cover.html`). To publish it, upload a text you have the
  right to use, then tick the rights check in the book's editor.
- **Descriptions:** written for Uzyra.
- The rights check is set on the 19 public-domain books by the migration, on the basis of Standard
  Ebooks' public-domain determination (United States law). The admin decides if that is enough for
  their audience.

## How it is built

- `supabase/starter-books/books.json` is the one place the data is written.
- `node scripts/build-starter-books-sql.mjs` builds
  `supabase/migrations/20261117120000_books_starter_library.sql` from it (a test fails when the
  two differ).
- The migration only **adds**: it reuses a category whose Arabic or English name exists, skips a
  book that is already there (same import key, or the same title and author), and can be run
  again. It needs the library updates (status, import key) from before. No timer, no Edge Function.
- Covers: `public/book-covers/<slug>.webp`. `cover_path` holds `/book-covers/<slug>.webp`; the
  page uses an address like that as it is (`isSiteCover`, `coverUrl`). Replacing a cover in the
  book editor uploads to the covers bucket as before and never tries to remove a site cover.
- `scripts/test-books-db.sh` applies the migration after the rule tests, twice, then
  `supabase/tests/books/80_books_starter_library_test.sql` checks the result.

## The PDFs

The books come **without files**. Readers see «الملف لسا مش جاهز» until the admin adds one:

1. Open `/books`, click the book, and press **«ارفع ملف الكتاب»** (admins only).
2. Choose the PDF (up to 500 MB). It goes up in resumable parts (with a progress bar and
   «إلغاء»); the book then points to it.
3. The book is prepared for reading by itself (as in the editor); keep the page open until it
   finishes. «ابدأ القراءة» then opens the site's reader.

PDFs for the 19 public-domain books were made from the Standard Ebooks single-page HTML (printed
with Chromium to A5, 10 pt) and are handed over separately, named `<slug>.pdf`. They are not kept
in the repository (about 18 MB).

## Adding more books later

Add the book to `books.json` (and its `<slug>.webp` cover), run the build script, and apply the
new migration file under a new date, or add the book in the admin as usual.
