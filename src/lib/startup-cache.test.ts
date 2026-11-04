import assert from "node:assert/strict";
import test from "node:test";
import { createStartupCache } from "./startup-cache.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("concurrent cold requests share one load and its successful result", async () => {
  const pending = deferred<string>();
  let calls = 0;
  const cache = createStartupCache(
    () => {
      calls++;
      return pending.promise;
    },
    "fallback",
    1000,
    100,
  );
  const first = cache.get();
  const second = cache.get();
  pending.resolve("configured");
  assert.deepEqual(await Promise.all([first, second]), ["configured", "configured"]);
  assert.equal(await cache.get(), "configured");
  assert.equal(calls, 1);
});

test("a timeout does not poison the cache or restart the pending load", async () => {
  const pending = deferred<string>();
  let calls = 0;
  const cache = createStartupCache(
    () => {
      calls++;
      return pending.promise;
    },
    "fallback",
    1000,
    5,
  );
  assert.equal(await cache.get(), "fallback");
  const next = cache.get();
  pending.resolve("real settings");
  assert.equal(await next, "real settings");
  assert.equal(await cache.get(), "real settings");
  assert.equal(calls, 1);
});

test("stale settings render immediately while one refresh runs", async () => {
  const pending = deferred<string>();
  let calls = 0;
  const cache = createStartupCache(
    () => (++calls === 1 ? Promise.resolve("old") : pending.promise),
    "fallback",
    0,
    100,
  );
  assert.equal(await cache.get(), "old");
  assert.equal(await cache.get(), "old");
  assert.equal(await cache.get(), "old");
  assert.equal(calls, 2);
  pending.resolve("new");
  await pending.promise;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await cache.get(), "new");
});

test("a failed request is retried rather than cached as a successful fallback", async () => {
  let calls = 0;
  const cache = createStartupCache(
    async () => {
      if (++calls === 1) throw Error("offline");
      return "recovered";
    },
    "fallback",
    1000,
    100,
  );
  assert.equal(await cache.get(), "fallback");
  assert.equal(await cache.get(), "recovered");
});

test("a late pre-invalidation response cannot overwrite newly saved settings", async () => {
  const old = deferred<string>();
  let calls = 0;
  const cache = createStartupCache(
    () => (++calls === 1 ? old.promise : Promise.resolve("new")),
    "fallback",
    1000,
    100,
  );
  const first = cache.get();
  await Promise.resolve();
  cache.invalidate();
  assert.equal(await cache.get(), "new");
  old.resolve("old");
  await first;
  assert.equal(await cache.get(), "new");
});
