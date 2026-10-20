import assert from "node:assert/strict";
import test from "node:test";
import {
  cardsLabel,
  dayPart,
  firstName,
  goalPercent,
  lessonsDone,
  pickContinue,
  type LessonLite,
} from "./learn-home.ts";

const lesson = (id: string, state: LessonLite["state"], in_progress = false): LessonLite => ({
  id,
  title: `Lesson ${id}`,
  title_ar: `درس ${id}`,
  state,
  in_progress,
});

test("a guest is asked to sign in, whatever else is known", () => {
  assert.deepEqual(pickContinue({ signedIn: false, lessons: [lesson("1", "current")], due: 5 }), {
    kind: "signin",
  });
});

test("a lesson already started comes before due cards", () => {
  const choice = pickContinue({
    signedIn: true,
    lessons: [lesson("1", "done"), lesson("2", "current", true)],
    due: 12,
  });
  assert.deepEqual(choice, {
    kind: "lesson",
    lessonId: "2",
    title: "Lesson 2",
    titleAr: "درس 2",
    started: true,
  });
});

test("cards due come before starting the next lesson", () => {
  const choice = pickContinue({ signedIn: true, lessons: [lesson("1", "current")], due: 3 });
  assert.deepEqual(choice, { kind: "review", due: 3 });
});

test("with nothing due the next lesson is suggested", () => {
  const choice = pickContinue({
    signedIn: true,
    lessons: [lesson("1", "done"), lesson("2", "current"), lesson("3", "locked")],
    due: 0,
  });
  assert.equal(choice.kind, "lesson");
  if (choice.kind === "lesson") {
    assert.equal(choice.lessonId, "2");
    assert.equal(choice.started, false);
  }
});

test("with no lessons and nothing due the suggestion is a talk with Rita", () => {
  assert.deepEqual(pickContinue({ signedIn: true, lessons: [], due: 0 }), { kind: "talk" });
  assert.deepEqual(pickContinue({ signedIn: true, lessons: null, due: null }), { kind: "talk" });
});

test("a finished lesson is never suggested as started", () => {
  const choice = pickContinue({ signedIn: true, lessons: [lesson("1", "done", true)], due: 0 });
  assert.deepEqual(choice, { kind: "talk" });
});

test("unreadable data falls back instead of throwing", () => {
  assert.deepEqual(pickContinue({ signedIn: true, lessons: null, due: 4 }), {
    kind: "review",
    due: 4,
  });
});

test("firstName prefers the full name, then the email", () => {
  assert.equal(firstName("  Khaled  Shaheen ", "k@x.com"), "Khaled");
  assert.equal(firstName("خالد الشاهين", null), "خالد");
  assert.equal(firstName("", "sara.omar42@mail.com"), "sara");
  assert.equal(firstName(null, null), "");
  assert.equal(firstName("", ""), "");
});

test("dayPart covers the whole clock", () => {
  assert.equal(dayPart(5), "morning");
  assert.equal(dayPart(11), "morning");
  assert.equal(dayPart(12), "afternoon");
  assert.equal(dayPart(17), "afternoon");
  assert.equal(dayPart(18), "evening");
  assert.equal(dayPart(23), "evening");
  assert.equal(dayPart(0), "evening");
  assert.equal(dayPart(4), "evening");
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
