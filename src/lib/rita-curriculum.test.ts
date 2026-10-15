import assert from "node:assert/strict";
import test from "node:test";
import {
  EvaluationSchema,
  LessonDraftSchema,
  WindowSummarySchema,
  buildLessonBrief,
  buildWindowText,
  checkLessonPages,
  checkSummaryPages,
  checkWindow,
  cleanTurns,
  effectiveProgressStatus,
  evidenceIsQuoted,
  missingPages,
  pageIsReady,
  reorderPositions,
  isLessonComplete,
  lessonPathStates,
  mergeObjectiveState,
  nextWindow,
  parseJsonObject,
  scoreLesson,
  starsFor,
  taughtCursorAfterPublish,
} from "./rita-curriculum.ts";

const lesson = LessonDraftSchema.parse({
  title: "The verb to be",
  title_ar: "فعل الكينونة",
  topic: "to be",
  source_from_page: 2,
  source_to_page: 2,
  objectives: [
    {
      id: "am-is-are",
      text: "Use am, is and are",
      criteria: "Says one sentence with each form",
      check_prompts: ["Tell me about you and your friend."],
      weight: 2,
    },
    {
      id: "negative",
      text: "Make a negative",
      criteria: "Says a sentence with isn't or am not",
      check_prompts: ["What are you not?"],
    },
  ],
  plan: {
    phases: [
      { phase: "warmup", minutes: 1, steps: ["Greet"] },
      { phase: "check", minutes: 3, steps: ["Ask"] },
    ],
  },
});

test("windows are read ten pages at a time and stop at the end", () => {
  assert.deepEqual(nextWindow({ page_count: 40, read_cursor: 0 }), { from: 1, to: 10 });
  assert.deepEqual(nextWindow({ page_count: 14, read_cursor: 10 }), { from: 11, to: 14 });
  assert.equal(nextWindow({ page_count: 6, read_cursor: 6 }), null);
});

test("windows must be read in order and stay within ten pages", () => {
  const cursor = { page_count: 30, read_cursor: 10 };
  assert.deepEqual(checkWindow(cursor, 11, 20), { ok: true, advancesTo: 20 });
  assert.deepEqual(checkWindow(cursor, 1, 10), { ok: true, advancesTo: 10 });
  assert.equal(checkWindow(cursor, 12, 20).ok, false);
  assert.equal(checkWindow(cursor, 11, 21).ok, false);
  assert.equal(checkWindow({ page_count: 15, read_cursor: 10 }, 11, 16).ok, false);
});

test("summary topics must stay inside the window", () => {
  const summary = WindowSummarySchema.parse({
    overview: "Two rules",
    topics: [{ title: "to be", from_page: 2, to_page: 3 }],
  });
  assert.equal(checkSummaryPages(summary, 1, 6), null);
  assert.match(String(checkSummaryPages(summary, 3, 6)), /outside/);
});

test("lessons only use read pages and move the taught cursor forward", () => {
  assert.equal(checkLessonPages({ read_cursor: 6 }, 2, 3), null);
  assert.match(String(checkLessonPages({ read_cursor: 6 }, 5, 8)), /not been read/);
  assert.equal(taughtCursorAfterPublish({ read_cursor: 10, taught_cursor: 3 }, 6), 6);
  assert.equal(taughtCursorAfterPublish({ read_cursor: 10, taught_cursor: 8 }, 6), 8);
  assert.equal(taughtCursorAfterPublish({ read_cursor: 5, taught_cursor: 3 }, 9), 5);
});

test("lesson schema rejects duplicate objective ids", () => {
  const bad = LessonDraftSchema.safeParse({
    ...lesson,
    objectives: [lesson.objectives[0], lesson.objectives[0]],
  });
  assert.equal(bad.success, false);
});

test("evidence has to be the learner's own words", () => {
  assert.ok(evidenceIsQuoted("I am Sami", "Hello! I'm fine. I am Sami, and he is Omar."));
  assert.ok(evidenceIsQuoted("he isn’t tall", "No, he isn't tall."));
  assert.equal(evidenceIsQuoted("She is a doctor", "I am a student"), false);
  assert.equal(evidenceIsQuoted("", "anything"), false);
});

test("objectives only move forward and ignore invented evidence", () => {
  const learner = "I am Sami and my friend is Omar. We are happy.";
  const evaluation = EvaluationSchema.parse({
    updates: [
      {
        objective_id: "am-is-are",
        met: true,
        quality: 0.8,
        evidence: "I am Sami and my friend is Omar",
      },
      { objective_id: "negative", met: true, quality: 1, evidence: "I am not tired" },
      { objective_id: "unknown", met: true, quality: 1, evidence: "I am Sami" },
    ],
  });
  const first = mergeObjectiveState({}, evaluation, lesson.objectives, learner, "t1");
  assert.deepEqual(first.newlyMet, ["am-is-are"]);
  assert.equal(first.state.negative, undefined);
  assert.equal(isLessonComplete(lesson.objectives, first.state), false);

  const later = mergeObjectiveState(
    first.state,
    { updates: [{ objective_id: "am-is-are", met: false, quality: 0, evidence: "" }] },
    lesson.objectives,
    learner,
    "t2",
  );
  assert.equal(later.state["am-is-are"].met, true);

  const done = mergeObjectiveState(
    later.state,
    {
      updates: [{ objective_id: "negative", met: true, quality: 0.6, evidence: "she isn't here" }],
    },
    lesson.objectives,
    "No, she isn't here.",
    "t3",
  );
  assert.deepEqual(done.newlyMet, ["negative"]);
  assert.ok(isLessonComplete(lesson.objectives, done.state));
  // (2 * 0.8 + 1 * 0.6) / 3 = 0.733
  assert.equal(scoreLesson(lesson.objectives, done.state), 73);
});

