import assert from "node:assert/strict";
import test from "node:test";
import { cardsLabel, goalPercent, lessonsDone, type LessonLite } from "./learn-home.ts";

const lesson = (id: string, state: LessonLite["state"], in_progress = false): LessonLite => ({
  id,
  title: `Lesson ${id}`,
  title_ar: `درس ${id}`,
  state,
  in_progress,
});

test("lessonsDone counts only finished lessons", () => {
  assert.deepEqual(
    lessonsDone([lesson("1", "done"), lesson("2", "current"), lesson("3", "locked")]),
    { done: 1, total: 3 },
  );
  assert.deepEqual(lessonsDone(null), { done: 0, total: 0 });
});

test("labels and goal percent are safe", () => {
  assert.equal(cardsLabel(1), "1 card");
  assert.equal(cardsLabel(0), "0 cards");
  assert.equal(cardsLabel(10), "10 cards");
  assert.equal(goalPercent(5, 20), 25);
  assert.equal(goalPercent(30, 20), 100);
  assert.equal(goalPercent(0, 0), 0);
  assert.equal(goalPercent(-3, 20), 0);
  assert.equal(goalPercent(Number.NaN, 20), 0);
});
