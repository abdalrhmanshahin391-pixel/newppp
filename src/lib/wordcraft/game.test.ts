import assert from "node:assert/strict";
import test from "node:test";
import {
  clock,
  extendPath,
  hintTiles,
  nextHint,
  tileAt,
  tilesAlong,
  type BoardGeometry,
} from "./game.ts";

const none = new Set<number>();

test("tracing: neighbours add, going back removes, diagonals and jumps do nothing", () => {
  let p = extendPath([], 0, 6, none);
  assert.deepEqual(p, [0]);
  p = extendPath(p, 1, 6, none);
  assert.deepEqual(p, [0, 1]);
  assert.deepEqual(
    extendPath(p, 8, 6, none),
    [0, 1],
    "diagonal from 1 to 8 is not taken… 8 is not next to 1",
  );
  p = extendPath(p, 7, 6, none);
  assert.deepEqual(p, [0, 1, 7]);
  assert.deepEqual(extendPath(p, 1, 6, none), [0, 1], "back to the previous tile takes a step off");
  assert.deepEqual(
    extendPath(p, 0, 6, none),
    [0, 1, 7],
    "a tile already on the path, not the previous one",
  );
  assert.deepEqual(extendPath(p, 20, 6, none), [0, 1, 7], "a jump");
  assert.deepEqual(extendPath(p, 13, 6, new Set([13])), [0, 1, 7], "a tile of a solved word");
  assert.deepEqual(extendPath([], 13, 6, new Set([13])), [], "cannot start on a solved word");
  assert.deepEqual(extendPath([5], 6, 6, none), [5], "end of a row is not next to the next row");
});

const g: BoardGeometry = { left: 100, top: 50, pitch: 70, size: 64, rows: 4, cols: 6 };

test("the tile under the finger; gaps and corners are no tile", () => {
  assert.equal(tileAt(100 + 32, 50 + 32, g), 0);
  assert.equal(tileAt(100 + 70 + 32, 50 + 70 * 2 + 32, g), 13);
  assert.equal(tileAt(100 + 66, 50 + 32, g), -1, "in the gap");
  assert.equal(tileAt(100 + 2, 50 + 2, g), -1, "the very corner");
  assert.equal(tileAt(90, 60, g), -1, "outside");
  assert.equal(tileAt(100 + 70 * 6 + 10, 60, g), -1, "past the last column");
});

test("a fast swipe passes through the tiles in between, not around corners", () => {
  const centre = (r: number, c: number) => [100 + c * 70 + 32, 50 + r * 70 + 32] as const;
  const [x0, y0] = centre(0, 0);
  const [x1, y1] = centre(0, 3);
  assert.deepEqual(tilesAlong(x0, y0, x1, y1, g), [1, 2, 3]);
  // Straight across a corner (0,0) → (1,1): only the end tile counts, never a side tile.
  const [x2, y2] = centre(1, 1);
  assert.deepEqual(tilesAlong(x0, y0, x2, y2, g), [7]);
});

test("hints show the word's tiles one by one, never more than the word", () => {
  assert.deepEqual(hintTiles([4, 5, 11], 0), []);
  assert.deepEqual(hintTiles([4, 5, 11], 1), [4]);
  assert.deepEqual(hintTiles([4, 5, 11], 9), [4, 5, 11]);
});

test("smart hint: two letters first, then one more per press, then the next word", () => {
  const words = ["HOUSE", "TREE", "FISH"];
  const none = new Set<number>();
  let hints: Record<number, number> = {};
  const press = (solved = none) => {
    const h = nextHint(words, solved, hints);
    if (h) hints = { ...hints, [h.word]: h.level };
    return h;
  };
  assert.deepEqual(press(), { word: 0, level: 2 });
  assert.deepEqual(press(), { word: 0, level: 3 });
  assert.deepEqual(press(), { word: 0, level: 4 });
  assert.deepEqual(press(), { word: 0, level: 5 }, "the whole word");
  assert.deepEqual(press(), { word: 1, level: 2 }, "then the next word, two letters");
  // The hinted word is found: the next press moves on, the found one is skipped.
  assert.deepEqual(press(new Set([1])), { word: 2, level: 2 });
  assert.deepEqual(press(new Set([1])), { word: 2, level: 3 });
  assert.deepEqual(press(new Set([1])), { word: 2, level: 4 });
  assert.equal(press(new Set([1])), null, "every word shown or found: nothing left");
  assert.equal(nextHint(words, new Set([0, 1, 2]), {}), null);
});
