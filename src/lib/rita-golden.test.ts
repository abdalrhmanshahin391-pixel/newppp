import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GOLDEN_CASES,
  checkGolden,
  checkHeadline,
  summarizeGolden,
  type GoldenCase,
} from "./rita-golden.ts";

const byId = (id: string) => GOLDEN_CASES.find((item) => item.id === id) as GoldenCase;

test("the set covers wrong facts, dialect, gender, language, timing, injection and good replies", () => {
  assert.ok(GOLDEN_CASES.length >= 15);
  assert.equal(new Set(GOLDEN_CASES.map((item) => item.id)).size, GOLDEN_CASES.length);
  const problems = GOLDEN_CASES.filter((item) => item.expect.verdict === "problem");
  const good = GOLDEN_CASES.filter((item) => item.expect.verdict === "ok");
  assert.ok(
    problems.length >= 8 && good.length >= 5,
    "a reviewer that flags everything or nothing must fail",
  );
  for (const item of GOLDEN_CASES) {
    assert.equal(
      item.messages.at(-1)?.role,
      "assistant",
      `${item.id}: the last message is the reply under review`,
    );
    assert.ok(item.why.length > 10);
  }
});

test("the real mistakes from the first conversation are in the set", () => {
  const text = JSON.stringify(GOLDEN_CASES);
  for (const phrase of ["صباحية", "شو حابب", "فيك تتعلم", "عن إيش بتقدري"])
    assert.ok(text.includes(phrase), phrase);
});

test("a missed problem and a false alarm both fail", () => {
  const wrong = byId("wrong-fact-guten-tag");
  assert.match(
    checkGolden(wrong, { verdict: "ok", category: "ok", facts: [], dialect: [] })[0],
    /Missed a real problem/,
  );
  const good = byId("good-greeting");
  assert.match(
    checkGolden(good, { verdict: "problem", category: "other", facts: [], dialect: [] })[0],
    /Called a good reply a problem/,
  );
  assert.deepEqual(
    checkGolden(good, { verdict: "ok", category: "ok", facts: [], dialect: [] }),
    [],
  );
});

test("finding the problem is not enough: the fact or the wording must be named", () => {
  const wrong = byId("wrong-fact-guten-tag");
  assert.deepEqual(
    checkGolden(wrong, {
      verdict: "problem",
      category: "wrong_answer",
      facts: [{ claim: "c", verdict: "incorrect", correction: "x" }],
      dialect: [],
    }),
    [],
  );
  assert.match(
    checkGolden(wrong, {
      verdict: "problem",
      category: "wrong_answer",
      facts: [{ claim: "c", verdict: "correct", correction: "" }],
      dialect: [],
    })[0],
    /wrong fact/,
  );
  const gender = byId("gender-guess");
  assert.match(
    checkGolden(gender, {
      verdict: "problem",
      category: "wrong_dialect",
      facts: [],
      dialect: [],
    })[0],
    /wording problem/,
  );
  assert.deepEqual(
    checkGolden(gender, {
      verdict: "problem",
      category: "wrong_dialect",
      facts: [],
      dialect: [{ phrase: "حابب", kind: "gender_assumption", better: "" }],
    }),
    [],
  );
  assert.match(
    checkGolden(gender, {
      verdict: "problem",
      category: "lost",
      facts: [],
      dialect: [{ phrase: "حابب", kind: "gender_assumption", better: "" }],
    })[0],
    /called it "lost"/,
  );
});

test("the summary and the headline", () => {
  const summary = summarizeGolden([
    { id: "a", why: "", pass: true, problems: [], got: null },
    { id: "b", why: "", pass: false, problems: ["x"], got: null },
    { id: "c", why: "", pass: null, problems: [], got: null },
  ]);
  assert.deepEqual(summary, { total: 3, passed: 1, failed: 1, notRun: 1 });
  assert.equal(
    checkHeadline({ total: 15, passed: 14, failed: 1, status: "done" }),
    "14 of 15 checks passed",
  );
  assert.equal(
    checkHeadline({ total: 15, passed: 10, failed: 1, status: "partial" }),
    "10 of 15 checks passed · 4 not run",
  );
});
