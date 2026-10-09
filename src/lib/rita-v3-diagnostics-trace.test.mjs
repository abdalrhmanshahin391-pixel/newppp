import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRitaDiagnosticTraceId,
  readModalTimingEvidence,
} from "./rita-v3-diagnostics-trace.ts";

test("keeps only valid UUID trace IDs", () => {
  const valid = "1e33de9c-07a0-4a4e-a48a-1cfe4f21b9b3";
  assert.equal(normalizeRitaDiagnosticTraceId(valid, () => "generated"), valid);
  assert.equal(normalizeRitaDiagnosticTraceId("not-a-trace", () => "generated"), "generated");
});

test("retains only bounded Modal timing evidence", () => {
  assert.deepEqual(
    readModalTimingEvidence({ dailyRoomMs: 15.125, workerSpawnRequestMs: 4, token: "never-copy" }),
    { dailyRoomMs: 15.13, workerSpawnRequestMs: 4 },
  );
  assert.equal(readModalTimingEvidence({ dailyRoomMs: -1, modalTotalMs: 100_000 }), undefined);
});
