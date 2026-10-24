import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RECHECK_SCHEMA,
  caseOutcome,
  conversationWithReply,
  latestRuns,
  parseRecheck,
  recheckPrompt,
  replayCase,
  runHeadline,
  sampleResult,
  summarizeRun,
  type ReplayRun,
} from "./rita-replay.ts";
import {
  deriveIssueStatus,
  buildIssueRows,
  type Issue,
  type QualityReview,
} from "./rita-quality.ts";

const messages = [
  { id: "m0", role: "user", content: "مرحبا" },
  { id: "m1", role: "assistant", content: "أهلين" },
  { id: "m2", role: "user", content: "عن إيش بتقدري تشرحي؟" },
  { id: "m3", role: "assistant", content: "شو حابب نتعلم؟" },
];
const conversation = {
  language_preference: "automatic",
  dialect_preference: "ar-JO",
  learning_language: "de",
};

test("the turn is the learner's last message; everything before it is history", () => {
  const request = replayCase({ reviewId: "r1", replyMessageId: "m3", messages, conversation });
  assert.equal(request?.text, "عن إيش بتقدري تشرحي؟");
  assert.deepEqual(
    request?.history.map((m) => m.content),
    ["مرحبا", "أهلين"],
  );
  assert.equal(request?.language, "automatic");
  assert.deepEqual(request?.target, { code: "de", name: "German", speechCode: "de" });
  assert.equal(request?.siteLanguage, undefined);
});

test("a reply that does not answer a learner message cannot be replayed", () => {
  assert.equal(
    replayCase({ reviewId: "r", replyMessageId: "m1", messages: messages.slice(1), conversation }),
    null,
  );
  assert.equal(replayCase({ reviewId: "r", replyMessageId: "nope", messages, conversation }), null);
  assert.equal(replayCase({ reviewId: "r", replyMessageId: "m2", messages, conversation }), null);
});

test("a site-driven language and the old prompt hash come from the turn record", () => {
  const request = replayCase({
    reviewId: "r1",
    replyMessageId: "m3",
    messages,
    conversation: { ...conversation, language_preference: "klingon", learning_language: null },
    ledger: { lang_src: "site", lang: "en", prompt: "abc12345" },
  });
  assert.equal(request?.siteLanguage, "en");
  assert.equal(request?.promptHash, "abc12345");
  assert.equal(request?.language, "automatic");
  assert.equal(request?.target, undefined);
  const explicit = replayCase({
    reviewId: "r1",
    replyMessageId: "m3",
    messages,
    conversation,
    ledger: { lang_src: "explicit", lang: "en" },
  });
  assert.equal(explicit?.siteLanguage, undefined);
});

test("the judges see the history, the learner's turn and the new reply last", () => {
  const request = replayCase({ reviewId: "r1", replyMessageId: "m3", messages, conversation });
  if (!request) throw new Error("no case");
  const list = conversationWithReply(request, "عن شو بدنا نحكي؟");
  assert.deepEqual(
    list.map((m) => m.role),
    ["user", "assistant", "user", "assistant"],
  );
  assert.equal(list.at(-1)?.content, "عن شو بدنا نحكي؟");
});

const clean = {
  facts: [],
  dialect: [],
  stillHasProblem: false,
  stillWhy: "",
  winner: "tie" as const,
  watch: [],
};

test("a reply passes only when no check finds anything", () => {
  assert.deepEqual(sampleResult(clean), { ok: true, reasons: [] });
  assert.equal(sampleResult({ ...clean, winner: "rita" }).ok, true);
  assert.match(
    sampleResult({ ...clean, stillHasProblem: true, stillWhy: "guesses gender" }).reasons[0],
    /Still has the problem: guesses gender/,
  );
  assert.equal(
    sampleResult({ ...clean, facts: [{ claim: "c", verdict: "incorrect", correction: "" }] }).ok,
    false,
  );
  assert.equal(
    sampleResult({ ...clean, facts: [{ claim: "c", verdict: "imprecise", correction: "" }] }).ok,
    true,
  );
  assert.equal(
    sampleResult({ ...clean, dialect: [{ phrase: "حابب", kind: "gender_assumption", better: "" }] })
      .ok,
    false,
  );
  assert.equal(
    sampleResult({ ...clean, dialect: [{ phrase: "x", kind: "register_mix", better: "" }] }).ok,
    true,
  );
  assert.equal(sampleResult({ ...clean, winner: "reference" }).ok, false);
  assert.equal(sampleResult({ ...clean, watch: ["هكذا -> هيك"] }).ok, false);
});

test("one good sample is luck: every sample must pass", () => {
  assert.equal(caseOutcome([{ ok: true }, { ok: true }]), "passed");
  assert.equal(caseOutcome([{ ok: true }, { ok: false }]), "flaky");
  assert.equal(caseOutcome([{ ok: false }, { ok: false }]), "failed");
  assert.equal(caseOutcome([{ ok: null }, { ok: null }]), "error");
  assert.equal(caseOutcome([{ ok: true }, { ok: null }]), "passed");
  assert.equal(caseOutcome([]), "error");
});

