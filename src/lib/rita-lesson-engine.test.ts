import assert from "node:assert/strict";
import test from "node:test";
import { contentProblems, LessonContentSchema, type LessonContent } from "./rita-lesson-content.ts";
import {
  initialState,
  lessonScore,
  lessonStars,
  reduce,
  remediationQueue,
  stepOf,
  type LessonEvent,
  type RunState,
} from "./rita-lesson-engine.ts";
import { gradeItem, publicItem } from "./rita-lesson-grader.ts";
import { findItem } from "./rita-lesson-content.ts";
import { SAMPLE_PROPERTY, SAMPLE_TO_BE } from "./rita-lesson-samples.ts";

const SEED = "run-1";

function send(content: LessonContent, state: RunState, event: LessonEvent): RunState {
  const result = reduce(content, state, event, state.revision);
  assert.equal(
    result.ok,
    true,
    `event ${event.type} was refused: ${result.ok ? "" : result.reason}`,
  );
  return result.state;
}

/** Answers the open item right (or with a given wrong value) through the real grader. */
function answer(content: LessonContent, state: RunState, right: boolean): RunState {
  const step = stepOf(content, state);
  assert.ok(step.item, `no open item in phase ${state.phase}`);
  const item = findItem(content, step.item.id)!.item;
  let response;
  if (step.item.options.length) {
    const correct =
      item.template === "choice_fill" || item.template === "meaning_choice" ? item.answer : "";
    const value = right ? correct : step.item.options.find((option) => option !== correct)!;
    response = { kind: "choice" as const, value };
  } else {
    const order = (
      item.template === "word_order" || item.template === "syllable_tiles" ? item.answer : []
    ).map((text) => step.item!.tiles.find((tile) => tile.text === text)!.id);
    response = { kind: "tiles" as const, order: right ? order : [...order].reverse() };
  }
  const grade = gradeItem(item, response, state.seed);
  return send(content, state, { type: "graded", item_id: item.id, grade });
}

function toPractice(content: LessonContent): RunState {
  let state = initialState(content, SEED);
  state = send(content, state, { type: "ready" });
  assert.equal(state.phase, "explain");
  state = send(content, state, { type: "no_question" });
  if (state.phase === "guided") state = answer(content, state, true);
  assert.equal(state.phase, "practice");
  return state;
}

test("the sample lessons have no content problems", () => {
  assert.deepEqual(contentProblems(SAMPLE_TO_BE), []);
  assert.deepEqual(contentProblems(SAMPLE_PROPERTY), []);
});

test("content checks catch an answer that is not an option, a double gap and wrong tiles", () => {
  const broken = LessonContentSchema.parse({
    ...SAMPLE_TO_BE,
    sections: [
      {
        ...SAMPLE_TO_BE.sections[0],
        practice: [
          { ...SAMPLE_TO_BE.sections[0].practice[0], answer: "be" },
          { ...SAMPLE_TO_BE.sections[0].practice[1], prompt: "They ___ ___ friends." },
          {
            id: "s_bad",
            template: "syllable_tiles",
            skill_tag: "x",
            prompt: "Build",
            word: "property",
            answer: ["pro", "per"],
          },
        ],
      },
    ],
  });
  const problems = contentProblems(broken).join("\n");
  assert.match(problems, /"be" must be exactly one of the options/);
  assert.match(problems, /exactly one ___ \(found 2\)/);
  assert.match(problems, /make "proper", not "property"/);
  assert.match(problems, /has 3 practice questions; it needs 5/);
});

test("a perfect run goes through every section and earns three stars", () => {
  let state = initialState(SAMPLE_TO_BE, SEED);
  state = send(SAMPLE_TO_BE, state, { type: "ready" });
  for (let section = 0; section < SAMPLE_TO_BE.sections.length; section += 1) {
    assert.equal(state.phase, "explain");
    state = send(SAMPLE_TO_BE, state, { type: "no_question" });
    while (state.phase === "guided" || state.phase === "practice")
      state = answer(SAMPLE_TO_BE, state, true);
    assert.equal(state.phase, "section_result");
    assert.equal(state.tallies[section].outcome, "passed");
    state = send(SAMPLE_TO_BE, state, { type: "ready" });
  }
  assert.equal(state.phase, "wrap");
  assert.equal(stepOf(SAMPLE_TO_BE, state).summary?.summary_ar.length ? true : false, true);
  state = send(SAMPLE_TO_BE, state, { type: "ready" });
  assert.equal(state.phase, "done");
  assert.equal(lessonStars(state), 3);
  assert.equal(lessonScore(state), 100);
});

test("asking a question during the explanation keeps the step; no-question is not mastery", () => {
  let state = initialState(SAMPLE_TO_BE, SEED);
  state = send(SAMPLE_TO_BE, state, { type: "ready" });
  const revision = state.revision;
  state = send(SAMPLE_TO_BE, state, { type: "question" });
  assert.equal(state.phase, "explain");
  assert.equal(state.revision, revision, "a question does not change the step");
  state = send(SAMPLE_TO_BE, state, { type: "no_question" });
  assert.equal(state.phase, "guided");
  assert.equal(state.log.length, 0);
});

