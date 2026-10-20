import assert from "node:assert/strict";
import test from "node:test";
import { activeDays, activitySummary, dayKey } from "./activity-streak.ts";

const now = new Date("2026-10-20T10:00:00Z");

test("dayKey reads timestamps and plain dates, and rejects the rest", () => {
  assert.equal(dayKey("2026-10-20T23:59:59Z"), "2026-10-20");
  assert.equal(dayKey("2026-10-20T23:59:59+03:00"), "2026-10-20");
  assert.equal(dayKey("2026-10-20"), "2026-10-20");
  assert.equal(dayKey(""), null);
  assert.equal(dayKey("not a date"), null);
  assert.equal(dayKey(null), null);
  assert.equal(dayKey(42), null);
});

test("activeDays merges sources and drops unreadable values", () => {
  const days = activeDays([
    "2026-10-20T01:00:00Z",
    "2026-10-20T22:00:00Z",
    "2026-10-19",
    null,
    "x",
  ]);
  assert.deepEqual([...days].sort(), ["2026-10-19", "2026-10-20"]);
});

test("no activity means no streak", () => {
  assert.deepEqual(activitySummary(new Set(), now), { streak: 0, activeToday: false });
});

test("a streak counts back from today", () => {
  const days = new Set(["2026-10-20", "2026-10-19", "2026-10-18"]);
  assert.deepEqual(activitySummary(days, now), { streak: 3, activeToday: true });
});

test("a streak is kept alive until the end of today", () => {
  const days = new Set(["2026-10-19", "2026-10-18"]);
  assert.deepEqual(activitySummary(days, now), { streak: 2, activeToday: false });
});

test("a missed day ends the streak", () => {
  const days = new Set(["2026-10-20", "2026-10-18", "2026-10-17"]);
  assert.deepEqual(activitySummary(days, now), { streak: 1, activeToday: true });
  const old = new Set(["2026-10-17", "2026-10-16"]);
  assert.deepEqual(activitySummary(old, now), { streak: 0, activeToday: false });
});

test("it works across a month and a year boundary", () => {
  const month = new Set(["2026-11-01", "2026-10-31", "2026-10-30"]);
  assert.equal(activitySummary(month, new Date("2026-11-01T00:30:00Z")).streak, 3);
  const year = new Set(["2027-01-01", "2026-12-31", "2026-12-30"]);
  assert.equal(activitySummary(year, new Date("2027-01-01T12:00:00Z")).streak, 3);
});

test("a very long run is counted fully", () => {
  const days = new Set<string>();
  for (let i = 0; i < 400; i += 1)
    days.add(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10));
  assert.equal(activitySummary(days, now).streak, 400);
});
