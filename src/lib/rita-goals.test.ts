import assert from "node:assert/strict";
import test from "node:test";
import { goalProgress, lessonGoal, type LessonStats } from "./rita-goals.ts";

const none: LessonStats = { turns: 0, targetTurns: 0, items: 0, retries: 0, fixed: 0 };

test("every mode has three tasks and starts at zero", () => {
  for (const mode of ["free_conversation", "guided_lesson", "pronunciation_drill"] as const) {
    const goal = lessonGoal(mode, none);
    assert.equal(goal.tasks.length, 3);
    assert.deepEqual(goalProgress(goal), { done: 0, total: 3, ratio: 0 });
  }
});

test("progress follows what the learner did", () => {
  const goal = lessonGoal("free_conversation", {
    turns: 3,
    targetTurns: 2,
    items: 1,
    retries: 1,
    fixed: 0,
  });
  assert.deepEqual(
    goal.tasks.map((task) => task.done),
    [true, true, false],
  );
  assert.equal(goalProgress(goal).done, 2);
});

test("the guided lesson needs two collected items for its second task", () => {
  assert.equal(lessonGoal("guided_lesson", { ...none, turns: 1, items: 1 }).tasks[1].done, false);
  assert.equal(lessonGoal("guided_lesson", { ...none, turns: 1, items: 2 }).tasks[1].done, true);
});

test("an unknown mode falls back to conversation practice", () => {
  const goal = lessonGoal("mystery" as never, none);
  assert.equal(goal.title, "Conversation practice");
});
