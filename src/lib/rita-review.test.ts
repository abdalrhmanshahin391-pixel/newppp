import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseReview,
  pickCandidates,
  reviewPrompt,
  suspiciousReasons,
  turnKey,
} from "./rita-review.ts";

const good = {
  verdict: "problem",
  severity: 2,
  category: "interrupted",
  cause: "turn_taking",
  evidence: "She answered while I was still thinking",
  suggestion: "Wait longer after a pause",
  confidence: 0.8,
};

test("a valid answer parses, as text or as an object", () => {
  assert.equal(parseReview(JSON.stringify(good))?.category, "interrupted");
  assert.equal(parseReview(good)?.severity, 2);
});

test("answers that do not fit the schema are refused", () => {
  assert.equal(parseReview("not json"), null);
  assert.equal(parseReview({ ...good, verdict: "maybe" }), null);
  assert.equal(parseReview({ ...good, category: "rude" }), null);
  assert.equal(parseReview({ ...good, cause: "gpu" }), null);
  assert.equal(parseReview({ ...good, severity: 5 }), null);
  assert.equal(parseReview({ ...good, confidence: "high" }), null);
  assert.equal(parseReview(null), null);
});

test("text is kept (to a generous size) and confidence is kept between 0 and 1", () => {
  const review = parseReview({ ...good, evidence: "x".repeat(5000), confidence: 7 });
  assert.equal(review?.evidence.length, 2000);
  assert.equal(review?.confidence, 1);
});

test("the turn record tells which turns look suspicious", () => {
  assert.deepEqual(suspiciousReasons(null), []);
  assert.deepEqual(suspiciousReasons({ interrupted: false, answered: true, act: "other" }), []);
  assert.deepEqual(suspiciousReasons({ interrupted: true }), ["interrupted"]);
  assert.deepEqual(suspiciousReasons({ answered: false }), ["unanswered"]);
  assert.deepEqual(suspiciousReasons({ act: "complaint" }), ["act:complaint"]);
  assert.deepEqual(suspiciousReasons({ resumed: 2, first_audio_ms: 5000 }), ["resumed", "slow"]);
  assert.deepEqual(suspiciousReasons({ finish: "length" }), ["cut_by_length"]);
});

test("a turn key is the turn ref, or the reply id when there is no record", () => {
  assert.equal(turnKey("s-t-1", "m1"), "s-t-1");
  assert.equal(turnKey(undefined, "m1"), "reply-m1");
  assert.equal(turnKey(undefined, undefined), null);
});

const ledgers = [
  { turn_ref: "s-t-1", replyMessageId: "r1", interrupted: false },
  { turn_ref: "s-t-2", replyMessageId: "r2", interrupted: true },
  { turn_ref: "s-t-3", replyMessageId: "r3", act: "complaint" },
  { turn_ref: "s-t-4", interrupted: true },
];

test("reported turns come first, then suspicious ones; ordinary turns are skipped without a sample", () => {
  const picked = pickCandidates({
    ledgers,
    reports: [{ replyMessageId: "r1", category: "forgot", note: null }],
    existing: new Set(),
    sampleRate: 0,
  });
  assert.deepEqual(
    picked.map((c) => [c.turnKey, c.trigger]),
    [
      ["s-t-1", "report"],
      ["s-t-2", "flag"],
      ["s-t-3", "flag"],
    ],
  );
});

test("a turn that already has a review is not picked again; a report without a record still is", () => {
  const picked = pickCandidates({
    ledgers,
    reports: [{ replyMessageId: "old", category: "other", note: "x" }],
    existing: new Set(["s-t-2"]),
    sampleRate: 0,
  });
  assert.deepEqual(
    picked.map((c) => c.turnKey),
    ["reply-old", "s-t-3"],
  );
});

test("the sample picks ordinary turns; the admin button picks all of them", () => {
  const sampled = pickCandidates({
    ledgers: [ledgers[0]],
    reports: [],
    existing: new Set(),
    sampleRate: 0.5,
    random: () => 0.1,
  });
  assert.equal(sampled[0].trigger, "sample");
  const all = pickCandidates({ ledgers, reports: [], existing: new Set(), all: true });
  assert.equal(all.length, 3);
  assert.ok(all.every((c) => c.trigger === "manual"));
});

test("the prompt shows the last messages, marks the reply and leaves out ids", () => {
  const messages = Array.from({ length: 6 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: `m${i}`,
  }));
  const prompt = reviewPrompt({
    messages,
    replyIndex: 5,
    ledger: { turn_ref: "s-t-1", replyMessageId: "r1", wait_ms: 900 },
    report: { category: "interrupted", note: "she cut me" },
  });
  assert.match(prompt, /Rita \(the reply under review\): m5/);
  assert.match(prompt, /Learner: m0/);
  assert.match(prompt, /"wait_ms":900/);
  assert.doesNotMatch(prompt, /replyMessageId|s-t-1/);
  assert.match(prompt, /note: she cut me/);
});

test("long messages are sent whole", () => {
  const prompt = reviewPrompt({
    messages: [{ role: "assistant", content: "y".repeat(5000) }],
    replyIndex: 0,
  });
  assert.ok(prompt.includes("y".repeat(5000)));
});

test("reports only: nothing but the reported turns", () => {
  const picked = pickCandidates({
    ledgers,
    reports: [{ replyMessageId: "r1", category: "forgot", note: null }],
    existing: new Set(),
    reportsOnly: true,
    all: true,
  });
  assert.deepEqual(
    picked.map((c) => c.turnKey),
    ["s-t-1"],
  );
});
