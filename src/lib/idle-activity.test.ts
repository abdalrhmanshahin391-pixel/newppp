import { describe, expect, test } from "bun:test";
import { ANNOUNCEMENT_STALE_MS, createActivityGate, PRESENCE_ACTIVE_MS, PRESENCE_INTERVAL_MS } from "./idle-activity";

describe("idle savings rules", () => {
  test("hydrated or focused sessions without interaction produce no presence write", () => {
    const gate = createActivityGate();
    expect(gate.take(0, true)).toBe(false);
    expect(gate.take(60 * 60_000, true)).toBe(false);
  });
  test("presence never writes for hidden tabs", () => {
    const gate = createActivityGate();
    gate.interact(100);
    expect(gate.take(100, false)).toBe(false);
    expect(gate.take(100, true)).toBe(true);
  });
  test("presence writes at most once per 30 minutes even after repeated activity", () => {
    expect(PRESENCE_INTERVAL_MS).toBe(30 * 60_000);
    const gate = createActivityGate();
    gate.interact(0);
    expect(gate.take(0, true)).toBe(true);
    gate.interact(29 * 60_000);
    expect(gate.take(29 * 60_000, true)).toBe(false);
    gate.interact(30 * 60_000);
    expect(gate.take(30 * 60_000, true)).toBe(true);
  });
  test("presence requires interaction within two minutes", () => {
    expect(PRESENCE_ACTIVE_MS).toBe(2 * 60_000);
    const gate = createActivityGate();
    gate.interact(0);
    expect(gate.take(2 * 60_000 + 1, true)).toBe(false);
  });
  test("account changes cannot inherit another account's activity", () => {
    const gate = createActivityGate();
    gate.interact(0);
    gate.reset();
    expect(gate.take(1, true)).toBe(false);
  });
  test("signed-in announcements remain fresh for one hour", () => {
    expect(ANNOUNCEMENT_STALE_MS).toBe(60 * 60_000);
  });
});