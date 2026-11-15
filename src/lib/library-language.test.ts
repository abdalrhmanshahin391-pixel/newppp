import assert from "node:assert/strict";
import test from "node:test";
import { booksIn, discoverIn } from "./library-language.ts";

const book = (id: string, language: string) => ({ id, language });
const data = {
  total: 5,
  featured: book("f", "en"),
  picks: [book("p1", "en"), book("p2", "de")],
  newest: [book("n1", "de")],
  loose: [],
  shelves: [{ id: "s", books: [book("s1", "en")] }],
  categories: [
    { id: "c1", total: 9, books: [book("c1a", "en"), book("c1b", "de")] },
    { id: "c2", total: 4, books: [book("c2a", "en")] },
  ],
};

test("a German learner's shelves keep only German books; empty shelves drop out", () => {
  const de = discoverIn(data, "de");
  assert.equal(de.featured, null);
  assert.deepEqual(
    de.picks.map((b) => b.id),
    ["p2"],
  );
  assert.equal(de.shelves.length, 0);
  assert.deepEqual(
    de.categories.map((c) => [c.id, c.total]),
    [["c1", 1]],
  );
  assert.equal(de.total, 5, "the rest of the data is kept");
});

test("an English learner keeps the featured book and every English shelf", () => {
  const en = discoverIn(data, "en");
  assert.equal(en.featured?.id, "f");
  assert.equal(en.shelves.length, 1);
  assert.equal(en.categories.length, 2);
});

test("counting a language's books, and none for a language without books", () => {
  assert.equal(booksIn(data, "de"), 3);
  assert.equal(booksIn(data, "en"), 5);
  assert.equal(booksIn(data, "fr"), 0);
});
