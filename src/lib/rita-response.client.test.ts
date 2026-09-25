import assert from "node:assert/strict";
import test from "node:test";
import { parseServerTiming, readRitaPayload, ritaApiError } from "./rita-response.ts";

test("reads a plain-text API failure exactly once", async () => {
  let reads = 0;
  const response = {
    text: async () => {
      reads += 1;
      return "Rita could not hear that clearly.";
    },
  } as unknown as Response;
  const payload = await readRitaPayload(response);
  assert.deepEqual(payload, { error: "Rita could not hear that clearly." });
  assert.equal(reads, 1);
});

test("hides raw body state errors behind a useful fallback", () => {
  const error = ritaApiError({ error: "Body is disturbed or locked" }, "Please try again.");
  assert.equal(error.message, "Please try again.");
});

test("a locked response body does not leak its runtime error", async () => {
  const response = {
    text: async () => {
      throw new TypeError("Body is disturbed or locked");
    },
  } as unknown as Response;
  assert.equal(await readRitaPayload(response), null);
});

test("parses server timing diagnostics", () => {
  assert.deepEqual(parseServerTiming("stt;dur=812.4, answer;dur=420, total;dur=1450.5"), {
    stt: 812.4,
    answer: 420,
    total: 1450.5,
  });
});
