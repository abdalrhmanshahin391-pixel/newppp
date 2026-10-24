import assert from "node:assert/strict";
import test from "node:test";
import { ledgerMetadata, TURN_LEDGER_TYPE } from "./rita-turn-ledger.ts";

const message = {
  type: TURN_LEDGER_TYPE,
  v: 1,
  turn_ref: "s-1-t-4",
  turn: 4,
  build: "95bfb0416ff1",
  stop: "period",
  wait_ms: 900,
  resumed: 1,
  words: 6,
  lang: "en",
  lang_src: "site",
  explain_lang: "en",
  learn_lang: "de",
  act: "other",
  resp: "explain",
  task: "break the phrase down word by word",
  route: "pass",
  answered: true,
  interrupted: true,
  cut_after_ms: 2100,
  finish: "stop",
  commit_ms: 950,
  llm_first_ms: 380,
  first_audio_ms: 200,
  prompt: "a1b2c3d4",
};

test("a ledger message becomes metadata with the links to the conversation", () => {
  const meta = ledgerMetadata(message, {
    conversationId: "c1",
    userMessageId: "u1",
    replyMessageId: "r1",
  });
  assert.ok(meta);
  assert.equal(meta.turn_ref, "s-1-t-4");
  assert.equal(meta.stop, "period");
  assert.equal(meta.interrupted, true);
  assert.equal(meta.wait_ms, 900);
  assert.equal(meta.conversationId, "c1");
  assert.equal(meta.userMessageId, "u1");
  assert.equal(meta.replyMessageId, "r1");
});

test("anything that is not a ledger, or has no turn reference, is ignored", () => {
  assert.equal(ledgerMetadata(null), null);
  assert.equal(ledgerMetadata("rita-turn-ledger"), null);
  assert.equal(ledgerMetadata({ type: "rita-ui", action: "open_list" }), null);
  assert.equal(ledgerMetadata({ type: TURN_LEDGER_TYPE }), null);
  assert.equal(ledgerMetadata({ type: TURN_LEDGER_TYPE, turn_ref: "  " }), null);
});

test("only known plain fields survive, so no spoken text or secret can ride along", () => {
  const meta = ledgerMetadata({
    ...message,
    transcript: "what the learner said",
    reply: "what Rita said",
    api_key: "sk-secret",
    nested: { a: 1 },
  });
  assert.ok(meta);
  for (const key of ["transcript", "reply", "api_key", "nested"]) {
    assert.equal(key in meta, false, key);
  }
});

test("wrong types and long values are dropped or cut", () => {
  const meta = ledgerMetadata({
    type: TURN_LEDGER_TYPE,
    turn_ref: "x".repeat(200),
    wait_ms: "900",
    words: Number.NaN,
    stop: "y".repeat(500),
    interrupted: "yes",
    cut_after_ms: 12.7,
  });
  assert.ok(meta);
  assert.equal((meta.turn_ref as string).length, 80);
  assert.equal("wait_ms" in meta, false);
  assert.equal("words" in meta, false);
  assert.equal((meta.stop as string).length, 48);
  assert.equal("interrupted" in meta, false);
  assert.equal(meta.cut_after_ms, 13);
});

test("missing links are simply left out", () => {
  const meta = ledgerMetadata(message, { conversationId: null, userMessageId: "" });
  assert.ok(meta);
  assert.equal("conversationId" in meta, false);
  assert.equal("userMessageId" in meta, false);
});