test("the run summary counts unstable and failed turns, and says it in words", () => {
  const summary = summarizeRun([
    { outcome: "passed" },
    { outcome: "flaky" },
    { outcome: "failed" },
    { outcome: "error" },
  ]);
  assert.deepEqual(summary, { total: 4, passed: 1, flaky: 1, failed: 2 });
  assert.equal(
    runHeadline({ ...summary, status: "partial" }),
    "1 of 4 turns now answered well · 1 unstable · 2 still wrong · not all finished",
  );
  assert.equal(
    runHeadline({ total: 3, passed: 3, flaky: 0, failed: 0, status: "done" }),
    "3 of 3 turns now answered well",
  );
});

const run = (over: Partial<ReplayRun>): ReplayRun => ({
  id: "x",
  issue_id: "i1",
  trigger: "manual",
  worker_build: "b2",
  prompt_changed: null,
  status: "done",
  total: 3,
  passed: 3,
  flaky: 0,
  failed: 0,
  cases: [],
  error: null,
  started_at: "2026-10-24T10:00:00Z",
  finished_at: null,
  ...over,
});

test("the newest finished run of each issue", () => {
  const map = latestRuns([
    run({ id: "a", started_at: "2026-10-23T10:00:00Z" }),
    run({ id: "b" }),
    run({ id: "c", status: "running", started_at: "2026-10-25T10:00:00Z" }),
    run({ id: "d", issue_id: "i2", status: "failed" }),
  ]);
  assert.equal(map.get("i1")?.id, "b");
  assert.equal(map.has("i2"), false);
});

test("the recheck question: schema is strict and answers are parsed safely", () => {
  assert.deepEqual(RECHECK_SCHEMA.required, ["still_has_problem", "why"]);
  assert.deepEqual(parseRecheck('{"still_has_problem":true,"why":"x"}'), {
    stillHasProblem: true,
    why: "x",
  });
  assert.equal(parseRecheck({ still_has_problem: "yes", why: "" }), null);
  assert.equal(parseRecheck("nope"), null);
  const prompt = recheckPrompt({
    title: "T",
    description: "D",
    messages: [{ role: "user", content: "hi" }],
    reply: "new",
  });
  assert.ok(prompt.includes("<problem_pattern>\nT\nD") && prompt.includes("<new_reply>\nnew"));
});

// ----------------------------------------------------------------- status with a replay

const issue = (over: Partial<Issue> = {}): Issue => ({
  id: "i1",
  title: "t",
  description: "",
  fix_where: "prompt",
  category: null,
  cause: null,
  status: "fixing",
  merged_into: null,
  suggested_merge_into: null,
  pr_url: null,
  fix_marked_at: "2026-10-22T00:00:00Z",
  fix_baseline_build: "b1",
  note: null,
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
  ...over,
});
const review = (over: Partial<QualityReview> = {}): QualityReview => ({
  id: "r",
  build: "b2",
  status: "done",
  verdict: "ok",
  severity: 0,
  category: "ok",
  cause: "unknown",
  winner: "tie",
  issue_id: null,
  reviewed_at: "2026-10-23T00:00:00Z",
  scores: null,
  timing: null,
  ...over,
});

test("a replay after the fix that still fails means the test still fails", () => {
  const failing = run({ failed: 1, passed: 2 });
  assert.equal(deriveIssueStatus(issue(), [], [], failing).status, "failing");
  assert.equal(deriveIssueStatus(issue(), [], [], run({ flaky: 1, passed: 2 })).status, "failing");
  assert.equal(deriveIssueStatus(issue(), [], [], run({})).status, "fixing");
  // before the fix, on the old build, or with nothing replayed: ignored
  assert.equal(
    deriveIssueStatus(issue(), [], [], run({ failed: 1, started_at: "2026-10-21T00:00:00Z" }))
      .status,
    "fixing",
  );
  assert.equal(
    deriveIssueStatus(issue(), [], [], run({ failed: 1, worker_build: "b1" })).status,
    "fixing",
  );
  assert.equal(deriveIssueStatus(issue(), [], [], run({ failed: 0, total: 0 })).status, "fixing");
});

test("a real new problem still wins over a failing replay, and a passing replay changes nothing", () => {
  const problem = review({ verdict: "problem", issue_id: "i1" });
  assert.equal(
    deriveIssueStatus(issue(), [problem], [problem], run({ failed: 2 })).status,
    "regressed",
  );
  assert.equal(deriveIssueStatus(issue(), [review()], [], run({})).status, "watching");
});

test("failing issues are listed right after the ones that came back", () => {
  const rows = buildIssueRows(
    [
      issue({ id: "a", status: "open", fix_marked_at: null, fix_baseline_build: null }),
      issue({ id: "b" }),
    ],
    [],
    Date.now(),
    new Map([["b", run({ issue_id: "b", failed: 1, passed: 2 })]]),
  );
  assert.deepEqual(
    rows.map((row) => [row.issue.id, row.derived.status]),
    [
      ["b", "failing"],
      ["a", "open"],
    ],
  );
});
