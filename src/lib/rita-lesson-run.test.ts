import assert from "node:assert/strict";
import test from "node:test";
import { initialState, reduce, stepOf, type RunState } from "./rita-lesson-engine.ts";
import { applyAnswer, ClientEventSchema, progressPatch, runStatusOf } from "./rita-lesson-run.ts";
import { SAMPLE_TO_BE } from "./rita-lesson-samples.ts";

function atPractice(): RunState {
  let state = initialState(SAMPLE_TO_BE, "seed");
  for (const type of ["ready", "no_question"] as const) {
    const next = reduce(SAMPLE_TO_BE, state, { type }, state.revision);
    assert.ok(next.ok);
    state = next.state;
  }
  const guided = stepOf(SAMPLE_TO_BE, state).item!;
  const done = applyAnswer(SAMPLE_TO_BE, state, {
    item_id: guided.id,
    revision: state.revision,
    response: { kind: "choice", value: "is" },
    channel: "tap",
  });
  assert.ok(done.ok);
  return done.state;
}

test("the page cannot send a graded event; answers go through applyAnswer", () => {
  assert.equal(ClientEventSchema.safeParse({ type: "graded", item_id: "p_i" }).success, false);
  assert.equal(ClientEventSchema.safeParse({ type: "hint", item_id: "p_i" }).success, true);
});

test("an answer row records the step, the channel and whether it was independent", () => {
  const state = atPractice();
  const outcome = applyAnswer(SAMPLE_TO_BE, state, {
    item_id: "p_i",
    revision: state.revision,
    response: { kind: "spoken", text: "am" },
    channel: "voice",
  });
  assert.ok(outcome.ok);
  assert.equal(outcome.row.status, "correct");
  assert.equal(outcome.row.channel, "voice");
  assert.equal(outcome.row.independent, true);
  assert.equal(outcome.row.revision, state.revision);
  assert.equal(outcome.row.skill_tag, "be.i");
});

test("misheard speech is saved as unclear and flagged, never as wrong", () => {
  const state = atPractice();
  const outcome = applyAnswer(SAMPLE_TO_BE, state, {
    item_id: "p_i",
    revision: state.revision,
    response: { kind: "spoken", text: "I'm not sure" },
    channel: "voice",
  });
  assert.ok(outcome.ok);
  assert.equal(outcome.row.status, "unclear");
  assert.equal(outcome.row.stt_suspect, true);
});

test("the second wrong try is saved as revealed", () => {
  let state = atPractice();
  for (const expected of ["wrong", "revealed"]) {
    const outcome = applyAnswer(SAMPLE_TO_BE, state, {
      item_id: "p_i",
      revision: state.revision,
      response: { kind: "choice", value: "is" },
      channel: "tap",
    });
    assert.ok(outcome.ok);
    assert.equal(outcome.row.status, expected);
    state = outcome.state;
  }
});

test("an unknown item or an old revision is refused", () => {
  const state = atPractice();
  const unknown = applyAnswer(SAMPLE_TO_BE, state, {
    item_id: "nope",
    revision: state.revision,
    response: { kind: "choice", value: "am" },
    channel: "tap",
  });
  assert.equal(unknown.ok ? "" : unknown.reason, "wrong_item");
  const old = applyAnswer(SAMPLE_TO_BE, state, {
    item_id: "p_i",
    revision: state.revision - 1,
    response: { kind: "choice", value: "am" },
    channel: "tap",
  });
  assert.equal(old.ok ? "" : old.reason, "stale");
});

test("only a finished run writes progress, and it keeps the best score and stars", () => {
  const open = atPractice();
  assert.equal(runStatusOf(open), "active");
  assert.equal(progressPatch(open, null, "now"), null);
  const ended = reduce(SAMPLE_TO_BE, open, { type: "end" }, open.revision);
  assert.ok(ended.ok);
  assert.equal(runStatusOf(ended.state), "abandoned");
  assert.equal(progressPatch(ended.state, null, "now"), null);
  const finished: RunState = {
    ...open,
    phase: "done",
    tallies: open.tallies.map(() => ({
      asked: 5,
      first_try: 4,
      remediation_rounds: 0,
      outcome: "passed" as const,
    })),
  };
  assert.equal(runStatusOf(finished), "completed");
  const patch = progressPatch(finished, { best_score: 95, stars: 3 }, "now")!;
  assert.equal(patch.score, 80);
  assert.equal(patch.best_score, 95);
  assert.equal(patch.stars, 3);
  assert.equal(patch.status, "completed");
});
