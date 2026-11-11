import assert from "node:assert/strict";
import test from "node:test";
import {
  atSwipeEdge,
  dragOffset,
  swipeDirection,
  swipeTurn,
  tapScrollTo,
  tapTurn,
} from "./book-gestures.ts";

test("a swipe turns only when it is long, sideways and quick enough", () => {
  // Left in a left-to-right book: next; right: previous.
  assert.equal(swipeTurn(-80, 5, 200, false), 1);
  assert.equal(swipeTurn(80, 5, 200, false), -1);
  // Too short, too steep, or a slow drag.
  assert.equal(swipeTurn(-59, 0, 100, false), 0);
  assert.equal(swipeTurn(-80, 40, 100, false), 0);
  assert.equal(swipeTurn(-80, 0, 900, false), 0);
  // Slow but long and fast enough on average (0.4 px/ms) still turns.
  assert.equal(swipeTurn(-400, 0, 900, false), 1);
  // Right-to-left books turn the other way.
  assert.equal(swipeTurn(-80, 5, 200, true), -1);
  assert.equal(swipeTurn(80, 5, 200, true), 1);
  assert.equal(swipeDirection(-3, false), 1);
  assert.equal(swipeDirection(-3, true), -1);
  assert.equal(swipeDirection(0, true), 0);
});

test("the sheet follows the finger a little, less where there is no page beyond", () => {
  assert.equal(dragOffset(-50, 0, true), -20);
  assert.equal(dragOffset(-500, 0, true), -48);
  assert.equal(dragOffset(500, 10, false), 12);
  assert.equal(dragOffset(20, 40, true), 0);
});

test("the outer 12% of each side turns on a tap, by the book's direction", () => {
  assert.equal(tapTurn(990, 1000, false), 1);
  assert.equal(tapTurn(10, 1000, false), -1);
  assert.equal(tapTurn(500, 1000, false), 0);
  assert.equal(tapTurn(130, 1000, false), 0);
  assert.equal(tapTurn(990, 1000, true), -1);
  assert.equal(tapTurn(10, 1000, true), 1);
  assert.equal(tapTurn(10, 0, true), 0);
});

test("a zoomed page turns only from the edge the swipe pulls towards", () => {
  const ltr = (left: number) => ({ left, width: 2000, client: 1000, rtl: false });
  assert.equal(atSwipeEdge(-80, ltr(1000)), true);
  assert.equal(atSwipeEdge(-80, ltr(400)), false);
  assert.equal(atSwipeEdge(80, ltr(0)), true);
  assert.equal(atSwipeEdge(80, ltr(400)), false);
  // A right-to-left box starts at 0 (its right end) and goes negative.
  const rtl = (left: number) => ({ left, width: 2000, client: 1000, rtl: true });
  assert.equal(atSwipeEdge(-80, rtl(0)), true);
  assert.equal(atSwipeEdge(80, rtl(0)), false);
  assert.equal(atSwipeEdge(80, rtl(-1000)), true);
  // Not wider than the pane: always.
  assert.equal(atSwipeEdge(80, { left: 0, width: 1000, client: 1000, rtl: false }), true);
});

test("a tall page scrolls before it turns", () => {
  const at = (top: number) => ({ top, height: 2000, client: 800 });
  assert.equal(tapScrollTo(1, at(0)), 680);
  assert.equal(tapScrollTo(1, at(1000)), 1200);
  assert.equal(tapScrollTo(1, at(1200)), null);
  assert.equal(tapScrollTo(-1, at(1200)), 520);
  assert.equal(tapScrollTo(-1, at(0)), null);
  assert.equal(tapScrollTo(1, { top: 0, height: 800, client: 800 }), null);
  assert.equal(tapScrollTo(0, at(0)), null);
});

test("finger zoom: double taps and pinches land on the zoom steps", async () => {
  const { isDoubleTap, nearestZoom, nextZoom } = await import("./book-gestures.ts");
  const levels = [1, 1.25, 1.5, 2, 2.5];
  assert.equal(isDoubleTap({ x: 10, y: 10, t: 0 }, { x: 20, y: 15, t: 250 }), true);
  assert.equal(isDoubleTap({ x: 10, y: 10, t: 0 }, { x: 20, y: 15, t: 400 }), false);
  assert.equal(isDoubleTap({ x: 10, y: 10, t: 0 }, { x: 80, y: 15, t: 100 }), false);
  assert.equal(isDoubleTap(null, { x: 0, y: 0, t: 0 }), false);
  assert.equal(nearestZoom(levels, 0, 1.6), 2);
  assert.equal(nearestZoom(levels, 3, 0.4), 0);
  assert.equal(nearestZoom(levels, 0, 9), 4);
  assert.equal(nearestZoom(levels, 2, 1.02), 2);
  assert.equal(nextZoom(levels, 0), 1);
  assert.equal(nextZoom(levels, 4), 0);
});
