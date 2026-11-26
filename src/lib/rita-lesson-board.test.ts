import assert from "node:assert/strict";
import test from "node:test";
import {
  boardChoices,
  boardStats,
  boardView,
  lessonBoard,
  tabOf,
  type BoardBook,
  type BoardLesson,
} from "./rita-lesson-board.ts";

const book = (id: string, level: string, status: BoardBook["status"] = "draft"): BoardBook => ({
  id,
  title: `Book ${id}`,
  title_ar: `كتاب ${id}`,
  level,
  status,
});

const lesson = (
  id: string,
  bookId: string,
  no: number,
  status: BoardLesson["status"] = "draft",
): BoardLesson => ({
  id,
  curriculum_id: bookId,
  lesson_no: no,
  status,
  topic: `topic ${id}`,
  title: `Lesson ${id}`,
  title_ar: `درس ${id}`,
  source_from_page: no,
  source_to_page: no + 1,
});

const books = [book("a", "a1"), book("b", "A2", "published"), book("x", "A1", "archived")];
const lessons = [
  lesson("1", "a", 2),
  lesson("2", "a", 1),
  lesson("3", "a", 3),
  lesson("4", "b", 1, "published"),
  lesson("5", "b", 2, "archived"),
  lesson("6", "x", 1),
];
const slides = {
  a: { "1": { linked: true, notes: 0 }, "2": { linked: true, notes: 2 } },
  b: { "4": { linked: true, notes: 0 } },
};

test("the board keeps live lessons of live books, each with its state and level", () => {
  const entries = lessonBoard({ books, lessons, slides });
  assert.deepEqual(
    entries.map((e) => [e.lesson.id, e.readiness, e.level, e.notes]),
    [
      ["1", "ready", "A1", 0],
      ["2", "warnings", "A1", 2],
      ["3", "no_slides", "A1", 0],
      ["4", "published", "A2", 0],
    ],
  );
  assert.deepEqual(entries.map(tabOf), ["ready", "ready", null, "published"]);
});

test("the numbers at the top", () => {
  const stats = boardStats(lessonBoard({ books, lessons, slides }));
  assert.deepEqual(stats, {
    ready: 2,
    warnings: 1,
    published: 1,
    unfinished: 1,
    byLevel: [{ level: "A2", count: 1 }],
  });
});

test("a tab is filtered by level, book and words, in lesson order", () => {
  const entries = lessonBoard({ books, lessons, slides });
  assert.deepEqual(
    boardView(entries, { tab: "ready" }).map((e) => e.lesson.id),
    ["2", "1"],
  );
  assert.deepEqual(boardView(entries, { tab: "ready", level: "A2" }), []);
  assert.deepEqual(
    boardView(entries, { tab: "ready", book: "a", query: "درس 1" }).map((e) => e.lesson.id),
    ["1"],
  );
  assert.deepEqual(
    boardView(entries, { tab: "published", level: "all", book: "all" }).map((e) => e.lesson.id),
    ["4"],
  );
  assert.deepEqual(boardChoices(entries, "ready"), { levels: ["A1"], books: [books[0]] });
});
