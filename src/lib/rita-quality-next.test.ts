import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FILTERS,
  STAGES,
  issueStage,
  matchesFilter,
  nextStep,
  reviewCounts,
  reviewMark,
} from "./rita-quality-next.ts";
import type { Issue, IssueRow, IssueStatus } from "./rita-quality.ts";

const row = (id: string, status: IssueStatus, impact: number, title = `issue ${id}`): IssueRow => ({
  issue: { id, title } as Issue,
  derived: { status, checked: 0, needed: 30, newProblems: 0 },
  reviews: [],
  impact,
  firstSeen: null,
  lastSeen: null,
});
const base = { enabled: true, reviewed: 20, rows: [] as IssueRow[], checkedCurrent: true };

test("with the switch off and nothing reviewed it says to turn it on", () => {
  assert.equal(nextStep({ ...base, enabled: false, reviewed: 0 }).kind, "off");
});

test("nothing reviewed yet tells the admin what to do, in order", () => {
  const step = nextStep({ ...base, reviewed: 0 });
  assert.equal(step.kind, "collect");
  assert.match(step.body, /Talk to Rita/);
});

test("a problem that came back or a failing test comes before open problems", () => {
  const step = nextStep({
    ...base,
    rows: [row("a", "open", 9), row("b", "regressed", 1), row("c", "failing", 5)],
  });
  assert.equal(step.kind, "issue");
  assert.equal(step.kind === "issue" && step.issueId, "c");
  assert.match(step.title, /fix does not hold|came back/);
});

test("otherwise the open problem with the biggest impact, counted in words", () => {
  const step = nextStep({
    ...base,
    rows: [row("a", "open", 2), row("b", "open", 7), row("z", "not_an_issue", 99)],
  });
  assert.equal(step.kind === "issue" && step.issueId, "b");
  assert.equal(step.title, "2 problems need work");
  assert.equal(nextStep({ ...base, rows: [row("a", "open", 2)] }).title, "1 problem needs work");
});

test("with nothing open it asks for the reviewer check, then reports fixes being watched, then idles", () => {
  assert.equal(
    nextStep({ ...base, checkedCurrent: false, rows: [row("a", "watching", 1)] }).kind,
    "trust",
  );
  const watching = nextStep({ ...base, rows: [row("a", "watching", 1), row("b", "fixing", 3)] });
  assert.equal(watching.kind === "issue" && watching.issueId, "b");
  assert.equal(watching.title, "2 fixes are being checked");
  assert.equal(nextStep({ ...base, rows: [row("a", "resolved", 1)] }).kind, "idle");
});

test("the stage of an issue on the way to solved", () => {
  assert.deepEqual(STAGES, ["Found", "Fixing", "Watching", "Solved"]);
  assert.deepEqual(issueStage("open"), { index: 0, alert: null });
  assert.deepEqual(issueStage("regressed"), { index: 0, alert: "regressed" });
  assert.deepEqual(issueStage("fixing"), { index: 1, alert: null });
  assert.deepEqual(issueStage("failing"), { index: 1, alert: "failing" });
  assert.deepEqual(issueStage("watching"), { index: 2, alert: null });
  assert.deepEqual(issueStage("resolved"), { index: 3, alert: null });
  assert.deepEqual(issueStage("not_an_issue"), { index: null, alert: null });
  assert.deepEqual(issueStage("merged"), { index: null, alert: null });
});

test("the admin's mark on a conversation card", () => {
  const counts = reviewCounts([
    { conversation_id: "c1", verdict: "problem" },
    { conversation_id: "c1", verdict: "ok" },
    { conversation_id: "c1", verdict: "problem" },
    { conversation_id: "c2", verdict: "ok" },
  ]);
  assert.equal(reviewMark(counts.get("c1")), "3 replies reviewed · 2 problems");
  assert.equal(reviewMark(counts.get("c2")), "1 reply reviewed · no problems");
  assert.equal(reviewMark(counts.get("c3")), "Not reviewed yet");
  assert.equal(reviewMark({ reviewed: 4, problems: 1 }), "4 replies reviewed · 1 problem");
});

test("the four filters sort every status into one place", () => {
  assert.deepEqual(
    FILTERS.map((f) => f.id),
    ["open", "fixing", "solved", "all"],
  );
  const statuses: IssueStatus[] = [
    "open",
    "regressed",
    "failing",
    "fixing",
    "watching",
    "resolved",
    "not_an_issue",
    "merged",
  ];
  const where = (status: IssueStatus) =>
    FILTERS.slice(0, 3)
      .filter((f) => matchesFilter(row("x", status, 1), f.id))
      .map((f) => f.id);
  assert.deepEqual(where("open"), ["open"]);
  assert.deepEqual(where("regressed"), ["open"]);
  assert.deepEqual(where("failing"), ["open"]);
  assert.deepEqual(where("fixing"), ["fixing"]);
  assert.deepEqual(where("watching"), ["fixing"]);
  assert.deepEqual(where("resolved"), ["solved"]);
  assert.deepEqual(where("not_an_issue"), ["solved"]);
  assert.deepEqual(where("merged"), []);
  assert.deepEqual(
    statuses.filter((status) => matchesFilter(row("x", status, 1), "all")).length,
    7,
  );
});
