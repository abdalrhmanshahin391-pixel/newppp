import assert from "node:assert/strict";
import test from "node:test";
import { lessonsDone, type LessonLite } from "./learn-home.ts";

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
