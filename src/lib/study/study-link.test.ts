import assert from "node:assert/strict";
import test from "node:test";
import { coversLesson, highWarnings, learnerGuidePath, linkProblem } from "./study-link.ts";

const lesson = { curriculum_id: "b1", source_from_page: 10, source_to_page: 12 };
const guide = {
  curriculum_id: "b1",
  status: "ready",
  from_page: 10,
  to_page: 11,
  warnings: [{ severity: "low" }, { severity: "medium" }],
  content_ok: true,
};

test("ST-I09 (pure part): only a ready, readable guide of the same book without a high warning", () => {
  assert.equal(linkProblem(guide, lesson), null);
  assert.equal(linkProblem({ ...guide, curriculum_id: "b2" }, lesson), "other_book");
  for (const status of ["writing", "written", "rendering", "failed"])
    assert.equal(linkProblem({ ...guide, status }, lesson), "not_ready");
  assert.equal(linkProblem({ ...guide, content_ok: false }, lesson), "bad_content");
  assert.equal(
    linkProblem({ ...guide, warnings: [{ severity: "high", problem: "wrong form" }] }, lesson),
    "high_warning",
  );
});

test("warnings that are not a list count as none", () => {
  assert.equal(highWarnings(null), 0);
  assert.equal(highWarnings([{ severity: "high" }, null, "x"]), 1);
});

test("a guide is offered when its pages overlap the lesson's pages", () => {
  assert.equal(coversLesson({ from_page: 12, to_page: 14 }, lesson), true);
  assert.equal(coversLesson({ from_page: 13, to_page: 14 }, lesson), false);
  assert.equal(coversLesson({ from_page: 1, to_page: 9 }, lesson), false);
});

test("the learners' copy sits next to the draft and never overwrites it", () => {
  assert.equal(learnerGuidePath("c", "g", 3), "c/g-v3-final.pdf");
});
