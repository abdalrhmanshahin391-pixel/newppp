import assert from "node:assert/strict";
import test from "node:test";
import { createRitaSpeechTicket, verifyRitaSpeechTicket } from "./rita-speech-ticket.server.ts";

test("speech tickets bind user, turn, segment, and exact text", async () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-signing-secret-with-enough-entropy";
  try {
    const input = {
      userId: "11111111-1111-4111-8111-111111111111",
      turnId: "22222222-2222-4222-8222-222222222222",
      index: 0,
      text: "فهمت عليك، خلينا نكمل.",
    };
    const ticket = await createRitaSpeechTicket(input);
    assert.equal(await verifyRitaSpeechTicket({ ...input, ticket }), true);
    assert.equal(await verifyRitaSpeechTicket({ ...input, text: "changed", ticket }), false);
    assert.equal(await verifyRitaSpeechTicket({ ...input, index: 1, ticket }), false);
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  }
});
