import assert from "node:assert/strict";
import test from "node:test";
import {
  DOCK_GAP,
  EDGE,
  MIN_SIZE,
  OFF_MARGIN,
  clampRect,
  dockedRect,
  overflowRight,
  project,
  rightLimit,
  rubberband,
  shouldOpen,
  shouldTuck,
  springAtRest,
  springFrom,
  springStep,
  tabCenter,
  tuckedOffset,
  velocityOf,
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

test("a flick is projected the way Apple's scroll slows down", () => {
  assert.equal(project(0), 0);
  assert.ok(Math.abs(project(1000) - 499) < 1, String(project(1000)));
  assert.ok(project(-1000) < 0);
});

test("past a limit the window resists more the further it goes", () => {
  assert.equal(rubberband(0, 400), 0);
  assert.equal(rubberband(-10, 400), 0);
  const a = rubberband(40, 400);
  const b = rubberband(400, 400);
  assert.ok(a > 0 && a < 40);
  assert.ok(b < 400 * 0.55 && b > a);
});

test("a window released past the right edge goes to the side, one coming back stays", () => {
  const w = 460;
  // Pushed half off, held still.
  assert.equal(shouldTuck(w * 0.5, 0, w), true);
  // A little past the edge and still: it stays.
  assert.equal(shouldTuck(40, 0, w), false);
  // A little past, but flicked to the right: the flick carries it away.
  assert.equal(shouldTuck(40, 900, w), true);
  // Far past but moving back to the left: it stays.
  assert.equal(shouldTuck(w * 0.6, -400, w), false);
  // In the middle of the page, flicked hard right: away (as on iPad).
  assert.equal(shouldTuck(0, 1500, w), true);
});

test("a window pulled in from the side opens past 40% or with a flick", () => {
  const w = 460;
  assert.equal(shouldOpen(w * 0.5, 0, w), true);
  assert.equal(shouldOpen(60, 0, w), false);
  assert.equal(shouldOpen(60, -900, w), true);
  assert.equal(shouldOpen(w * 0.8, 400, w), false, "moving back to the right puts it away");
});

test("the side place: off the area with its shadow; back against the right edge", () => {
  const rect = { x: 300, y: 120, w: 460, h: 560 };
  assert.equal(tuckedOffset(rect, area), area.w - rect.x + OFF_MARGIN);
  const back = dockedRect(rect, area);
  assert.equal(back.x, area.w - EDGE - DOCK_GAP - rect.w);
  assert.equal(back.y, rect.y);
  assert.equal(back.w, rect.w);
  // In a narrow area it is still kept inside.
  const narrow = dockedRect({ x: 0, y: 0, w: 380, h: 500 }, { w: 390, h: 700 });
  assert.ok(narrow.x >= EDGE && narrow.x + narrow.w <= 390 - EDGE);
  assert.equal(overflowRight(rightLimit(rect, area) + 30, rect, area), 30);
  assert.equal(overflowRight(rightLimit(rect, area) - 30, rect, area), 0);
});

test("the tab stays level with the window and inside the area", () => {
  assert.equal(tabCenter({ x: 0, y: 100, w: 400, h: 400 }, area), 300);
  assert.equal(tabCenter({ x: 0, y: -300, w: 400, h: 400 }, area), 44 + EDGE);
  assert.equal(tabCenter({ x: 0, y: 900, w: 400, h: 400 }, area), area.h - 44 - EDGE);
});

test("a finger's speed comes from its last 100 ms", () => {
  assert.equal(velocityOf([]), 0);
  assert.equal(velocityOf([{ t: 0, x: 0 }]), 0);
  // Slow at first, then 50 px in the last 50 ms: 1000 px/s.
  const samples = [
    { t: 0, x: 0 },
    { t: 200, x: 10 },
    { t: 250, x: 60 },
  ];
  assert.equal(velocityOf(samples), 1000);
  assert.equal(
    velocityOf([
      { t: 0, x: 0 },
      { t: 4, x: 30 },
    ]),
    0,
    "too short to tell",
  );
});

test("Apple's spring terms become stiffness and damping", () => {
  const s = springFrom(0.4, 1);
  assert.ok(Math.abs(s.stiffness - 246.74) < 0.1, String(s.stiffness));
  assert.ok(Math.abs(s.damping - 31.42) < 0.1, String(s.damping));
  assert.equal(s.mass, 1);
});

test("a spring settles: critically damped without overshoot, a bouncier one overshoots", () => {
  const run = (params: ReturnType<typeof springFrom>, velocity = 0) => {
    let x = 0;
    let v = velocity;
    let most = 0;
    let t = 0;
    while (t < 3 && !(t > 0 && springAtRest(x, v, 100))) {
      [x, v] = springStep(x, v, 100, 1 / 60, params);
      most = Math.max(most, x);
      t += 1 / 60;
    }
    return { x, most, t };
  };
  const calm = run(springFrom(0.4, 1));
  assert.ok(calm.most <= 100.5, `no overshoot (${calm.most})`);
  assert.ok(Math.abs(calm.x - 100) < 0.5 && calm.t < 1.2, `settles in time (${calm.t})`);
  const bouncy = run(springFrom(0.35, 0.82), 1500);
  assert.ok(bouncy.most > 100.5, `overshoots after a flick (${bouncy.most})`);
  assert.ok(Math.abs(bouncy.x - 100) < 0.5);
  // A long frame does not blow up.
  const [x] = springStep(0, 0, 100, 0.25, springFrom(0.32, 0.86));
  assert.ok(Number.isFinite(x) && x > 0 && x < 140);
});
