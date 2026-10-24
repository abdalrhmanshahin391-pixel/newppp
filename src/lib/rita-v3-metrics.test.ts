import assert from "node:assert/strict";
import test from "node:test";
import { ALLOWED_EVENTS, cleanMetricEvent } from "./rita-v3-metrics.ts";

test("only allowed events pass, with a non-negative duration", () => {
  assert.equal(cleanMetricEvent({ name: "not_an_event" }), null);
  assert.equal(cleanMetricEvent(null), null);
  const event = cleanMetricEvent({ name: "llm_start", valueMs: 123.4, metadata: { a: 1 } });
  assert.deepEqual(event, { name: "llm_start", valueMs: 123.4, metadata: { a: 1 } });
  assert.equal(cleanMetricEvent({ name: "llm_start", valueMs: -5 })?.valueMs, 0);
  assert.equal(cleanMetricEvent({ name: "llm_start", valueMs: "x" })?.valueMs, undefined);
  assert.equal(cleanMetricEvent({ name: "llm_start" })?.valueMs, undefined);
});

test("the diagnostic events of the turn record and of lost events are allowed", () => {
  for (const name of ["turn_ledger", "metrics_dropped", "explanation_language", "dialogue_act"]) {
    assert.equal(ALLOWED_EVENTS.has(name), true, name);
  }
});

test("metadata that is too large is cut instead of stored whole", () => {
  const event = cleanMetricEvent({ name: "llm_start", metadata: { blob: "x".repeat(20_000) } });
  assert.ok(event);
  assert.equal(event.metadata.truncated, true);
  assert.ok(String(event.metadata.preview).length <= 12_000);
});
