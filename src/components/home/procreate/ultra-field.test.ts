import assert from "node:assert/strict";
import test from "node:test";
import { buildField, gridStep, ringLight, RING, wander } from "./ultra-field.ts";

test("the field covers the hero and is the same on every build", () => {
  const a = buildField(1440, 900);
  const b = buildField(1440, 900);
  assert.equal(a.step, 24);
  assert.ok(a.count > 2000 && a.count < 3000, `count ${a.count}`);
  assert.deepEqual(a.points, b.points);
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < a.count; i += 1) {
    maxX = Math.max(maxX, a.points[i * 3]);
    maxY = Math.max(maxY, a.points[i * 3 + 1]);
    const k = a.points[i * 3 + 2];
    assert.ok(k >= 0 && k < 1);
  }
  assert.ok(maxX >= 1440 - a.step && maxY >= 900 - a.step);
});

test("phones get a closer grid", () => {
  assert.equal(gridStep(390), 20);
  assert.equal(gridStep(1024), 24);
});

test("the ring lights marks at its edge and fades both ways", () => {
  const size = 900;
  const edge = RING.radius * size;
  assert.equal(ringLight(edge, size), 1);
  assert.ok(ringLight(edge + 60, size) > 0.5);
  assert.ok(ringLight(edge + 400, size) < 0.01);
  assert.ok(ringLight(edge - 100, size) < 0.01);
  assert.ok(ringLight(0, size) < 0.01);
});

test("on its own the ring stays inside the hero", () => {
  for (let t = 0; t < 600; t += 0.5) {
    const { x, y } = wander(t);
    assert.ok(x > 0.15 && x < 0.85 && y > 0.35 && y < 0.8, `${x}, ${y} at ${t}`);
  }
});