test("a wrong answer gives a hint and a second try; the second wrong one shows the answer", () => {
  let state = toPractice(SAMPLE_TO_BE);
  const first = stepOf(SAMPLE_TO_BE, state).item!.id;
  state = answer(SAMPLE_TO_BE, state, false);
  let step = stepOf(SAMPLE_TO_BE, state);
  assert.equal(step.item!.id, first, "same question again");
  assert.equal(step.feedback!.status, "wrong");
  assert.ok(step.feedback!.hint_ar.length > 0);
  assert.equal(step.feedback!.answer, "", "the answer stays hidden before the item is settled");
  state = answer(SAMPLE_TO_BE, state, false);
  step = stepOf(SAMPLE_TO_BE, state);
  assert.notEqual(step.item!.id, first, "moved on");
  assert.equal(step.feedback!.status, "revealed");
  assert.equal(step.feedback!.answer, "am");
  assert.equal(state.log.at(-1)!.independent, false);
});

test("right after a wrong try counts as right but not independent", () => {
  let state = toPractice(SAMPLE_TO_BE);
  state = answer(SAMPLE_TO_BE, state, false);
  state = answer(SAMPLE_TO_BE, state, true);
  const record = state.log.at(-1)!;
  assert.equal(record.correct, true);
  assert.equal(record.independent, false);
});

test("a hint makes the answer not independent", () => {
  let state = toPractice(SAMPLE_TO_BE);
  const id = stepOf(SAMPLE_TO_BE, state).item!.id;
  state = send(SAMPLE_TO_BE, state, { type: "hint", item_id: id });
  assert.equal(stepOf(SAMPLE_TO_BE, state).feedback!.status, "hint");
  state = answer(SAMPLE_TO_BE, state, true);
  assert.equal(state.log.at(-1)!.independent, false);
});

test("unclear speech is not counted and does not use a try", () => {
  let state = toPractice(SAMPLE_TO_BE);
  const id = stepOf(SAMPLE_TO_BE, state).item!.id;
  const item = findItem(SAMPLE_TO_BE, id)!.item;
  const grade = gradeItem(item, { kind: "spoken", text: "his" }, SEED);
  assert.equal(grade.status, "unclear");
  state = send(SAMPLE_TO_BE, state, { type: "graded", item_id: id, grade });
  assert.equal(state.current!.tries, 0);
  assert.equal(state.log.filter((record) => record.phase === "practice").length, 0);
  state = answer(SAMPLE_TO_BE, state, true);
  assert.equal(state.log.at(-1)!.independent, true);
});

test("a stale revision is refused, so a spoken and a tapped answer count once", () => {
  const state = toPractice(SAMPLE_TO_BE);
  const id = stepOf(SAMPLE_TO_BE, state).item!.id;
  const item = findItem(SAMPLE_TO_BE, id)!.item;
  const tap = gradeItem(item, { kind: "choice", value: "am" }, SEED);
  const voice = gradeItem(item, { kind: "spoken", text: "am" }, SEED);
  const first = reduce(
    SAMPLE_TO_BE,
    state,
    { type: "graded", item_id: id, grade: tap },
    state.revision,
  );
  assert.ok(first.ok);
  const second = reduce(
    SAMPLE_TO_BE,
    first.state,
    { type: "graded", item_id: id, grade: voice },
    state.revision,
  );
  assert.equal(second.ok, false);
  assert.equal(second.ok ? "" : second.reason, "stale");
  assert.equal(first.state.log.filter((record) => record.item_id === id).length, 1);
});

test("an answer for another item is refused", () => {
  const state = toPractice(SAMPLE_TO_BE);
  const grade = { status: "correct" as const, given: "is" };
  const result = reduce(
    SAMPLE_TO_BE,
    state,
    { type: "graded", item_id: "p_book", grade },
    state.revision,
  );
  assert.equal(result.ok ? "" : result.reason, "wrong_item");
});

test("pausing blocks answers until the learner resumes, on the same question", () => {
  let state = toPractice(SAMPLE_TO_BE);
  state = answer(SAMPLE_TO_BE, state, true);
  const id = stepOf(SAMPLE_TO_BE, state).item!.id;
  state = send(SAMPLE_TO_BE, state, { type: "pause" });
  const blocked = reduce(
    SAMPLE_TO_BE,
    state,
    { type: "graded", item_id: id, grade: { status: "correct", given: "are" } },
    state.revision,
  );
  assert.equal(blocked.ok ? "" : blocked.reason, "paused");
  state = send(SAMPLE_TO_BE, state, { type: "question" });
  state = send(SAMPLE_TO_BE, state, { type: "resume" });
  assert.equal(stepOf(SAMPLE_TO_BE, state).item!.id, id);
});

test("reveal is only allowed after a wrong try", () => {
  let state = toPractice(SAMPLE_TO_BE);
  const id = stepOf(SAMPLE_TO_BE, state).item!.id;
  const early = reduce(SAMPLE_TO_BE, state, { type: "reveal", item_id: id }, state.revision);
  assert.equal(early.ok ? "" : early.reason, "not_allowed");
  state = answer(SAMPLE_TO_BE, state, false);
  state = send(SAMPLE_TO_BE, state, { type: "reveal", item_id: id });
  assert.equal(state.log.at(-1)!.revealed, true);
});

