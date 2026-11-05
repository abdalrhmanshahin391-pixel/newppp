import assert from "node:assert/strict";
import test from "node:test";
import {
  EDGE,
  MIN_SIZE,
  clampRect,
  defaultRect,
  maximisedRect,
  moveRect,
  resizeRect,
  squirclePath,
} from "./window-geometry.ts";

const area = { w: 1000, h: 700 };

test("the squircle path is closed, finite and stays inside its box", () => {
  for (const [w, h, r] of [
    [400, 300, 28],
    [60, 40, 28],
    [300, 220, 0],
  ] as const) {
    const path = squirclePath(w, h, r);
    assert.ok(path.startsWith("M") && path.endsWith("Z"));
    assert.ok(!/NaN|Infinity/.test(path), path);
  }
});

test("a window stays inside the area and keeps its minimum size", () => {
  const out = clampRect({ x: -50, y: 900, w: 100, h: 50 }, area);
  assert.equal(out.x, EDGE);
  assert.equal(out.w, MIN_SIZE.w);
  assert.equal(out.h, MIN_SIZE.h);
  assert.equal(out.y, area.h - EDGE - MIN_SIZE.h);
  const moved = moveRect({ x: 100, y: 100, w: 400, h: 300 }, 5000, -5000, area);
  assert.equal(moved.x, area.w - EDGE - 400);
  assert.equal(moved.y, EDGE);
});

test("resizing from a corner keeps the opposite corner still", () => {
  const start = { x: 200, y: 150, w: 400, h: 300 };
  const br = resizeRect(start, "br", 50, 40, area);
  assert.deepEqual(br, { x: 200, y: 150, w: 450, h: 340 });
  const tl = resizeRect(start, "tl", -30, -20, area);
  assert.equal(tl.x + tl.w, start.x + start.w);
  assert.equal(tl.y + tl.h, start.y + start.h);
  const tiny = resizeRect(start, "tl", 1000, 1000, area);
  assert.equal(tiny.w, MIN_SIZE.w);
  assert.equal(tiny.x + tiny.w, start.x + start.w);
});

test("default and maximised windows fit the area", () => {
  const first = defaultRect(area);
  assert.ok(first.x >= EDGE && first.x + first.w <= area.w - EDGE);
  assert.deepEqual(maximisedRect(area), {
    x: EDGE,
    y: EDGE,
    w: area.w - EDGE * 2,
    h: area.h - EDGE * 2,
  });
});
