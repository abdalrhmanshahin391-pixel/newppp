import assert from "node:assert/strict";
import test from "node:test";
import {
  bookRows,
  bookSummary,
  guidePages,
  makeAllQueue,
  missingSteps,
  pipelineView,
  rowAction,
  rowStatus,
  type LessonFacts,
} from "./lesson-maker.ts";

const all = { exercisesReady: true, studyReady: true };
const lesson = (facts: Partial<LessonFacts> = {}): LessonFacts => ({
  exists: true,
  status: "draft",
  exercises: "draft",
  linked: true,
  ...facts,
});

test("a suggestion needs every step; a finished lesson needs none", () => {
  assert.deepEqual(missingSteps({ exists: false }, all), ["lesson", "exercises", "guide", "link"]);
  assert.deepEqual(missingSteps(lesson(), all), []);
  assert.deepEqual(missingSteps(lesson({ exercises: "none" }), all), ["exercises"]);
  // The guide and its link always go together.
  assert.deepEqual(missingSteps(lesson({ linked: false }), all), ["guide", "link"]);
});

test("a step whose tables are not there yet is skipped, not left forever missing", () => {
  assert.deepEqual(
    missingSteps(lesson({ linked: false, exercises: "none" }), {
      exercisesReady: false,
      studyReady: false,
    }),
    [],
  );
  assert.deepEqual(missingSteps({ exists: false }, { exercisesReady: false, studyReady: false }), [
    "lesson",
  ]);
});

test("the row's word and its one button follow the lesson's state", () => {
  const cases: [LessonFacts, string, string | null][] = [
    [{ exists: false }, "new", "make"],
    [lesson({ linked: false }), "incomplete", "continue"],
    [lesson(), "ready", "publish"],
    [lesson({ status: "published" }), "published", "open"],
    // An old published lesson without a guide still offers to finish it.
    [lesson({ status: "published", linked: false }), "incomplete", "continue"],
  ];
  for (const [facts, status, action] of cases) {
    assert.equal(rowStatus(facts, all), status);
    assert.equal(rowAction(rowStatus(facts, all)), action);
  }
});

test("what is happening now wins over what the database says", () => {
  assert.equal(rowStatus(lesson(), all, { state: "running", step: "guide" }), "working");
  assert.equal(rowStatus({ exists: false }, all, { state: "queued" }), "queued");
  const failed = rowStatus(lesson({ linked: false }), all, {
    state: "failed",
    step: "link",
    message: "x",
  });
  assert.equal(failed, "failed");
  assert.equal(rowAction(failed), "retry");
  assert.equal(rowAction("working"), null);
  assert.equal(rowAction("queued"), null);
});

test("the step line shows done, now and still to do", () => {
  assert.deepEqual(
    pipelineView(lesson({ linked: false }), all, { state: "running", step: "guide" }).map(
      (s) => s.state,
    ),
    ["done", "done", "now", "todo"],
  );
  assert.deepEqual(
    pipelineView({ exists: false }, all, { state: "failed", step: "lesson", message: "x" }).map(
      (s) => s.state,
    ),
    ["failed", "todo", "todo", "todo"],
  );
  // Without the study tables there is no guide step to show.
  assert.deepEqual(
    pipelineView({ exists: false }, { exercisesReady: true, studyReady: false }, undefined).map(
      (s) => s.step,
    ),
    ["lesson", "exercises"],
  );
});

test("one list: lessons and suggestions in page order, archived lessons left out", () => {
  const rows = bookRows(
    [
      {
        id: "b",
        lesson_no: 2,
        title: "B",
        title_ar: "",
        topic: "b",
        source_from_page: 7,
        source_to_page: 9,
        status: "draft",
      },
      {
        id: "a",
        lesson_no: 1,
        title: "A",
        title_ar: "أ",
        topic: "a",
        source_from_page: 4,
        source_to_page: 6,
        status: "published",
      },
      {
        id: "z",
        lesson_no: 3,
        title: "Z",
        title_ar: "",
        topic: "z",
        source_from_page: 1,
        source_to_page: 2,
        status: "archived",
      },
    ],
    [
      { topic: "c", title_ar: "ج", from_page: 10, to_page: 12 } as never,
      { topic: "s", title_ar: "", from_page: 7, to_page: 9 } as never,
    ],
  );
  assert.deepEqual(
    rows.map((row) => [row.key.startsWith("s:") ? "suggestion" : row.key, row.title]),
    [
      ["a", "أ"],
      ["b", "B"],
      ["suggestion", "s"],
      ["suggestion", "ج"],
    ],
  );
});

test("make all takes only what is unfinished; the summary counts each row once", () => {
  assert.deepEqual(
    makeAllQueue([
      { key: "1", status: "published" },
      { key: "2", status: "new" },
      { key: "3", status: "working" },
      { key: "4", status: "failed" },
      { key: "5", status: "incomplete" },
      { key: "6", status: "ready" },
    ]),
    ["2", "4", "5"],
  );
  const summary = bookSummary(["published", "ready", "working", "queued", "new", "failed"]);
  assert.deepEqual([summary.published, summary.ready, summary.working, summary.left], [1, 1, 2, 2]);
});

test("a guide never asks for more than 10 pages", () => {
  assert.deepEqual(guidePages(4, 6), { fromPage: 4, toPage: 6 });
  assert.deepEqual(guidePages(4, 30), { fromPage: 4, toPage: 13 });
  assert.deepEqual(guidePages(5, 3), { fromPage: 5, toPage: 5 });
});
