import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSiteBootstrap, invalidateSiteBootstrapCache } from "./site-bootstrap.server";

test("cold public startup and invalidation perform zero network requests", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls++;
    throw new Error("Public startup must not contact the backend");
  }) as typeof fetch;
  try {
    const first = await loadSiteBootstrap();
    invalidateSiteBootstrapCache();
    const second = await loadSiteBootstrap();
    assert.deepEqual(second, first);
    assert.equal(first.settings?.["id"], true);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
