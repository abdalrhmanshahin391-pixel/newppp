import assert from "node:assert/strict";
import test from "node:test";
import {
  driftOffset,
  LETTERS,
  splitLetters,
  WAVE,
  waveOffset,
  wavePhase,
} from "./feature-explorer.ts";

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

test("the circles ripple within ±35px, one wave per screen width", () => {
  const width = 1200;
  for (let x = 0; x < 2400; x += 37) {
    const y = waveOffset(x, 0, width);
    assert.ok(Math.abs(y) <= WAVE.amplitude + 1e-9);
  }
  assert.ok(close(waveOffset(width / 4, 0, width), WAVE.amplitude));
  assert.ok(close(waveOffset(0, 0, width), 0));
  // A circle one screen width further along sits at the same height.
  assert.ok(close(waveOffset(100, 0, width), waveOffset(100 + width, 0, width), 1e-6));
});

test("the ripple moves a screen width every 7 seconds and loops", () => {
  const width = 1000;
  assert.equal(wavePhase(0, width), 0);
  assert.ok(close(wavePhase(3.5, width), 500));
  assert.ok(close(wavePhase(7, width), 0));
  assert.ok(close(wavePhase(10.5, width), 500));
});

test("the row drifts 250px left while the section crosses the screen", () => {
  const vh = 800;
  const h = 600;
  assert.equal(driftOffset(vh, h, vh), -0);
  assert.equal(driftOffset(vh + 300, h, vh), -0);
  assert.ok(close(driftOffset(vh - (vh + h) / 2, h, vh), -125));
  assert.equal(driftOffset(-h, h, vh), -250);
  assert.equal(driftOffset(-h - 500, h, vh), -250);
});

test("letters are split by word with running indexes, spaces counted", () => {
  const words = splitLetters("Talk to me");
  assert.deepEqual(
    words.map((w) => w.word),
    ["Talk", "to", "me"],
  );
  assert.deepEqual(
    words[1].letters.map((l) => l.index),
    [5, 6],
  );
  assert.equal(words[2].letters[1].index, 9);
  // 200 letters fade in about a second.
  assert.ok(close(200 * LETTERS.stagger + LETTERS.fade, 1.1));
});
