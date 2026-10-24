import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RESOLVE_AFTER,
  SMALL_SAMPLE,
  agreementRate,
  buildIssueRows,
  change,
  deriveIssueStatus,
  fixFileName,
  healthByBuild,
  issueByBuild,
  issueFixFile,
  issueImpact,
  percentile,
  type Issue,
  type QualityReview,
} from "./rita-quality.ts";

let counter = 0;
function review(over: Partial<QualityReview> = {}): QualityReview {
  counter += 1;
  return {
    id: `r${counter}`,
    build: "aaa",
    status: "done",
    verdict: "ok",
    severity: 0,
    category: "ok",
    cause: "unknown",
    winner: "tie",
    issue_id: null,
    reviewed_at: "2026-10-24T10:00:00Z",
    scores: { ritaAverage: 4, referenceAverage: 5 },
    timing: { interrupted: false, firstAudioMs: 1000 },
    ...over,
  };
}
const issue = (over: Partial<Issue> = {}): Issue => ({
  id: "i1",
  title: "فيك تتعلم",
  description: "",
  fix_where: "dialect_list",
  category: "wrong_dialect",
  cause: "language_choice",
  status: "open",
  merged_into: null,
  suggested_merge_into: null,
  pr_url: null,
  fix_marked_at: null,
  fix_baseline_build: null,
  note: null,
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
  ...over,
});

test("percentiles", () => {
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([5], 0.95), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95), 10);
});

test("health is worked out per build, oldest first, and ignores reviews that are not done", () => {
  const rows = [
    ...Array.from({ length: 4 }, () =>
      review({
        build: "old",
        reviewed_at: "2026-10-20T10:00:00Z",
        verdict: "problem",
        winner: "reference",
        scores: { ritaAverage: 2, referenceAverage: 5 },
        timing: { interrupted: true, firstAudioMs: 3000 },
      }),
    ),
    ...Array.from({ length: SMALL_SAMPLE }, () =>
      review({
        build: "new",
        reviewed_at: "2026-10-24T10:00:00Z",
        scores: { ritaAverage: 4.5, referenceAverage: 5 },
        timing: { interrupted: false, firstAudioMs: 800 },
      }),
    ),
    review({ build: "new", status: "failed" }),
  ];
  const [old, current] = healthByBuild(rows);
  assert.equal(old.build, "old");
  assert.equal(old.problemRate, 100);
  assert.equal(old.quality, 40);
  assert.equal(old.cutOffRate, 100);
  assert.equal(old.referenceWon, 4);
  assert.equal(old.smallSample, true);
  assert.equal(current.build, "new");
  assert.equal(current.reviewed, SMALL_SAMPLE);
  assert.equal(current.smallSample, false);
  assert.equal(current.quality, 90);
  assert.equal(current.firstAudioP50, 800);
  assert.equal(current.problemRate, 0);
});

test("a build with no timing or scores gives nulls, not NaN", () => {
  const [health] = healthByBuild([review({ build: null, scores: null, timing: null })]);
  assert.equal(health.build, "unknown");
  assert.equal(health.quality, null);
  assert.equal(health.cutOffRate, null);
  assert.equal(health.firstAudioP50, null);
});

test("the weakest criterion is where Rita is furthest below the reference", () => {
  const [health] = healthByBuild([
    review({
      scores: {
        ritaAverage: 3,
        referenceAverage: 5,
        criteria: {
          dialect_and_address: { rita: 2, reference: 5 },
          teaching: { rita: 4, reference: 4.5 },
        },
      },
    }),
  ]);
  assert.equal(health.weakest, "dialect_and_address");
  assert.deepEqual(health.criteria.teaching, { rita: 4, reference: 4.5 });
});

test("a change says whether it is good news", () => {
  assert.equal(change(null, 3), null);
  assert.deepEqual(change(80, 70), { delta: 10, better: true });
  assert.deepEqual(change(12, 20, true), { delta: -8, better: true });
  assert.deepEqual(change(5, 5), { delta: 0, better: null });
});

test("impact grows with count and severity and fades with age", () => {
  const now = new Date("2026-10-24T10:00:00Z").getTime();
  const fresh = [review({ severity: 2, reviewed_at: "2026-10-24T10:00:00Z" })];
  const old = [review({ severity: 2, reviewed_at: "2026-09-26T10:00:00Z" })];
  assert.equal(issueImpact(fresh, now), 2);
  assert.ok(issueImpact(old, now) < 1);
  assert.ok(issueImpact([...fresh, ...fresh], now) > issueImpact(fresh, now));
  assert.equal(issueImpact([], now), 0);
});

const fixed = (over: Partial<Issue> = {}) =>
  issue({
    status: "fixing",
    fix_marked_at: "2026-10-22T00:00:00Z",
    fix_baseline_build: "aaa",
    ...over,
  });

test("an open issue keeps its stored status", () => {
  assert.equal(deriveIssueStatus(issue(), [], []).status, "open");
  assert.equal(deriveIssueStatus(issue({ status: "not_an_issue" }), [], []).status, "not_an_issue");
});

