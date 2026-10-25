import assert from "node:assert/strict";
import { test } from "node:test";
import { failureSummary, isFatalReason, readPages, withTimeout } from "./page-reading.ts";

const noSleep = async () => {};
const base = { timeoutMs: 50, retries: 2, sleep: noSleep };

test("every page gets a result, in order", async () => {
  const out = await readPages([2, 3], async () => ({ ok: true }), base);
  assert.deepEqual(
    out.map((o) => [o.page, o.ok, o.attempts]),
    [
      [2, true, 1],
      [3, true, 1],
    ],
  );
});

test("a page is retried and one good try is enough", async () => {
  let tries = 0;
  const out = await readPages(
    [5],
    async () => ((tries += 1) < 3 ? { ok: false, reason: "busy" } : { ok: true }),
    base,
  );
  assert.equal(out[0].ok, true);
  assert.equal(out[0].attempts, 3);
});

test("a page that never answers times out, fails with its reason and the next page still runs", async () => {
  const out = await readPages(
    [2, 3],
    (page) => (page === 2 ? new Promise(() => {}) : Promise.resolve({ ok: true })),
    { ...base, timeoutMs: 20, retries: 1 },
  );
  assert.equal(out[0].ok, false);
  assert.match(out[0].reason, /Page 2 took longer than/);
  assert.equal(out[0].attempts, 2);
  assert.equal(out[1].ok, true);
});

test("a bad key or no credit stops the run at once instead of burning every page", async () => {
  let calls = 0;
  const out = await readPages(
    [1, 2, 3],
    async () => {
      calls += 1;
      throw new Error("OpenAI 429: You exceeded your current quota (insufficient_quota)");
    },
    base,
  );
  assert.equal(calls, 1);
  assert.equal(
    out.every((o) => !o.ok),
    true,
  );
  assert.match(out[1].reason, /Not tried/);
});

test("the admin can stop; progress is reported", async () => {
  const seen: number[] = [];
  let stop = false;
  const out = await readPages(
    [1, 2, 3],
    async (page) => {
      if (page === 2) stop = true;
      return { ok: true };
    },
    { ...base, shouldStop: () => stop, onProgress: (p) => seen.push(p.page) },
  );
  assert.deepEqual(seen, [1, 2]);
  assert.equal(out[2].reason, "Stopped.");
});

test("which reasons are not worth retrying", () => {
  for (const reason of [
    "OpenAI 401: Incorrect API key",
    "OpenAI 403: no access",
    "insufficient_quota",
    "No OpenAI key found",
  ]) {
    assert.equal(isFatalReason(reason), true, reason);
  }
  for (const reason of ["OpenAI 429: rate limit", "OpenAI 500", "Page 2 took longer than 60s"]) {
    assert.equal(isFatalReason(reason), false, reason);
  }
});

test("the failure summary and the timeout helper", async () => {
  assert.equal(
    failureSummary([
      { page: 2, ok: false, reason: "x", attempts: 1 },
      { page: 3, ok: true, reason: "", attempts: 1 },
    ]),
    "p2: x",
  );
  await assert.rejects(withTimeout(new Promise(() => {}), 10, "Thing"), /Thing took longer/);
  assert.equal(await withTimeout(Promise.resolve(7), 50, "ok"), 7);
});
