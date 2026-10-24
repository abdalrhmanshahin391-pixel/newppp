import assert from "node:assert/strict";
import test from "node:test";
import { MetricQueue, type NewMetric } from "./metric-queue.ts";

const metric = (name: string, sessionId = "s1"): NewMetric => ({ sessionId, name, metadata: {} });

test("events leave in batches of at most the batch size, oldest first", () => {
  const queue = new MetricQueue(100, 3);
  for (let i = 0; i < 7; i += 1) queue.push(metric(`e${i}`), `id${i}`);
  assert.equal(queue.full, true);
  assert.deepEqual(
    queue.takeBatch().map((e) => e.name),
    ["e0", "e1", "e2"],
  );
  assert.deepEqual(
    queue.takeBatch().map((e) => e.name),
    ["e3", "e4", "e5"],
  );
  assert.deepEqual(
    queue.takeBatch().map((e) => e.name),
    ["e6"],
  );
  assert.deepEqual(queue.takeBatch(), []);
  assert.equal(queue.full, false);
});

test("a batch holds one session only, the rest wait their turn", () => {
  const queue = new MetricQueue();
  queue.push(metric("a1", "A"), "1");
  queue.push(metric("b1", "B"), "2");
  queue.push(metric("a2", "A"), "3");
  assert.deepEqual(
    queue.takeBatch().map((e) => e.name),
    ["a1", "a2"],
  );
  assert.deepEqual(
    queue.takeBatch().map((e) => e.name),
    ["b1"],
  );
});

test("when the queue is full the oldest events are dropped and counted, never silently", () => {
  const queue = new MetricQueue(3, 25);
  for (let i = 0; i < 5; i += 1) queue.push(metric(`e${i}`), `id${i}`);
  assert.equal(queue.size, 3);
  assert.equal(queue.dropped, 2);
  assert.deepEqual(
    queue.takeBatch().map((e) => e.name),
    ["e2", "e3", "e4"],
  );
  assert.equal(queue.takeDroppedCount(), 2);
  assert.equal(queue.takeDroppedCount(), 0);
});

test("a batch that failed goes back to the front and keeps its order", () => {
  const queue = new MetricQueue(100, 2, 3);
  for (const name of ["a", "b", "c"]) queue.push(metric(name), name);
  const batch = queue.takeBatch();
  queue.requeue(batch);
  assert.deepEqual(
    queue.takeBatch().map((e) => e.name),
    ["a", "b"],
  );
});

test("an event that keeps failing is dropped after the attempt limit and counted", () => {
  const queue = new MetricQueue(100, 25, 2);
  queue.push(metric("a"), "a");
  queue.requeue(queue.takeBatch());
  assert.equal(queue.size, 1);
  queue.requeue(queue.takeBatch());
  assert.equal(queue.size, 0);
  assert.equal(queue.dropped, 1);
});

test("the event id given at the start stays with the event through retries", () => {
  const queue = new MetricQueue();
  queue.push(metric("a"), "evt-1");
  const [first] = queue.takeBatch();
  queue.requeue([first]);
  assert.equal(queue.takeBatch()[0].eventId, "evt-1");
});
