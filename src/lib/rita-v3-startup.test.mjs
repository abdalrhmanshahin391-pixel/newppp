import assert from "node:assert/strict";
import test from "node:test";

import { fetchPipecatStartWithDeadline } from "./rita-v3-startup.ts";

for (const simulatedWorkerSeconds of [60, 120]) {
  test(`worker still starting after ${simulatedWorkerSeconds}s is aborted, not marked ready`, async () => {
    const scale = 1000;
    let aborted = false;
    const delayedFetch = (_url, init) =>
      new Promise((resolve, reject) => {
        const worker = setTimeout(
          () => resolve(new Response(JSON.stringify({ dailyRoom: "late" }))),
          (simulatedWorkerSeconds * 1000) / scale,
        );
        init.signal.addEventListener("abort", () => {
          aborted = true;
          clearTimeout(worker);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    await assert.rejects(
      fetchPipecatStartWithDeadline(delayedFetch, "https://example.invalid", {}, 45_000 / scale),
      { name: "AbortError" },
    );
    assert.equal(aborted, true);
  });
}
