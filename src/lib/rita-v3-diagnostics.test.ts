import assert from "node:assert/strict";
import test from "node:test";
import { classifyPipecatStartFailure, sanitizePipecatDiagnostic } from "./rita-v3-diagnostics.ts";

test("classifies a missing deployed agent", () => {
  const failure = classifyPipecatStartFailure(404, { detail: "agent not found" });
  assert.equal(failure.code, "agent_not_found");
  assert.equal(failure.retryable, false);
  assert.match(failure.message, /not deployed/i);
});

test("classifies unhealthy workers separately from missing keys", () => {
  const failure = classifyPipecatStartFailure(503, {
    detail: "Agent is not healthy; latest deployment failed",
  });
  assert.equal(failure.code, "agent_unhealthy");
  assert.equal(failure.retryable, true);
});

test("redacts provider credentials from diagnostics", () => {
  const message = sanitizePipecatDiagnostic(
    "Authorization Bearer abc.def.ghi failed for gsk_1234567890secret",
  );
  assert.equal(message.includes("abc.def.ghi"), false);
  assert.equal(message.includes("gsk_1234567890secret"), false);
  assert.match(message, /\[redacted\]/);
});
