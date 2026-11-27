import assert from "node:assert/strict";
import test from "node:test";
import { frontierUnit, unitOpen, unitsOf, visibleUnits, type UnitStop } from "./rita-path-units.ts";
import type { ViewState } from "./rita-path-levels.ts";

const banner: UnitStop = { kind: "banner" };
const stop: UnitStop = { kind: "stop" };
const lesson = (state: ViewState = "locked"): UnitStop => ({ kind: "lesson", state });
const marker = (id: string, title: string): UnitStop => ({ kind: "marker", id, title });
const spans = (stops: UnitStop[], size?: number) =>
  unitsOf("A1", stops, size).map((unit) => [unit.start, unit.end]);

test("a level without markers is cut every five lessons; stops stay with the lesson before", () => {
  const stops = [banner, ...Array.from({ length: 12 }, () => lesson())];
  stops.splice(6, 0, stop); // a quiz after the fifth lesson
  assert.deepEqual(spans(stops), [
    [1, 7],
    [7, 12],
    [12, 14],
  ]);
  const units = unitsOf("A1", stops);
  assert.deepEqual(
    units.map((unit) => [unit.key, unit.number, unit.lessons]),
    [
      ["A1:1", 1, 5],
      ["A1:2", 2, 5],
      ["A1:3", 3, 2],
    ],
  );
});

test("stops before the first lesson join the first unit, and the finish the last", () => {
  assert.deepEqual(spans([banner, stop, lesson(), lesson(), stop], 1), [
    [1, 3],
    [3, 5],
  ]);
});

test("admin markers start and name units; lessons before the first marker form unit one", () => {
  const stops = [
    banner,
    lesson("done"),
    marker("m1", " Saying hello "),
    lesson("done"),
    lesson("current"),
    marker("m2", ""),
    lesson(),
    stop,
  ];
  const units = unitsOf("A2", stops);
  assert.deepEqual(
    units.map((unit) => [unit.key, unit.title, unit.start, unit.end, unit.lessons]),
    [
      ["A2:1", null, 1, 2, 1],
      ["m1", "Saying hello", 2, 5, 2],
      ["m2", null, 5, 8, 1],
    ],
  );
  assert.equal(frontierUnit(units), 1);
  // Markers set the units' length: no automatic cut even past five lessons.
  assert.equal(unitsOf("A1", [marker("m", "x"), ...Array(9).fill(lesson())]).length, 1);
});

test("the learner is on the unit with the current lesson, and sees one closed unit after", () => {
  const stops = [
    banner,
    ...Array(5).fill(lesson("done")),
    lesson("done"),
    lesson("current"),
    ...Array(8).fill(lesson()),
  ];
  const units = unitsOf("A1", stops);
  assert.equal(units.length, 3);
  assert.equal(frontierUnit(units), 1);
  assert.deepEqual(
    units.map((_, index) => unitOpen(units, index)),
    [true, true, false],
  );
  assert.equal(visibleUnits(units), 3);
  // Only the next closed unit shows, never the ones after it.
  const longer = unitsOf("A1", [...stops, ...Array(10).fill(lesson())]);
  assert.equal(longer.length, 5);
  assert.equal(visibleUnits(longer), 3);
});

test("a finished level opens every unit; a skipped level (open lessons) does too", () => {
  const done = unitsOf("A1", Array(7).fill(lesson("done")));
  assert.equal(frontierUnit(done), 1);
  assert.equal(visibleUnits(done), 2);
  const skipped = unitsOf("A1", Array(11).fill(lesson("open")));
  assert.deepEqual(
    skipped.map((_, index) => unitOpen(skipped, index)),
    [true, true, true],
  );
  assert.equal(visibleUnits(skipped), 3);
  assert.equal(frontierUnit([]), -1);
});
