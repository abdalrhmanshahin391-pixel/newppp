import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  ANNOUNCEMENT_STALE_MS,
  createActivityGate,
  PRESENCE_ACTIVE_MS,
  PRESENCE_INTERVAL_MS,
} from "./idle-activity";

describe("idle savings rules", () => {
  test("hydrated or focused sessions without interaction produce no presence write", () => {
    const gate = createActivityGate();
    assert.equal(gate.take(0, true), false);
    assert.equal(gate.take(60 * 60_000, true), false);
  });
  test("presence never writes for hidden tabs", () => {
    const gate = createActivityGate();
    gate.interact(100);
    assert.equal(gate.take(100, false), false);
    assert.equal(gate.take(100, true), true);
  });
  test("presence writes at most once per 30 minutes even after repeated activity", () => {
    assert.equal(PRESENCE_INTERVAL_MS, 30 * 60_000);
    const gate = createActivityGate();
    gate.interact(0);
    assert.equal(gate.take(0, true), true);
    gate.interact(29 * 60_000);
    assert.equal(gate.take(29 * 60_000, true), false);
    gate.interact(30 * 60_000);
    assert.equal(gate.take(30 * 60_000, true), true);
  });
  test("presence requires interaction within two minutes", () => {
    assert.equal(PRESENCE_ACTIVE_MS, 2 * 60_000);
    const gate = createActivityGate();
    gate.interact(0);
    assert.equal(gate.take(2 * 60_000 + 1, true), false);
  });
  test("account changes cannot inherit another account's activity", () => {
    const gate = createActivityGate();
    gate.interact(0);
    gate.reset();
    assert.equal(gate.take(1, true), false);
  });
  test("signed-in announcements remain fresh for one hour", () => {
    assert.equal(ANNOUNCEMENT_STALE_MS, 60 * 60_000);
  });
});
