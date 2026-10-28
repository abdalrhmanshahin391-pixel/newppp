import assert from "node:assert/strict";
import test from "node:test";
import {
  REFUSED_MESSAGE,
  ackStep,
  isLive,
  ritaEventStep,
  stopStep,
  type ActiveRequest,
  type RequestState,
} from "./study-request-state.ts";

const request = (state: RequestState, channel: "voice" | "text" = "voice"): ActiveRequest => ({
  id: "r1",
  action: "explain",
  quote: "are",
  channel,
  state,
});
const ack = (state: string, id = "r1") => ({ type: "rita-study-ack", request_id: id, state });

test("ST-U09: Rita's acknowledgement moves the current request on", () => {
  assert.deepEqual(ackStep(request("sent"), ack("started")), {
    state: "started",
    timer: "first_audio",
  });
  assert.deepEqual(ackStep(request("sent"), ack("failed")), {
    state: "failed",
    message: REFUSED_MESSAGE,
    timer: "clear",
  });
  assert.deepEqual(ackStep(request("started"), ack("cancelled")), {
    state: "cancelled",
    timer: "clear",
  });
});

test("ST-U09: an answer about another or a finished request is never applied", () => {
  // A late answer from the old request must not land on the new one.
  assert.equal(ackStep(request("sent"), ack("started", "old")), null);
  for (const state of ["done", "failed", "cancelled"] as const)
    assert.equal(ackStep(request(state), ack("started")), null, state);
  assert.equal(ackStep(null, ack("started")), null);
  assert.equal(ackStep(request("sent"), { type: "rita-turn-ledger", request_id: "r1" }), null);
  assert.equal(ackStep(request("sent"), ack("dancing")), null);
});

test("Rita's speaking state: quiet after her answer means done; an ended call cancels", () => {
  assert.deepEqual(ritaEventStep(request("started"), "speaking"), {
    state: "started",
    timer: "clear",
  });
  assert.deepEqual(ritaEventStep(request("started"), "quiet"), { state: "done", timer: "clear" });
  // Quiet before Rita took the request (she was finishing something else) changes nothing.
  assert.equal(ritaEventStep(request("sent"), "quiet"), null);
  for (const state of ["resolving", "sent", "started"] as const)
    assert.deepEqual(ritaEventStep(request(state), "ended"), {
      state: "cancelled",
      timer: "clear",
    });
  assert.equal(ritaEventStep(request("done"), "ended"), null);
  // A written answer does not follow the call.
  assert.equal(ritaEventStep(request("started", "text"), "quiet"), null);
  assert.equal(ritaEventStep(null, "quiet"), null);
});

test("Stop cancels only a live request", () => {
  assert.deepEqual(stopStep(request("started")), { state: "cancelled", timer: "clear" });
  assert.equal(stopStep(request("done")), null);
  assert.equal(stopStep(null), null);
  assert.deepEqual(
    (["resolving", "sent", "started", "done", "failed", "cancelled"] as const).map(isLive),
    [true, true, true, false, false, false],
  );
});
