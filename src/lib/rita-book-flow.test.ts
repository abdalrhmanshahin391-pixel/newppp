import assert from "node:assert/strict";
import test from "node:test";
import {
  bookProgress,
  lessonPlan,
  lessonReadiness,
  publishPlan,
  type ExercisesState,
  type LessonLike,
} from "./rita-book-flow.ts";

const book = (read: number, status: "draft" | "published" = "draft") => ({
  status,
  page_count: 38,
  read_cursor: read,
});
const lesson = (
  id: string,
  status: LessonLike["status"] = "draft",
  from = 1,
  to = 3,
): LessonLike => ({
  id,
  status,
  topic: `topic ${id}`,
  title: `Lesson ${id}`,
  source_from_page: from,
  source_to_page: to,
});
const ex = (status: ExercisesState["status"], warnings = 0, problems = 0): ExercisesState => ({
  status,
  warnings,
  problems,
});

test("a new book starts with reading; a half-read one continues", () => {
  const fresh = bookProgress({
    book: book(0),
    lessons: [],
    missingPages: 37,
    exercises: {},
    openSuggestions: 0,
  });
  assert.deepEqual(fresh.next, { step: "read", label: "اقرأ الكتاب" });
  assert.equal(fresh.done.read, false);
  const half = bookProgress({
    book: book(20),
    lessons: [],
    missingPages: 0,
    exercises: {},
    openSuggestions: 0,
  });
  assert.equal(half.next.label, "كمّل القراءة");
});

test("after reading: make the lessons, then review, then publish", () => {
  const read = bookProgress({
    book: book(38),
    lessons: [],
    missingPages: 0,
    exercises: {},
    openSuggestions: 5,
  });
  assert.deepEqual(read.next, { step: "lessons", label: "اصنع الدروس" });
  const made = bookProgress({
    book: book(38),
    lessons: [lesson("a"), lesson("b")],
    missingPages: 0,
    exercises: { a: ex("draft"), b: ex("draft", 2) },
    openSuggestions: 0,
  });
  assert.equal(made.next.step, "review", "a lesson with warnings needs a look");
  const clean = bookProgress({
    book: book(38),
    lessons: [lesson("a"), lesson("b")],
    missingPages: 0,
    exercises: { a: ex("draft"), b: ex("draft") },
    openSuggestions: 0,
  });
  assert.deepEqual(clean.next, { step: "publish", label: "انشر للطلاب" });
  assert.equal(clean.readyLessons, 2);
  const live = bookProgress({
    book: book(38, "published"),
    lessons: [lesson("a", "published"), lesson("b", "published")],
    missingPages: 0,
    exercises: { a: ex("published"), b: ex("published") },
    openSuggestions: 0,
  });
  assert.deepEqual(live.done, { read: true, lessons: true, review: true, publish: true });
  assert.equal(live.publishedLessons, 2);
});

test("readiness of a lesson", () => {
  assert.equal(lessonReadiness(lesson("a"), undefined), "no_exercises");
  assert.equal(lessonReadiness(lesson("a"), ex("draft")), "ready");
  assert.equal(lessonReadiness(lesson("a"), ex("draft", 1)), "warnings");
  assert.equal(lessonReadiness(lesson("a"), ex("draft", 0, 2)), "problems");
  assert.equal(lessonReadiness(lesson("a", "published"), ex("published")), "published");
  assert.equal(lessonReadiness(lesson("a", "published"), undefined), "published");
  assert.equal(
    lessonReadiness(lesson("a", "published"), ex("draft")),
    "ready",
    "edited exercises of a live lesson wait to be published again",
  );
  assert.equal(lessonReadiness(lesson("a", "archived"), ex("draft")), "archived");
});

test("publish everything ready leaves out lessons with problems", () => {
  const plan = publishPlan(
    [lesson("a"), lesson("b"), lesson("c"), lesson("d", "published"), lesson("e", "archived")],
    { a: ex("draft"), b: ex("draft", 0, 1), d: ex("published") },
  );
  assert.deepEqual(plan.publish, ["a", "c"]);
  assert.deepEqual(plan.withExercises, ["a"]);
  assert.deepEqual(plan.spokenOnly, ["c"]);
  assert.deepEqual(plan.blocked, ["b"]);
});

test("the lesson plan lists every suggested topic not yet made, in page order", () => {
  const plan = lessonPlan({
    suggestions: [
      { topic: "Present simple of be", title_ar: "am is are", from_page: 4, to_page: 6 },
      { topic: "Greetings", title_ar: "التحية", from_page: 1, to_page: 3 },
      { topic: "Numbers", title_ar: "الأرقام", from_page: 30, to_page: 32 },
      { topic: "Greetings", title_ar: "التحية", from_page: 1, to_page: 3 },
    ],
    lessons: [
      { ...lesson("x"), topic: "Present simple of be", source_from_page: 4, source_to_page: 6 },
    ],
    readCursor: 20,
  });
  assert.deepEqual(
    plan.map((item) => item.topic),
    ["Greetings"],
    "made lessons, duplicates and unread pages are left out",
  );
});
