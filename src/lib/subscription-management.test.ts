import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBillingChange,
  confirmCancellation,
  confirmCardRemoval,
} from "./subscription-management.ts";

test("a provider failure never cancels locally or removes a card", async () => {
  let mutations = 0;
  const result = await applyBillingChange({
    cancelRenewal: async () => {
      throw new Error("network");
    },
    syncCancellation: async () => {
      mutations++;
    },
    removeCard: async () => {
      mutations++;
    },
    syncCardRemoval: async () => {
      mutations++;
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.renewalStopped, false);
  assert.equal(mutations, 0);
});
test("confirmed cancellation is reported even if later card removal fails", async () => {
  let removedLocally = false;
  const result = await applyBillingChange({
    cancelRenewal: async () => {},
    syncCancellation: async () => {},
    removeCard: async () => {
      throw new Error("declined");
    },
    syncCardRemoval: async () => {
      removedLocally = true;
    },
  });
  assert.equal(result.code, "card_failed");
  assert.equal(result.renewalStopped, true);
  assert.equal(result.cardRemoved, false);
  assert.equal(removedLocally, false);
});
test("local failure stays partial after a confirmed remote change", async () => {
  const result = await applyBillingChange({
    removeCard: async () => {},
    syncCardRemoval: async () => {
      throw new Error("database");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "sync_pending");
  assert.equal(result.cardRemoved, true);
});
test("a retry confirms an already scheduled cancellation instead of reporting false failure", async () => {
  const methods: string[] = [];
  await confirmCancellation(async (_path, init) => {
    methods.push(init?.method ?? "GET");
    return methods.length === 1
      ? new Response("already scheduled", { status: 400 })
      : Response.json({ data: { scheduled_change: { action: "cancel" } } });
  }, "sub_own");
  assert.deepEqual(methods, ["POST", "GET"]);
});
test("a timed-out request that actually succeeded is confirmed, and unconfirmed changes fail", async () => {
  let calls = 0;
  await confirmCancellation(async () => {
    if (++calls === 1) throw new Error("timeout");
    return Response.json({ data: { status: "canceled" } });
  }, "sub_own");
  await assert.rejects(
    confirmCancellation(async () => new Response("failure", { status: 500 }), "sub_own"),
  );
  await confirmCardRemoval(async () => new Response(null, { status: 404 }), "ctm_own", "pmt_own");
  await assert.rejects(
    confirmCardRemoval(async () => new Response(null, { status: 503 }), "ctm_own", "pmt_own"),
  );
});
