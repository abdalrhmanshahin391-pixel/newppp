import assert from "node:assert/strict";
import test from "node:test";
import { fitWheel, sliceAt, slicePath, WHEEL_CHIP, WHEEL_TICKS } from "./wheel-layout.ts";

test("a short move picks the slice it points at, clockwise from the top", () => {
  assert.equal(sliceAt(0, -40, 8, 20), 0); // up: the first slice
  assert.equal(sliceAt(40, -40, 8, 20), 1); // up and right
  assert.equal(sliceAt(40, 0, 8, 20), 2); // right
  assert.equal(sliceAt(0, 40, 8, 20), 4); // down
  assert.equal(sliceAt(-40, 0, 8, 20), 6); // left
  assert.equal(sliceAt(-40, -40, 8, 20), 7); // up and left
  assert.equal(sliceAt(-3, -300, 8, 20), 0); // far away still counts by direction
});

test("inside the dead zone around the circle nothing is picked", () => {
  assert.equal(sliceAt(5, -10, 8, 20), -1);
});

test("the wheel stays whole: near an edge or a corner it moves inwards, never shrinks its slices", () => {
  const middle = fitWheel({ cx: 600, cy: 450, width: 1180, height: 820, top: 120 });
  assert.equal(middle.cx, 600);
  assert.equal(middle.cy, 450);
  assert.equal(middle.r1, 142);

  const corner = fitWheel({ cx: 1150, cy: 800, width: 1180, height: 820, top: 120 });
  const reach = corner.r1 + WHEEL_TICKS;
  assert.ok(corner.cx + reach <= 1180, "inside on the right");
  assert.ok(corner.cy + reach <= 820, "inside at the bottom");
  assert.equal(corner.r1, middle.r1, "the same wheel");

  const topLeft = fitWheel({ cx: 10, cy: 10, width: 1180, height: 820, top: 120 });
  assert.ok(topLeft.cx - (topLeft.r1 + WHEEL_TICKS) >= 0);
  assert.ok(topLeft.cy - (topLeft.r1 + WHEEL_TICKS) - WHEEL_CHIP >= 120, "below the top strip");
});

test("on a narrow phone the wheel is smaller but still whole", () => {
  const phone = fitWheel({ cx: 330, cy: 700, width: 330, height: 640, top: 180 });
  assert.ok(phone.r1 < 142 && phone.r1 >= 104, String(phone.r1));
  assert.ok(phone.cx - phone.r1 - WHEEL_TICKS >= 0 && phone.cx + phone.r1 + WHEEL_TICKS <= 330);
});

test("a 390px phone keeps the full-size wheel, whole", () => {
  const phone = fitWheel({ cx: 360, cy: 700, width: 390, height: 760, top: 180 });
  assert.ok(phone.cx - phone.r1 - WHEEL_TICKS >= 0 && phone.cx + phone.r1 + WHEEL_TICKS <= 390);
});

test("a slice is a closed ring piece", () => {
  const d = slicePath(100, 100, 40, 120, 0, 8);
  assert.match(d, /^M[-\d.]+ [-\d.]+ A120 120 0 0 1 .* L.* A40 40 0 0 0 .* Z$/);
});
