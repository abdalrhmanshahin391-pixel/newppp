import assert from "node:assert/strict";
import test from "node:test";
import {
  explainEngine,
  shouldPublishExercisesWithLesson,
  type EngineFacts,
} from "./rita-engine-check.ts";

const good: EngineFacts = {
  migrationReady: true,
  lessonStatus: "published",
  contentStatus: "published",
  problems: 0,
  serverKey: "ok",
  serverKeyMessage: "",
};

test("everything fine: the learner gets the exercises", () => {
  const result = explainEngine(good);
  assert.equal(result.verdict, "exercises");
  assert.ok(result.steps.every((step) => step.state === "ok"));
  assert.match(result.reason, /رح يشوف نافذة التمارين/);
});

test("exercises still a draft: says to publish them", () => {
  const result = explainEngine({ ...good, contentStatus: "draft" });
  assert.equal(result.verdict, "spoken");
  assert.equal(result.steps.find((step) => step.id === "published")?.state, "fail");
  assert.match(result.reason, /نشر للطلاب/);
});

test("no exercises written: the later steps are unknown, not failed", () => {
  const result = explainEngine({ ...good, contentStatus: "none" });
  assert.equal(result.steps.find((step) => step.id === "written")?.state, "fail");
  assert.equal(result.steps.find((step) => step.id === "published")?.state, "unknown");
  assert.equal(result.steps.find((step) => step.id === "problems")?.state, "unknown");
  assert.match(result.reason, /اصنع التمارين/);
});

test("a lesson that is still a draft is named before the exercises", () => {
  const result = explainEngine({ ...good, lessonStatus: "draft", contentStatus: "draft" });
  assert.match(result.reason, /الدرس لسا مسودة/);
});

test("a missing server key is explained as a server problem, with the other steps still green", () => {
  const result = explainEngine({ ...good, serverKey: "missing" });
  assert.equal(result.verdict, "spoken");
  assert.equal(result.steps.filter((step) => step.state === "fail").length, 1);
  assert.match(result.reason, /مفتاح الوصول الكامل/);
});

test("another server error shows its own message", () => {
  const result = explainEngine({
    ...good,
    serverKey: "error",
    serverKeyMessage: "permission denied",
  });
  assert.match(result.reason, /permission denied/);
});

test("missing migration comes first", () => {
  const result = explainEngine({
    ...good,
    migrationReady: false,
    contentStatus: "none",
    lessonStatus: "draft",
  });
  assert.match(result.reason, /migration/);
});

test("problems in the exercises are counted", () => {
  const result = explainEngine({ ...good, contentStatus: "draft", problems: 3 });
  assert.match(result.steps.find((step) => step.id === "problems")?.hint ?? "", /3 مشكلة/);
});

test("publishing a lesson takes its sound draft exercises with it, and nothing else", () => {
  assert.equal(
    shouldPublishExercisesWithLesson({ hasContent: true, status: "draft", problems: 0 }),
    true,
  );
  assert.equal(
    shouldPublishExercisesWithLesson({ hasContent: true, status: "draft", problems: 2 }),
    false,
  );
  assert.equal(
    shouldPublishExercisesWithLesson({ hasContent: true, status: "published", problems: 0 }),
    false,
  );
  assert.equal(
    shouldPublishExercisesWithLesson({ hasContent: false, status: "none", problems: 0 }),
    false,
  );
});
