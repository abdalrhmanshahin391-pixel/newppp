import assert from "node:assert/strict";
import test from "node:test";
import {
  accuracy,
  boardEmpty,
  buildPool,
  cardText,
  deal,
  isMatch,
  MAX_MS,
  pointsFor,
  refill,
  ROWS,
  sameText,
  timeAfter,
  timeTone,
  type PairCard,
} from "./game.ts";

let seed = 7;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const card = (i: number, back = `back ${i}`): PairCard => ({
  id: `c${i}`,
  front: `front ${i}`,
  back,
});

test("the pool: text on both sides, each pair once, picture-only cards counted", () => {
  const { pool, skipped } = buildPool(
    [
      { id: "a", front: "dog", back: "كلب" },
      { id: "b", front: "  Dog ", back: "كلب" }, // the same pair again
      { id: "c", front: "", back: "قطة" }, // a picture on the front, no text
      { id: "d", front: "cat", back: undefined },
      { id: "e", front: "sun", back: "شمس" },
      { front: "moon", back: "قمر" }, // no id: one is made
    ],
    random,
  );
  assert.equal(skipped, 2);
  assert.deepEqual(pool.map((p) => p.front).sort(), ["dog", "moon", "sun"]);
  assert.ok(pool.every((p) => p.id));
});

test("card text is tidied and kept short", () => {
  assert.equal(cardText("  a \n  b  "), "a b");
  assert.equal(cardText(5), "");
  assert.equal(cardText("x".repeat(300)).length, 160);
});

test("a match: its own back, or another card with the same answer", () => {
  const a = { id: "a", front: "big", back: "كبير" };
  const b = { id: "b", front: "large", back: "كَبِير" }; // same answer, with marks
  const c = { id: "c", front: "small", back: "صغير" };
  assert.equal(isMatch(a, a), true);
  assert.equal(isMatch(a, b), true);
  assert.equal(isMatch(b, a), true);
  assert.equal(isMatch(a, c), false);
  assert.equal(sameText("Hello, world!", "hello world"), true);
});

test("deal: five rows, the same cards on both sides, never all side by side", () => {
  const pool = Array.from({ length: 12 }, (_, i) => card(i));
  for (let n = 0; n < 30; n++) {
    const board = deal(pool, random);
    assert.equal(board.left.length, ROWS);
    assert.equal(board.right.length, ROWS);
    assert.deepEqual(board.left.map((c) => c!.id).sort(), board.right.map((c) => c!.id).sort());
    assert.ok(board.left.some((c, i) => c!.id !== board.right[i]!.id));
    assert.equal(board.queue.length, 7);
  }
});

test("deal with fewer cards than rows leaves the other rows empty", () => {
  const board = deal([card(1), card(2)], random);
  assert.equal(board.left.filter(Boolean).length, 2);
  assert.equal(board.right.filter(Boolean).length, 2);
});

test("refill: the next card takes both places, never side by side", () => {
  const pool = Array.from({ length: 30 }, (_, i) => card(i));
  for (let n = 0; n < 40; n++) {
    let board = deal(pool, random);
    const li = Math.floor(random() * ROWS);
    const ri = board.right.findIndex((c) => c!.id === board.left[li]!.id);
    const next = board.queue[0];
    board = refill(board, li, ri, random);
    assert.equal(board.left[li]!.id, next.id);
    const at = board.right.findIndex((c) => c!.id === next.id);
    assert.ok(at >= 0, "the new back is on the board");
    assert.notEqual(at, li, "not on the same row as its front");
    assert.deepEqual(
      board.left.map((c) => c!.id).sort(),
      board.right.map((c) => c!.id).sort(),
      "both columns hold the same cards",
    );
  }
});

test("playing a whole pool empties the board", () => {
  const pool = Array.from({ length: 8 }, (_, i) => card(i));
  let board = deal(pool, random);
  let matches = 0;
  while (!boardEmpty(board)) {
    const li = board.left.findIndex(Boolean);
    const ri = board.right.findIndex((c) => c && isMatch(board.left[li]!, c));
    board = refill(board, li, ri, random);
    matches += 1;
    assert.ok(matches <= 8);
  }
  assert.equal(matches, 8);
});

test("time: +2 s right, -2 s wrong, kept between 0 and 90 s", () => {
  assert.equal(timeAfter(30_000, true), 32_000);
  assert.equal(timeAfter(30_000, false), 28_000);
  assert.equal(timeAfter(1_000, false), 0);
  assert.equal(timeAfter(MAX_MS, true), MAX_MS);
  assert.equal(timeTone(60_000), "calm");
  assert.equal(timeTone(15_000), "hurry");
  assert.equal(timeTone(5_000), "last");
});

test("points grow with the streak; accuracy is a percentage", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(pointsFor), [10, 10, 15, 15, 20, 20]);
  assert.equal(accuracy(0, 0), 100);
  assert.equal(accuracy(3, 1), 75);
});
