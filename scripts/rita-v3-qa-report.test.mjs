import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRitaQa, REQUIRED_CASES } from "./rita-v3-qa-report.mjs";

test("empty evidence never passes", () => {
  const report = evaluateRitaQa([]);
  assert.equal(report.passed, false);
  assert.equal(report.measures.latencyP95, null);
});

test("a complete synthetic corpus passes only when each quality gate passes", () => {
  const rows = Object.entries(REQUIRED_CASES).flatMap(([category, count]) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${category}-${index}`,
      category,
      source: "recorded_audio",
      network: "good",
      audibleLatencyMs: 1_000,
      turnDecisionMs: 300,
      interruptionStopMs: category === "true_interruption" ? 150 : undefined,
      prematureEnd: false,
      falseInterruption: false,
      intentUnderstood: true,
      targetTermsCorrect: true,
      ratingCount: category === "jordanian" ? 3 : undefined,
      naturalnessScore: 4.5,
      dialectScore: 4.5,
      intelligibilityScore: 4.5,
      learningItemCount: 0,
      learningJsonValid: true,
      learningMeaningCorrect: true,
      savePersisted: true,
      duplicateCount: 0,
      turnCount: 20,
      wrongLanguageSwitch: false,
      changedStrategy: true,
      visibleError: true,
      legacyFallback: false,
      uncertaintySafe: true,
    })),
  );
  assert.equal(evaluateRitaQa(rows).passed, true);
  rows[0].audibleLatencyMs = 4_000;
  assert.equal(evaluateRitaQa(rows).passed, true, "one slow turn is below the p95 gate");
  for (let index = 0; index < 100; index++) rows[index].audibleLatencyMs = 4_000;
  assert.equal(evaluateRitaQa(rows).gates.audibleLatency, false);
});

test("remote-level telemetry is not accepted as audible playback evidence", () => {
  const report = evaluateRitaQa([
    {
      id: "x",
      category: "jordanian",
      source: "remote_audio_level",
      network: "good",
      audibleLatencyMs: 10,
    },
  ]);
  assert.equal(report.passed, false);
  assert.match(report.problems[0], /recorded-audio/);
});
