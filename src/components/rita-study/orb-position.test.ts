import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ORB, clampOrb, snapToEdge } from "./orb-position.ts";

const pane = { width: 600, height: 800, size: 56 };

test("ST-U12: the circle stays inside the pane whatever the pointer does", () => {
  assert.deepEqual(clampOrb({ x: -3, y: 9 }, pane), { x: 0, y: 1 });
  assert.deepEqual(clampOrb({ x: 0.5, y: 0.5 }, pane), { x: 0.5, y: 0.5 });
  const top = clampOrb({ x: 0.5, y: 0 }, pane);
  assert.ok(top.y > 0, "never over the pane's top strip");
  assert.deepEqual(clampOrb({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, pane), {
    x: DEFAULT_ORB.x,
    y: DEFAULT_ORB.y,
  });
});

test("a resized pane keeps the same share, and pinning snaps to the nearest side", () => {
  const small = clampOrb({ x: 0.3, y: 0.7 }, { width: 320, height: 500, size: 56 });
  assert.deepEqual(small, { x: 0.3, y: 0.7 });
  assert.deepEqual(snapToEdge({ x: 0.3, y: 0.7 }), { x: 0, y: 0.7 });
  assert.deepEqual(snapToEdge({ x: 0.8, y: 0.2 }), { x: 1, y: 0.2 });
});
