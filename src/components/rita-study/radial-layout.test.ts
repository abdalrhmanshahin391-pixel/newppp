import assert from "node:assert/strict";
import test from "node:test";
import { layoutRadial, nearestSlot } from "./radial-layout.ts";

const area = { width: 1100, height: 760, topReserve: 88 };

test("four study services fit at the saved default with room for the selection guidance", () => {
  for (const width of [390, 768, 1280]) {
    const height = 750;
    const cx = width * 0.53,
      cy = height * 0.9;
    const topReserve = width < 560 ? 180 : 120;
    const layout = layoutRadial({ width, height, cx, cy, count: 4, topReserve });
    assert.equal(layout.slots.length, 4, `all four services fit at ${width}px`);
    for (const slot of layout.slots) {
      assert.ok(cx + slot.x - 52 >= 12);
      assert.ok(cx + slot.x + 52 <= width - 12);
      assert.ok(cy + slot.y - 30 >= topReserve + 12);
      assert.ok(cy + slot.y + 58 <= height - 12);
    }
  }
});

function inside(layout: ReturnType<typeof layoutRadial>, cx: number, cy: number) {
  return layout.slots.every(
    (s) =>
      cx + s.x - 44 >= 12 &&
      cx + s.x + 44 <= area.width - 12 &&
      cy + s.y - 30 >= 12 + area.topReserve,
  );
}

test("in the middle of the area the options go all the way round", () => {
  const layout = layoutRadial({ ...area, cx: 550, cy: 400, count: 6 });
  assert.equal(layout.slots.length, 6);
  assert.ok(inside(layout, 550, 400));
  const angles = layout.slots.map((s) => Math.atan2(s.y, s.x));
  assert.ok(Math.max(...angles) - Math.min(...angles) > Math.PI * 1.2, "spread round the circle");
});

test("near an edge or a corner the options stay inside the area", () => {
  for (const [cx, cy] of [
    [60, 400],
    [1050, 400],
    [550, 700],
    [60, 700],
    [1050, 700],
    [40, 130],
  ] as const) {
    const layout = layoutRadial({ ...area, cx, cy, count: 5 });
    assert.ok(layout.slots.length >= 2, `some options at ${cx},${cy}`);
    assert.ok(inside(layout, cx, cy), `inside at ${cx},${cy}`);
  }
});

test("neighbouring options are never closer than their labels allow", () => {
  const layout = layoutRadial({ ...area, cx: 90, cy: 380, count: 7 });
  for (let i = 1; i < layout.slots.length; i += 1) {
    const a = layout.slots[i - 1];
    const b = layout.slots[i];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 90, "room between neighbours");
  }
});

test("when too many options do not fit, the capacity says how many do", () => {
  const layout = layoutRadial({
    width: 420,
    height: 520,
    topReserve: 88,
    cx: 60,
    cy: 440,
    count: 12,
  });
  assert.ok(layout.capacity < 12);
  assert.equal(layout.slots.length, layout.capacity);
});

test("the nearest option within reach is found, and none when far", () => {
  const slots = [
    { x: 100, y: 0 },
    { x: 0, y: 100 },
  ];
  assert.equal(nearestSlot(slots, 95, 8), 0);
  assert.equal(nearestSlot(slots, 2, 90), 1);
  assert.equal(nearestSlot(slots, -200, -200), -1);
});