test("after a fix: nothing new yet, then watching, then solved", () => {
  const stale = review({ build: "aaa", reviewed_at: "2026-10-23T00:00:00Z" });
  assert.equal(deriveIssueStatus(fixed(), [stale], []).status, "fixing");
  const newer = (n: number) =>
    Array.from({ length: n }, () => review({ build: "bbb", reviewed_at: "2026-10-23T00:00:00Z" }));
  const watching = deriveIssueStatus(fixed(), [stale, ...newer(5)], []);
  assert.equal(watching.status, "watching");
  assert.equal(watching.checked, 5);
  assert.equal(deriveIssueStatus(fixed(), newer(RESOLVE_AFTER), []).status, "resolved");
});

test("a problem of the same kind on a newer build means it came back", () => {
  const problem = review({
    build: "bbb",
    verdict: "problem",
    issue_id: "i1",
    reviewed_at: "2026-10-23T00:00:00Z",
  });
  const derived = deriveIssueStatus(
    fixed(),
    [
      problem,
      ...Array.from({ length: 40 }, () =>
        review({ build: "bbb", reviewed_at: "2026-10-23T00:00:00Z" }),
      ),
    ],
    [problem],
  );
  assert.equal(derived.status, "regressed");
  assert.equal(derived.newProblems, 1);
  // The same problem on the old build, or before the fix, is not a regression.
  const before = review({
    build: "aaa",
    verdict: "problem",
    issue_id: "i1",
    reviewed_at: "2026-10-23T00:00:00Z",
  });
  assert.equal(deriveIssueStatus(fixed(), [before], [before]).status, "fixing");
});

test("the Fix next list: came back, then open, then by impact", () => {
  const now = new Date("2026-10-24T10:00:00Z").getTime();
  const mk = (id: string, severity: number) =>
    review({ issue_id: id, verdict: "problem", severity, reviewed_at: "2026-10-24T10:00:00Z" });
  const rows = buildIssueRows(
    [
      issue({ id: "small" }),
      issue({ id: "big" }),
      fixed({ id: "back" }),
      issue({ id: "gone", status: "merged" }),
    ],
    [
      mk("small", 1),
      mk("big", 3),
      mk("big", 3),
      review({
        issue_id: "back",
        verdict: "problem",
        build: "bbb",
        reviewed_at: "2026-10-24T09:00:00Z",
      }),
    ],
    now,
  );
  assert.deepEqual(
    rows.map((row) => row.issue.id),
    ["back", "big", "small", "gone"],
  );
  assert.equal(rows[0].derived.status, "regressed");
  assert.equal(rows[1].reviews.length, 2);
});

test("an issue's problems per build show a fix working", () => {
  const rows = [
    review({
      build: "old",
      reviewed_at: "2026-10-20T00:00:00Z",
      verdict: "problem",
      issue_id: "i1",
    }),
    review({ build: "old", reviewed_at: "2026-10-20T00:00:00Z" }),
    review({ build: "new", reviewed_at: "2026-10-24T00:00:00Z" }),
  ];
  const own = rows.filter((row) => row.issue_id === "i1");
  assert.deepEqual(
    issueByBuild(own, rows).map((b) => [b.build, b.reviewed, b.problems]),
    [
      ["old", 2, 1],
      ["new", 1, 0],
    ],
  );
});

test("the fix file carries the examples, the numbers and the owner's disagreements", () => {
  const derived = deriveIssueStatus(issue(), [], []);
  const file = issueFixFile({
    issue: issue(),
    derived,
    byBuild: [],
    generatedAt: "2026-10-24T10:00:00Z",
    examples: [
      {
        reviewId: "a",
        conversationId: "c",
        build: "x",
        verdict: "problem",
        severity: 2,
        category: null,
        cause: null,
        explanation: "e",
        evidence: null,
        fix: null,
        ritaReply: "r",
        referenceReply: "ref",
        contextBefore: [],
        winner: "reference",
        scores: null,
        facts: null,
        dialect: null,
        timing: null,
        reviewedAt: null,
        ownerAgrees: false,
        ownerNote: null,
      },
      {
        reviewId: "b",
        conversationId: "c",
        build: "x",
        verdict: "problem",
        severity: 2,
        category: null,
        cause: null,
        explanation: null,
        evidence: null,
        fix: null,
        ritaReply: "r2",
        referenceReply: "ref2",
        contextBefore: [],
        winner: "reference",
        scores: null,
        facts: null,
        dialect: null,
        timing: null,
        reviewedAt: null,
        ownerAgrees: true,
        ownerNote: null,
      },
    ],
  });
  assert.equal(file.issue.title, "فيك تتعلم");
  assert.equal(file.numbers.examples, 2);
  assert.deepEqual(file.ownerDisagreedWith, ["a"]);
  assert.equal(file.examples[0].referenceReply, "ref");
  assert.match(fixFileName("فيك تتعلم", "12345678-aaaa"), /^rita-issue-.+-12345678\.json$/);
  assert.match(fixFileName("!!!", "12345678-aaaa"), /rita-issue-issue-12345678/);
});

test("agreement with the reviewer", () => {
  assert.equal(agreementRate([]), null);
  assert.deepEqual(
    agreementRate([{ agree: true }, { agree: true }, { agree: false }, { agree: true }]),
    { rate: 75, total: 4 },
  );
});