test("failing a section starts remediation on the missed skill; passing it moves on with help", () => {
  let state = toPractice(SAMPLE_TO_BE);
  // Wrong twice on the first two questions (I and they), right on the rest: 3 of 5 independent.
  for (let index = 0; index < 2; index += 1) {
    state = answer(SAMPLE_TO_BE, state, false);
    state = answer(SAMPLE_TO_BE, state, false);
  }
  while (state.phase === "practice") state = answer(SAMPLE_TO_BE, state, true);
  assert.equal(state.phase, "remediation");
  assert.equal(state.tallies[0].first_try, 3);
  const queue = state.queue;
  assert.equal(queue.length, 3);
  const skills = queue.map((id) => findItem(SAMPLE_TO_BE, id)!.item.skill_tag);
  assert.ok(
    skills.slice(0, 2).every((skill) => skill === "be.i" || skill === "be.plural"),
    skills.join(),
  );
  while (state.phase === "remediation") state = answer(SAMPLE_TO_BE, state, true);
  assert.equal(state.phase, "section_result");
  assert.equal(state.tallies[0].outcome, "passed_after_help");
});

test("remediation runs at most twice, then the lesson moves on", () => {
  let state = toPractice(SAMPLE_TO_BE);
  while (state.phase === "practice") state = answer(SAMPLE_TO_BE, state, false);
  let rounds = 0;
  while (state.phase === "remediation") {
    rounds = state.tallies[0].remediation_rounds;
    state = answer(SAMPLE_TO_BE, state, false);
  }
  assert.equal(rounds, 2);
  assert.equal(state.phase, "section_result");
  assert.equal(state.tallies[0].outcome, "moved_on");
});

test("remediation prefers fresh items and reuses only when nothing new is left", () => {
  const state = toPractice(SAMPLE_TO_BE);
  const section = SAMPLE_TO_BE.sections[0];
  const missedAll: RunState = {
    ...state,
    log: section.practice.slice(0, 5).map((item) => ({
      item_id: item.id,
      phase: "practice",
      section: 0,
      tries: 2,
      hint: false,
      revealed: true,
      correct: false,
      independent: false,
    })),
  };
  const queue = remediationQueue(section, missedAll, 0);
  assert.deepEqual(new Set(queue), new Set(["r_he", "r_you", "r_i"]));
});

test("two off-topic turns in a row offer to end; an on-topic turn clears the offer", () => {
  let state = toPractice(SAMPLE_TO_BE);
  state = send(SAMPLE_TO_BE, state, { type: "off_topic" });
  assert.equal(state.offer_end, false);
  state = send(SAMPLE_TO_BE, state, { type: "off_topic" });
  assert.equal(state.offer_end, true);
  assert.equal(stepOf(SAMPLE_TO_BE, state).offer_end, true);
  state = answer(SAMPLE_TO_BE, state, true);
  assert.equal(state.offer_end, false);
});

test("ending early gives no stars and nothing more is accepted", () => {
  let state = toPractice(SAMPLE_TO_BE);
  state = send(SAMPLE_TO_BE, state, { type: "end" });
  assert.equal(state.phase, "done");
  assert.equal(lessonStars(state), 0);
  const after = reduce(SAMPLE_TO_BE, state, { type: "ready" }, state.revision);
  assert.equal(after.ok ? "" : after.reason, "finished");
});

test("the public step never carries the answer of an open item", () => {
  const state = toPractice(SAMPLE_TO_BE);
  const step = stepOf(SAMPLE_TO_BE, state);
  const json = JSON.stringify(step);
  assert.ok(!json.includes('"answer":"am"'));
  assert.ok(!json.includes('explain_ar":"مع I'));
  assert.equal(step.item_number, 1);
  assert.equal(step.item_count, 5);
});

test("the same seed shows the same order after a reload", () => {
  const item = findItem(SAMPLE_PROPERTY, "s_apartment")!.item;
  assert.deepEqual(publicItem(item, "abc").tiles, publicItem(item, "abc").tiles);
  const tiles = publicItem(item, "abc").tiles.map((tile) => tile.text);
  assert.notDeepEqual(tiles, ["a", "part", "ment"], "tiles are shown out of order");
});

test("a words lesson with spelling runs on the same engine", () => {
  let state = initialState(SAMPLE_PROPERTY, SEED);
  state = send(SAMPLE_PROPERTY, state, { type: "ready" });
  for (let section = 0; section < SAMPLE_PROPERTY.sections.length; section += 1) {
    state = send(SAMPLE_PROPERTY, state, { type: "no_question" });
    while (state.phase === "practice") state = answer(SAMPLE_PROPERTY, state, true);
    assert.equal(state.tallies[section].outcome, "passed");
    state = send(SAMPLE_PROPERTY, state, { type: "ready" });
  }
  state = send(SAMPLE_PROPERTY, state, { type: "ready" });
  assert.equal(lessonStars(state), 3);
});
