import { test } from "node:test";
import assert from "node:assert/strict";
import { curriculumCoverage } from "./curriculum-coverage.ts";
import { placeLessonAtGap } from "./rita-path-layout.ts";

test("coverage reports actual gaps, overlapping drafts and published coverage independently", () => {
  const result = curriculumCoverage(12, [
    { status: "published", source_from_page: 1, source_to_page: 3 },
    { status: "draft", source_from_page: 3, source_to_page: 5 },
    { status: "published", source_from_page: 9, source_to_page: 11 },
    { status: "archived", source_from_page: 6, source_to_page: 8 },
  ]);
  assert.equal(result.covered, 8);
  assert.equal(result.published, 6);
  assert.equal(result.overlaps, 1);
  assert.deepEqual(result.gaps, [
    { from: 6, to: 8 },
    { from: 12, to: 12 },
  ]);
});
test("empty books, clipped ranges and duplicate lessons do not inflate covered page totals", () => {
  assert.equal(curriculumCoverage(0, []).covered, 0);
  const range = { status: "published", source_from_page: -1, source_to_page: 20 };
  const result = curriculumCoverage(3, [range, range]);
  assert.equal(result.covered, 3);
  assert.equal(result.published, 3);
  assert.equal(result.overlaps, 3);
});
const list = [
  { type: "lesson" as const, id: "a" },
  { type: "item" as const, id: "stop" },
  { type: "lesson" as const, id: "b" },
];
test("new lessons go into the chosen gap and existing stations remain", () => {
  assert.deepEqual(
    placeLessonAtGap(list, "draft", { before: "a", after: "stop" }).map((n) => n.id),
    ["a", "draft", "stop", "b"],
  );
});
test("moving an existing lesson and choosing a gap next to itself does not duplicate it", () => {
  assert.deepEqual(
    placeLessonAtGap(list, "a", { after: "b" }).map((n) => n.id),
    ["stop", "a", "b"],
  );
  assert.deepEqual(placeLessonAtGap(list, "a", { after: "a" }), list);
  assert.deepEqual(placeLessonAtGap(list, "b", { before: "b" }), list);
});
test("stale gaps use the surviving neighbour or fail instead of silently appending", () => {
  assert.deepEqual(
    placeLessonAtGap(list, "draft", { before: "a", after: "gone" }).map((n) => n.id),
    ["a", "draft", "stop", "b"],
  );
  assert.throws(() => placeLessonAtGap(list, "draft", { before: "gone", after: "gone2" }));
});
