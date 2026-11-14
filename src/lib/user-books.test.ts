import assert from "node:assert/strict";
import test from "node:test";
import {
  clampPage,
  drawWidth,
  snippetAround,
  textDirection,
  freeSlot,
  myBookFileKey,
  titleFromFile,
  USER_BOOK_MAX_BYTES,
  userBookError,
  userBookFileProblem,
  userBookPath,
} from "./user-books.ts";

test("a book file: a PDF up to 50 MB", () => {
  const pdf = (size: number, name = "book.pdf", type = "application/pdf") => ({ name, type, size });
  assert.equal(userBookFileProblem(pdf(1000), "en"), null);
  assert.equal(userBookFileProblem(pdf(1000, "book.PDF", ""), "en"), null, "a PDF with no type");
  assert.equal(userBookFileProblem(pdf(USER_BOOK_MAX_BYTES), "en"), null, "exactly 50 MB");
  assert.match(userBookFileProblem(pdf(USER_BOOK_MAX_BYTES + 1), "en")!, /up to 50 MB/);
  assert.match(userBookFileProblem(pdf(80 * 1024 * 1024), "ar")!, /80 ميغا/);
  assert.match(userBookFileProblem(pdf(10, "notes.docx", "application/msword"), "en")!, /PDF/);
  assert.match(userBookFileProblem(pdf(10, "x.png", "image/png"), "ar")!, /PDF/);
  assert.match(userBookFileProblem(pdf(0), "en")!, /empty/);
});

test("a book's name: the PDF's own title when real, else the file name", () => {
  assert.equal(titleFromFile("the_great-gatsby.pdf"), "the great gatsby");
  assert.equal(titleFromFile("My Book.pdf", "The Great Gatsby"), "The Great Gatsby");
  assert.equal(titleFromFile("report.pdf", "Microsoft Word - report.docx"), "report");
  assert.equal(titleFromFile("x.pdf", "untitled"), "x");
  assert.equal(titleFromFile("كتابي.pdf"), "كتابي");
  assert.equal(titleFromFile(".pdf"), "My book");
  assert.equal(titleFromFile("a".repeat(300) + ".pdf").length, 200);
  assert.equal(titleFromFile("well-known_story -  part 2.pdf"), "well known story - part 2");
});

test("two slots: the free one, or none", () => {
  assert.equal(freeSlot([]), 1);
  assert.equal(freeSlot([{ slot: 1 }]), 2);
  assert.equal(freeSlot([{ slot: 2 }]), 1);
  assert.equal(freeSlot([{ slot: 1 }, { slot: 2 }]), null);
});

test("the file path the database requires", () => {
  assert.equal(userBookPath("u1", "b1"), "u1/b1/book.pdf");
});

test("database refusals in the reader's words", () => {
  assert.match(
    userBookError(
      {
        code: "23505",
        message: 'duplicate key value violates unique constraint "user_books_one_per_slot"',
      },
      "en",
    ),
    /two books/,
  );
  assert.match(
    userBookError(
      { code: "P0001", message: "too many books added today", hint: "user_books_daily_limit" },
      "ar",
    ),
    /بكرا/,
  );
  assert.match(
    userBookError({ message: "The object exceeded the maximum allowed size" }, "en"),
    /50 MB/,
  );
  assert.match(
    userBookError({ code: "42501", message: "new row violates row-level security policy" }, "en"),
    /Sign in/,
  );
  assert.match(userBookError(null, "ar"), /جرّب/);
});

test("pages stay inside the book", () => {
  assert.equal(clampPage(0, 10), 1);
  assert.equal(clampPage(11, 10), 10);
  assert.equal(clampPage(Number.NaN, 10), 1);
  assert.equal(clampPage(3.4, 10), 3);
  assert.equal(clampPage(5, 0), 1);
});

test("drawWidth picks the smallest drawing width that is sharp enough", () => {
  assert.equal(drawWidth(300), 700);
  assert.equal(drawWidth(700), 700);
  assert.equal(drawWidth(701), 1100);
  assert.equal(drawWidth(1500), 1600);
  assert.equal(drawWidth(9000), 2200);
});

test("textDirection reads the book's direction from its first page", () => {
  assert.equal(textDirection("The quick brown fox"), "ltr");
  assert.equal(textDirection("هذا كتاب عربي عن القواعد"), "rtl");
  assert.equal(textDirection("كتاب Grammar عن القواعد الإنجليزية"), "rtl");
  assert.equal(textDirection(""), "ltr");
});

test("snippetAround marks the match the way the library search does", () => {
  assert.equal(snippetAround("a big\nhound came", 6, 5), "a big ⟦hound⟧ came");
  const long = `${"x".repeat(100)}word${"y".repeat(100)}`;
  const snip = snippetAround(long, 100, 4);
  assert.ok(snip.startsWith("…") && snip.endsWith("…") && snip.includes("⟦word⟧"));
});

test("the device copy of a book's file is named by the book and the file", () => {
  const a = myBookFileKey({ id: "b1", file_path: "u/b1/one.pdf" });
  assert.equal(a, "/__uzyra-my-book/b1?file=u%2Fb1%2Fone.pdf");
  assert.notEqual(
    myBookFileKey({ id: "b1", file_path: "u/b1/two.pdf" }),
    a,
    "a new file, a new name",
  );
  assert.equal(new URL(a, "https://ritajet.com").pathname, "/__uzyra-my-book/b1");
});
