import assert from "node:assert/strict";
import test from "node:test";
import {
  filterBooks,
  filtersFromSearch,
  isFiltering,
  lengthOf,
  matchesQuery,
  NO_FILTERS,
  readingHours,
  searchFromFilters,
  searchText,
  shelves,
  toBook,
  toCategory,
  type Book,
} from "./books.ts";

const CAT_A = "11111111-1111-4111-8111-111111111111";
const CAT_B = "22222222-2222-4222-8222-222222222222";

const book = (id: string, extra: Partial<Book> = {}): Book =>
  toBook(
    {
      id,
      title: `Book ${id}`,
      author: "Someone",
      level: "B1",
      language: "en",
      pages: 200,
      created_at: `2026-11-0${id}T10:00:00Z`,
      published: true,
      ...extra,
    },
    null,
  );

test("search text forgives case, accents, Arabic diacritics and alef / taa forms", () => {
  assert.equal(searchText("Brontë"), "bronte");
  assert.equal(searchText("أَحْمَد"), "احمد");
  assert.equal(searchText("مكتبة إسلامية"), "مكتبه اسلاميه");
  assert.equal(searchText("  Pride & Prejudice! "), "pride prejudice");
});

test("a query matches word starts in the title or the author, every word", () => {
  const pride = { title: "Pride and Prejudice", author: "Jane Austen" };
  assert.ok(matchesQuery(pride, "pride"));
  assert.ok(matchesQuery(pride, "aust pri"));
  assert.ok(matchesQuery(pride, ""));
  assert.ok(!matchesQuery(pride, "ride"));
  assert.ok(!matchesQuery(pride, "pride dracula"));
  assert.ok(matchesQuery({ title: "الأسود يليق بكِ", author: "أحلام مستغانمي" }, "الاسود احلام"));
});

test("length bands and reading hours", () => {
  assert.equal(lengthOf(86), "short");
  assert.equal(lengthOf(200), "medium");
  assert.equal(lengthOf(351), "long");
  assert.equal(lengthOf(null), "medium");
  assert.equal(readingHours(207), 5);
  assert.equal(readingHours(10), 1);
  assert.equal(readingHours(null), null);
});

test("filters combine, and the order follows the choice", () => {
  const list = [
    book("1", { title: "Zebra", category_id: CAT_A, level: "A2", pages: 90 }),
    book("2", { title: "Apple", category_id: CAT_A, level: "B1", pages: 400 }),
    book("3", { title: "Mango", category_id: CAT_B, level: "A2", pages: 200, language: "de" }),
  ];
  assert.deepEqual(
    filterBooks(list, NO_FILTERS).map((b) => b.id),
    ["3", "2", "1"],
  );
  assert.deepEqual(
    filterBooks(list, { ...NO_FILTERS, sort: "title" }).map((b) => b.id),
    ["2", "3", "1"],
  );
  assert.deepEqual(
    filterBooks(list, { ...NO_FILTERS, sort: "short" }).map((b) => b.id),
    ["1", "3", "2"],
  );
  assert.deepEqual(
    filterBooks(list, { ...NO_FILTERS, cat: CAT_A, level: "A2" }).map((b) => b.id),
    ["1"],
  );
  assert.deepEqual(
    filterBooks(list, { ...NO_FILTERS, lang: "de" }).map((b) => b.id),
    ["3"],
  );
  assert.deepEqual(
    filterBooks(list, { ...NO_FILTERS, len: "long" }).map((b) => b.id),
    ["2"],
  );
  assert.ok(!isFiltering(NO_FILTERS));
  assert.ok(isFiltering({ ...NO_FILTERS, q: " x " }));
  assert.ok(!isFiltering({ ...NO_FILTERS, sort: "title" }));
});

test("shelves follow the category order and leave out empty ones", () => {
  const cats = [
    toCategory({ id: CAT_B, name_ar: "ب", name_en: "B", sort: 2, color: "teal", icon: "flask" }),
    toCategory({ id: CAT_A, name_ar: "أ", name_en: "A", sort: 1, color: "nope", icon: "nope" }),
    toCategory({ id: "33333333-3333-4333-8333-333333333333", name_ar: "ج", name_en: "C", sort: 0 }),
  ];
  assert.equal(cats[1].color, "slate");
  assert.equal(cats[1].icon, "book");
  const list = [
    book("1", { category_id: CAT_B }),
    book("2", { category_id: CAT_A, sort: 2 }),
    book("3", { category_id: CAT_A, sort: 1 }),
    book("4", { category_id: null }),
  ];
  const result = shelves(cats, list);
  assert.deepEqual(
    result.map((s) => [s.category.name_en, s.books.map((b) => b.id)]),
    [
      ["A", ["3", "2"]],
      ["B", ["1"]],
    ],
  );
});

test("filters round-trip through the address, and junk is ignored", () => {
  const filters = filtersFromSearch({
    q: " dracula ",
    cat: CAT_A,
    level: "b2",
    lang: "EN",
    len: "short",
    sort: "title",
  });
  assert.deepEqual(filters, {
    q: "dracula",
    cat: CAT_A,
    level: "B2",
    lang: "en",
    len: "short",
    sort: "title",
  });
  assert.deepEqual(filtersFromSearch(searchFromFilters(filters)), filters);
  assert.deepEqual(
    filtersFromSearch({ cat: "x", level: "Z9", len: "huge", sort: "random", lang: "english" }),
    NO_FILTERS,
  );
  assert.deepEqual(searchFromFilters(NO_FILTERS), {});
});

test("rows from the database are read safely", () => {
  const b = toBook({ id: "x", title: "T", level: "Q", pages: "", year: "1902" }, "https://c");
  assert.equal(b.level, "B1");
  assert.equal(b.pages, null);
  assert.equal(b.year, 1902);
  assert.equal(b.cover_url, "https://c");
  assert.equal(b.published, false);
});
