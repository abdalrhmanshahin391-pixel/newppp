import assert from "node:assert/strict";
import test from "node:test";
import { ensurePlace, mergeCards, removeCards } from "./card-save.ts";

const board = [{ name: "English", subs: [{ name: "Present simple" }] }];

test("an existing subject and sub-subject are found loosely, nothing is added", () => {
  const out = ensurePlace(board, "  english ", "present  SIMPLE");
  assert.equal(out.subject, "English");
  assert.equal(out.sub, "Present simple");
  assert.deepEqual(out.board, board);
});

test("a new subject or sub-subject is added without touching the old ones", () => {
  const out = ensurePlace(board, "German", "Greetings");
  assert.equal(out.board.length, 2);
  assert.deepEqual(out.board[1], { name: "German", subs: [{ name: "Greetings" }] });
  const sub = ensurePlace(board, "English", "Verbs");
  assert.deepEqual(
    sub.board[0].subs.map((x) => x.name),
    ["Present simple", "Verbs"],
  );
  assert.equal(board[0].subs.length, 1);
});

test("repeats are skipped, empty cards dropped, ids fresh", () => {
  const existing = [{ id: "a", front: "Guten Morgen", back: "صباح الخير" }];
  const { added, skipped } = mergeCards(
    existing,
    [
      { front: "guten  morgen", back: "x" },
      { front: "Gute Nacht", back: "تصبح على خير" },
      { front: "Gute Nacht", back: "again" },
      { front: "", back: "y" },
    ],
    (i) => `n${i}`,
  );
  assert.equal(skipped, 2);
  assert.deepEqual(added, [{ id: "n1", front: "Gute Nacht", back: "تصبح على خير" }]);
});

test("undo removes only the cards of that save", () => {
  const cards = [
    { id: "a", front: "1", back: "1" },
    { id: "n1", front: "2", back: "2" },
  ];
  assert.deepEqual(removeCards(cards, ["n1"]), [{ id: "a", front: "1", back: "1" }]);
});
