import assert from "node:assert/strict";
import test from "node:test";
import { mergeRecent, readShare } from "./recent-reads.ts";

test("own books and recently read library books share one row, newest first", () => {
  const row = mergeRecent(
    [
      { item: "my grammar", at: 300 },
      { item: "my novel", at: 50 },
    ],
    [
      { item: "Dracula", at: 400 },
      { item: "Emma", at: 100 },
    ],
  );
  assert.deepEqual(
    row.map((entry) => entry.item),
    ["Dracula", "my grammar", "Emma", "my novel"],
  );
  assert.deepEqual(
    row.map((entry) => entry.kind),
    ["library", "mine", "library", "mine"],
  );
});

test("at most five library books; own books always stay", () => {
  const library = Array.from({ length: 8 }, (_, i) => ({ item: `book ${i}`, at: 1000 - i }));
  const row = mergeRecent([{ item: "mine", at: 1 }], library);
  assert.equal(row.filter((entry) => entry.kind === "library").length, 5);
  assert.equal(row.at(-1)?.item, "mine");
  assert.deepEqual(
    row.filter((entry) => entry.kind === "library").map((entry) => entry.item),
    ["book 0", "book 1", "book 2", "book 3", "book 4"],
  );
});

test("how far into a book", () => {
  assert.equal(readShare(20, 80), 0.25);
  assert.equal(readShare(90, 80), 1);
  assert.equal(readShare(null, 80), null);
  assert.equal(readShare(3, null), null);
});
