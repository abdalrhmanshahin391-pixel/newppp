import assert from "node:assert/strict";
import test from "node:test";
import { decideStep, progressText } from "./rita-review-steps.ts";

test("the page asks again while replies are left or the closing work is pending", () => {
  assert.deepEqual(decideStep({ ok: true, waiting: 3, reviewed: 2 }), { next: "again" });
  assert.deepEqual(decideStep({ ok: true, waiting: 0, finalPending: true }), { next: "again" });
  assert.deepEqual(decideStep({ ok: true, waiting: 0, reviewed: 0, failed: 1 }), { next: "again" });
});

test("it stops when nothing is left, the switch is off, or the service stopped", () => {
  assert.deepEqual(decideStep({ ok: true, waiting: 0, reviewed: 0, conversationReviewed: true }), {
    next: "done",
  });
  assert.deepEqual(decideStep({ ok: true, enabled: false }), { next: "off" });
  assert.deepEqual(decideStep({ ok: true, stopped: "OpenAI 429: rate limit" }), {
    next: "stopped",
    reason: "OpenAI 429: rate limit",
  });
  assert.equal(decideStep(null).next, "stopped");
  assert.equal(decideStep({ ok: false, error: "Forbidden" }).next, "stopped");
});

test("the card says how far the review got", () => {
  assert.equal(
    progressText({ state: "running", turns: 5, finished: 2 }),
    "AI review: 2 of 5 replies checked…",
  );
  assert.equal(progressText({ state: "running", turns: 0, finished: 0 }), "AI review: starting…");
  assert.match(progressText({ state: "done", turns: 5, finished: 5 }), /finished: 5 of 5/);
  assert.match(
    progressText({ state: "stopped", turns: 5, finished: 3, message: "OpenAI took too long" }),
    /stopped at 3 of 5 replies: OpenAI took too long/,
  );
});