test("stars follow the score bands", () => {
  assert.equal(starsFor(95), 3);
  assert.equal(starsFor(90), 3);
  assert.equal(starsFor(75), 2);
  assert.equal(starsFor(50), 1);
  assert.equal(starsFor(49), 0);
});

test("the first unfinished lesson is current and later ones are locked", () => {
  const nodes = lessonPathStates([{ id: "a" }, { id: "b" }, { id: "c" }], {
    a: { status: "completed", stars: 2 },
    b: { status: "in_progress", stars: 0 },
  });
  assert.deepEqual(
    nodes.map((node) => [node.id, node.state, node.stars]),
    [
      ["a", "done", 2],
      ["b", "current", 0],
      ["c", "locked", 0],
    ],
  );
});

test("lesson brief lists unmet objectives first", () => {
  const brief = buildLessonBrief(lesson, {
    "am-is-are": { met: true, quality: 1, evidence: "x", at: "t" },
  });
  assert.ok(brief.indexOf("[negative]") < brief.indexOf("[am-is-are]"));
  assert.match(brief, /already met/);
  assert.ok(buildLessonBrief(lesson, {}, 120).length <= 120);
});

test("window text keeps page markers and order", () => {
  const text = buildWindowText(
    [
      { page_no: 3, text: "third" },
      { page_no: 1, text: "first" },
      { page_no: 12, text: "outside" },
    ],
    1,
    10,
  );
  assert.ok(text.indexOf("=== Page 1 ===") < text.indexOf("=== Page 3 ==="));
  assert.equal(text.includes("outside"), false);
});

test("turns are cleaned and JSON is pulled out of fenced replies", () => {
  const turns = cleanTurns([{ role: "user", text: " hi " }, { role: "system", text: "x" }, null]);
  assert.deepEqual(turns, [{ role: "user", text: "hi" }]);
  assert.deepEqual(parseJsonObject('```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseJsonObject("no json"));
});

test("the sample books' summaries and lessons are valid imports", async () => {
  const { readFile } = await import("node:fs/promises");
  const dir = new URL("../../docs/curriculum-samples/", import.meta.url);
  for (const book of ["a1-english-grammar", "a1-english-words"]) {
    const window = JSON.parse(await readFile(new URL(`${book}.summary.json`, dir), "utf8"));
    const summary = WindowSummarySchema.parse(window.summary);
    assert.equal(checkSummaryPages(summary, window.from_page, window.to_page), null);
    const lessons = JSON.parse(await readFile(new URL(`${book}.lessons.json`, dir), "utf8"));
    assert.equal(lessons.length, 5);
    for (const item of lessons) {
      const lesson = LessonDraftSchema.parse(item.lesson);
      assert.equal(
        checkLessonPages(
          { read_cursor: window.to_page },
          lesson.source_from_page,
          lesson.source_to_page,
        ),
        null,
      );
      assert.match(item.image_url, /^\/curriculum\/[a-z-]+\.svg$/);
    }
  }
});

test("a page is readable only with long-enough text or a blank confirmation", () => {
  assert.equal(pageIsReady(25, false), true);
  assert.equal(pageIsReady(19, false), false);
  assert.equal(pageIsReady(0, true), true);
});

test("missing pages include absent rows and gaps, not only short text", () => {
  const report = [
    { page_no: 1, text_len: 500, blank_confirmed: false }, // ready
    { page_no: 3, text_len: 5, blank_confirmed: false }, // short text
    { page_no: 4, text_len: 0, blank_confirmed: true }, // confirmed blank
  ];
  // Page 2 has no row at all (interrupted import) and must be reported missing.
  assert.deepEqual(missingPages(report, 5), [2, 3, 5]);
});

test("a lesson completed once stays done while the learner retries it", () => {
  assert.equal(effectiveProgressStatus({ status: "completed", last_completed_at: null }), "completed");
  assert.equal(
    effectiveProgressStatus({ status: "in_progress", last_completed_at: "2026-10-01" }),
    "completed",
  );
  assert.equal(effectiveProgressStatus({ status: "in_progress", last_completed_at: null }), "in_progress");
  // On the path itself: the replayed lesson stays done and the frontier stays open.
  const states = lessonPathStates(
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    {
      a: { status: effectiveProgressStatus({ status: "in_progress", last_completed_at: "x" }), stars: 3 },
      b: { status: "in_progress", stars: 0 },
    },
  );
  assert.deepEqual(
    states.map((node) => node.state),
    ["done", "current", "locked"],
  );
});

test("drag reorder keeps the occupied slots so other books' lessons are untouched", () => {
  // Gaps from archived lessons must survive: ranks and slots differ here.
  const rows = [
    { id: "a", path_order: 2 },
    { id: "x", path_order: 3 },
    { id: "b", path_order: 9 },
  ];
  // Reorder subset [b, a]: b takes the lowest slot (2), a takes the highest (9); x stays 3.
  assert.deepEqual(reorderPositions(rows, ["b", "a"]), [2, 9]);
  assert.deepEqual(reorderPositions(rows, ["a", "b"]), [2, 9]);
  assert.throws(() => reorderPositions(rows, ["b", "b"]), /duplicate/);
  assert.throws(() => reorderPositions(rows, ["b", "nope"]), /unknown/);
});
