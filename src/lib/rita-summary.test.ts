import assert from "node:assert/strict";
import test from "node:test";
import type { CorrectionRecord } from "./rita-correction.ts";
import { buildSummary, formatMinutes } from "./rita-summary.ts";

const record = (better: string, patch: Partial<CorrectionRecord> = {}): CorrectionRecord => ({
  id: better,
  said: "x",
  better,
  why: "",
  translation: "",
  language: "de",
  attempts: 0,
  fixed: false,
  ...patch,
});

test("minutes are readable for short and long lessons", () => {
  assert.equal(formatMinutes(42_000), "42 sec");
  assert.equal(formatMinutes(3 * 60_000), "3 min");
  assert.equal(formatMinutes(3 * 60_000 + 40_000), "4 min");
  assert.equal(formatMinutes(-5), "0 sec");
});

test("the same phrase corrected twice is reported as repeated", () => {
  const summary = buildSummary({
    startedAt: 0,
    endedAt: 600_000,
    speakMs: 120_000,
    turns: 8,
    learning: [],
    corrections: [
      record("Ich möchte einen Shawarma"),
      record("ich möchte einen shawarma!"),
      record("Guten Morgen", { attempts: 1, fixed: true }),
    ],
  });
  assert.equal(summary.repeated.length, 1);
  assert.equal(summary.repeated[0].better, "Ich möchte einen Shawarma");
  assert.deepEqual(summary.retries, { attempted: 1, fixed: 1 });
});

test("a phrase retried but never fixed counts as repeated", () => {
  const summary = buildSummary({
    startedAt: 0,
    endedAt: 1,
    speakMs: 0,
    turns: 1,
    learning: [],
    corrections: [record("Wie geht es dir", { attempts: 2, fixed: false })],
  });
  assert.equal(summary.repeated.length, 1);
});

test("the next goal asks for the first unfixed correction, then new words, then a fresh lesson", () => {
  const base = { startedAt: 0, endedAt: 1, speakMs: 0, turns: 1 };
  const word = {
    term: "Döner",
    meaning: "دونر",
    language: "de",
    kind: "word",
    article: "der",
    plural: null,
  } as const;
  assert.match(
    buildSummary({
      ...base,
      learning: [],
      corrections: [record("Guten Morgen", { fixed: true }), record("Danke schön")],
    }).nextGoal,
    /Danke schön/,
  );
  assert.match(
    buildSummary({ ...base, learning: [word], corrections: [] }).nextGoal,
    /Review 1 new item/,
  );
  assert.match(buildSummary({ ...base, learning: [], corrections: [] }).nextGoal, /guided lesson/);
});

test("negative speaking time or a clock skew never produces negative values", () => {
  const summary = buildSummary({
    startedAt: 10,
    endedAt: 5,
    speakMs: -3,
    turns: 0,
    learning: [],
    corrections: [],
  });
  assert.equal(summary.durationMs, 0);
  assert.equal(summary.speakMs, 0);
});
