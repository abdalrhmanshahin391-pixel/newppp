import assert from "node:assert/strict";
import test from "node:test";
import {
  guidePages,
  kindCounts,
  missingSteps,
  needsGuide,
  pipelineView,
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

test("only a green lesson without its guide asks to be finished", () => {
  assert.equal(needsGuide("study", false, true), true);
  assert.equal(needsGuide("study", true, true), false);
  // A red lesson never needs a guide.
  assert.equal(needsGuide("classic", false, true), false);
  // Without the study tables there is nothing to finish.
  assert.equal(needsGuide("study", false, false), false);
});

test("the filter counts each lesson once, under its kind", () => {
  assert.deepEqual(kindCounts(["classic", "study", "study"]), { all: 3, classic: 1, study: 2 });
  assert.deepEqual(kindCounts([]), { all: 0, classic: 0, study: 0 });
});

test("a guide never asks for more than 10 pages", () => {
  assert.deepEqual(guidePages(4, 6), { fromPage: 4, toPage: 6 });
  assert.deepEqual(guidePages(4, 30), { fromPage: 4, toPage: 13 });
  assert.deepEqual(guidePages(5, 3), { fromPage: 5, toPage: 5 });
});
