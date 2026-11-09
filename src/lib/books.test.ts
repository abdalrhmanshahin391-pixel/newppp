import assert from "node:assert/strict";
import test from "node:test";
import {
  adminFilterBooks,
  fromLocalInput,
  isAdminFiltering,
  NO_ADMIN_FILTER,
  qualityReport,
  ratingShown,
  toLocalInput,
  inPeriod,
  normalizeIsbn,
  publishIssues,
  publishWarnings,
  browseLocal,
  contextOf,
  defaultSort,
  modeOf,
  NO_BROWSE,
  searchFromState,
  seededKey,
  stateFromSearch,
  toggleValue,
  lengthOf,
  matchesQuery,
  readingHours,
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
    { tag_ids: extra.tag_ids, secondary_category_ids: extra.secondary_category_ids },
  );

test("search text forgives case, accents, Arabic diacritics and alef forms; keeps the taa marbuta", () => {
  assert.equal(searchText("Brontë"), "bronte");
  assert.equal(searchText("أَحْمَد"), "احمد");
  assert.equal(searchText("مكتبة إسلامية"), "مكتبة اسلامية");
  assert.equal(searchText("كتـــاب"), "كتاب");
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

test("browsing: OR inside a group, AND between groups, and the order follows the choice", () => {
  const list = [
    book("1", { title: "Zebra", category_id: CAT_A, level: "A2", pages: 90 }),
    book("2", { title: "Apple", category_id: CAT_A, level: "B1", pages: 400 }),
    book("3", { title: "Mango", category_id: CAT_B, level: "A2", pages: 200, language: "de" }),
    book("4", { title: "Kiwi", category_id: CAT_B, level: "C1", secondary_category_ids: [CAT_A] }),
  ];
  const ids = (state: Partial<typeof NO_BROWSE>) =>
    browseLocal(list, { ...NO_BROWSE, ...state }, { seed: "s" }).items.map((b) => b.id);
  assert.deepEqual(ids({}), ["4", "3", "2", "1"]);
  assert.deepEqual(ids({ sort: "title" }), ["2", "4", "3", "1"]);
  assert.deepEqual(ids({ sort: "short" }), ["1", "3", "4", "2"]);
  assert.deepEqual(ids({ level: ["A2", "B1"] }), ["3", "2", "1"]);
  assert.deepEqual(ids({ level: ["A2"], cat: [CAT_A], sort: "new" }), ["1"]);
  assert.deepEqual(
    ids({ cat: [CAT_A], sort: "new" }),
    ["4", "2", "1"],
    "a secondary category counts",
  );
  assert.deepEqual(ids({ lang: ["de"] }), ["3"]);
  assert.deepEqual(ids({ len: ["long"] }), ["2"]);
  assert.deepEqual(ids({ size: 24, page: 2 }), []);
});

test("facet counts ignore their own group and follow the others", () => {
  const list = [
    book("1", { category_id: CAT_A, level: "A2" }),
    book("2", { category_id: CAT_A, level: "B1" }),
    book("3", { category_id: CAT_B, level: "A2" }),
  ];
  const { facets, total } = browseLocal(list, { ...NO_BROWSE, level: ["A2"] }, { seed: "" });
  assert.equal(total, 2);
  assert.deepEqual(facets.level, { A2: 2, B1: 1 });
  assert.deepEqual(facets.category, { [CAT_A]: 1, [CAT_B]: 1 });
});

test("the seeded order is stable for a seed, pins come first, exclusions are hidden", () => {
  const list = Array.from({ length: 9 }, (_, i) => book(String(i + 1)));
  const order = (seed: string, pins: string[] = [], excluded: string[] = []) =>
    browseLocal(list, { ...NO_BROWSE, sort: "discover" }, { seed, pins, excluded }).items.map(
      (b) => b.id,
    );
  assert.deepEqual(order("a"), order("a"));
  assert.notDeepEqual(order("a"), order("b"));
  assert.deepEqual(order("a", ["7", "3"]).slice(0, 2), ["7", "3"]);
  assert.ok(!order("a", [], ["5"]).includes("5"));
  assert.equal(seededKey("a", "x"), seededKey("a", "x"));
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

test("the address round-trips, older single values still work, and junk is ignored", () => {
  const state = stateFromSearch({
    q: " dracula ",
    cat: `${CAT_A},${CAT_B},${CAT_A}`,
    level: "b2,a1,Z9",
    lang: "EN,de",
    len: "short,huge",
    tag: "nope",
    sort: "title",
    page: "3",
    size: 48,
  });
  assert.deepEqual(state, {
    q: "dracula",
    cat: [CAT_A, CAT_B],
    level: ["B2", "A1"],
    lang: ["en", "de"],
    len: ["short"],
    tag: [],
    sort: "title",
    view: null,
    page: 3,
    size: 48,
  });
  assert.deepEqual(stateFromSearch(searchFromState(state)), state);
  assert.deepEqual(stateFromSearch({ cat: CAT_A, level: "B1" }).cat, [CAT_A]);
  assert.deepEqual(
    stateFromSearch({ sort: "random", size: "100", page: "-2", view: "x" }),
    NO_BROWSE,
  );
  assert.deepEqual(searchFromState(NO_BROWSE), {});
});

test("the mode, the editorial place and the default order follow the state", () => {
  assert.equal(modeOf(NO_BROWSE), "discover");
  assert.equal(contextOf(NO_BROWSE), "discover");
  assert.equal(modeOf({ ...NO_BROWSE, q: "x" }), "search");
  assert.equal(defaultSort({ ...NO_BROWSE, q: "x" }), "relevance");
  assert.equal(modeOf({ ...NO_BROWSE, cat: [CAT_A] }), "category");
  assert.equal(contextOf({ ...NO_BROWSE, cat: [CAT_A], level: ["B1"] }), CAT_A);
  assert.equal(defaultSort({ ...NO_BROWSE, cat: [CAT_A] }), "discover");
  assert.equal(modeOf({ ...NO_BROWSE, cat: [CAT_A, CAT_B] }), "all");
  assert.equal(modeOf({ ...NO_BROWSE, view: "all" }), "all");
  assert.equal(contextOf({ ...NO_BROWSE, view: "all" }), null);
  const on = toggleValue({ ...NO_BROWSE, page: 4 }, "level", "B1");
  assert.deepEqual([on.level, on.page], [["B1"], 1]);
  assert.deepEqual(toggleValue(on, "level", "B1").level, []);
});

test("rows from the database are read safely", () => {
  const b = toBook({ id: "x", title: "T", level: "Q", pages: "", year: "1902" }, "https://c");
  assert.equal(b.level, "B1");
  assert.equal(b.pages, null);
  assert.equal(b.year, 1902);
  assert.equal(b.cover_url, "https://c");
  assert.equal(b.published, false);
});

test("a book is found by its other title and by its ISBN", () => {
  const book = {
    title: "Crime and Punishment",
    alt_title: "الجريمة والعقاب",
    author: "Dostoevsky",
    isbn: "9780140449136",
  };
  assert.ok(matchesQuery(book, "الجريمة"));
  assert.ok(matchesQuery(book, "978-0-14-044913-6"));
  assert.ok(!matchesQuery(book, "978-0-00-000000-0"));
});

test("publishing needs a title, a category and the rights check; the rest only warns", () => {
  assert.deepEqual(publishIssues({ title: " ", category_id: null, rights_checked: false }), [
    "title",
    "category",
    "rights",
  ]);
  assert.deepEqual(publishIssues({ title: "T", category_id: "c", rights_checked: true }), []);
  assert.deepEqual(
    publishWarnings({ cover_path: null, file_path: "f", isbn: null, year: 1900, description: "" }),
    ["cover", "isbn", "description"],
  );
});

test("ISBNs are kept as digits and checked for shape", () => {
  assert.equal(normalizeIsbn("978-0-14-143951-8"), "9780141439518");
  assert.equal(normalizeIsbn("0-14-143951-x"), "014143951X");
  assert.equal(normalizeIsbn(""), null);
  assert.equal(normalizeIsbn("12345"), "invalid");
});

test("a period with open ends contains the moment", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  assert.ok(inPeriod(null, null, now));
  assert.ok(inPeriod("2026-11-01T00:00:00Z", "2026-11-10T00:00:00Z", now));
  assert.ok(!inPeriod("2026-11-10T00:00:00Z", null, now));
  assert.ok(!inPeriod(null, "2026-11-09T12:00:00Z", now));
});

test("the admin list filters every status, and lists what is missing", () => {
  const cats = [toCategory({ id: CAT_A, name_ar: "أ", name_en: "A", sort: 0 })];
  const list = [
    book("1", {
      category_id: CAT_A,
      status: "draft",
      cover_path: "c",
      file_path: "f",
      isbn: "9780141439518",
    }),
    book("2", { category_id: null, status: "published" }),
    book("3", { category_id: CAT_A, status: "archived" }),
  ];
  assert.deepEqual(
    adminFilterBooks(list, cats, NO_ADMIN_FILTER).map((b) => b.id),
    ["3", "1", "2"],
  );
  assert.deepEqual(
    adminFilterBooks(list, cats, { ...NO_ADMIN_FILTER, status: "draft" }).map((b) => b.id),
    ["1"],
  );
  assert.deepEqual(
    adminFilterBooks(list, cats, { ...NO_ADMIN_FILTER, cat: "none" }).map((b) => b.id),
    ["2"],
  );
  assert.deepEqual(
    adminFilterBooks(list, cats, { ...NO_ADMIN_FILTER, missing: "pdf" }).map((b) => b.id),
    ["3", "2"],
  );
  assert.ok(!isAdminFiltering(NO_ADMIN_FILTER));
  assert.ok(isAdminFiltering({ ...NO_ADMIN_FILTER, missing: "isbn" }));
});

test("the quality report skips archived books and finds likely duplicates", () => {
  const list = [
    book("1", {
      title: "Dracula",
      author: "Bram Stoker",
      status: "draft",
      rights_checked: false,
      category_id: CAT_A,
    }),
    book("2", {
      title: "dracula!",
      author: "Bram  Stoker",
      status: "published",
      rights_checked: true,
      category_id: CAT_A,
      cover_path: "c",
    }),
    book("3", { title: "Emma", status: "archived" }),
  ];
  const report = qualityReport(list);
  assert.deepEqual(
    report.noCover.map((b) => b.id),
    ["1"],
  );
  assert.deepEqual(
    report.noPdf.map((b) => b.id),
    ["1", "2"],
  );
  assert.deepEqual(
    report.notReady.map((b) => b.id),
    ["1"],
  );
  assert.deepEqual(
    report.duplicates.map((g) => g.map((b) => b.id)),
    [["1", "2"]],
  );
});

test("datetime-local values round-trip to the minute", () => {
  const iso = "2026-11-09T12:34:00.000Z";
  assert.equal(fromLocalInput(toLocalInput(iso)), iso);
  assert.equal(toLocalInput(null), "");
  assert.equal(fromLocalInput(""), null);
  assert.equal(fromLocalInput("nope"), null);
});

test("ratings: read safely, shown from three ratings, and «my favourites» is a view of its own", () => {
  const rated = toBook({ id: "r", title: "T", rating_count: 4, rating_avg: "4.25" }, null);
  assert.equal(rated.rating_avg, 4.25);
  assert.ok(ratingShown(rated));
  assert.ok(!ratingShown(toBook({ id: "s", title: "T", rating_count: 2, rating_avg: 5 }, null)));
  assert.equal(toBook({ id: "u", title: "T" }, null).rating_avg, null);
  const fav = stateFromSearch({ view: "favorites", sort: "trending" });
  assert.equal(modeOf(fav), "favorites");
  assert.equal(contextOf(fav), null);
  assert.equal(fav.sort, "trending");
  assert.deepEqual(searchFromState(fav), { view: "favorites", sort: "trending" });
  const list = [book("1"), book("2"), book("3")];
  const result = browseLocal(list, fav, { seed: "", favorites: ["2"] });
  assert.deepEqual(
    result.items.map((b) => b.id),
    ["2"],
  );
  assert.equal(
    result.sort,
    "new",
    "without the database numbers the popularity orders fall back to the newest",
  );
});
