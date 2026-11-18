import test from "node:test";
import assert from "node:assert/strict";
import { voiceSecondsLeft, voiceTimeLabel, type VoiceTimeSnapshot } from "./free-talk-time.ts";
const snapshot: VoiceTimeSnapshot = {
  remainingSeconds: 600,
  unlimited: false,
  activeSessionId: null,
  activeDeadline: null,
  serverNow: "2026-11-18T00:00:00Z",
  enabled: true,
  limitSeconds: 600,
  period: "lifetime",
  resetsAt: null,
};
test("finite idle balance does not tick", () =>
  assert.equal(voiceSecondsLeft(snapshot, 900000), 600));
test("active balance counts monotonic elapsed time and never goes negative", () => {
  assert.equal(
    voiceSecondsLeft(
      { ...snapshot, activeSessionId: "session", activeDeadline: "2026-11-18T00:10:00Z" },
      2500,
    ),
    597,
  );
  assert.equal(
    voiceSecondsLeft(
      { ...snapshot, activeSessionId: "session", activeDeadline: "2026-11-18T00:10:00Z" },
      900000,
    ),
    0,
  );
});
test("only an explicit server admin flag displays unlimited", () => {
  assert.equal(voiceSecondsLeft({ ...snapshot, remainingSeconds: null }, 0), 0);
  assert.equal(voiceSecondsLeft({ ...snapshot, unlimited: true, remainingSeconds: null }, 0), null);
});
test("clock display preserves hours and zero", () => {
  assert.equal(voiceTimeLabel(36000), "10:00:00");
  assert.equal(voiceTimeLabel(0), "00:00:00");
  assert.equal(voiceTimeLabel(null), "∞");
});
