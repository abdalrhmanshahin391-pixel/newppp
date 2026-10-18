import assert from "node:assert/strict";
import test from "node:test";
import {
  committedRitaReply,
  RitaReplyAccumulator,
  wasRitaInterrupted,
  settleDraftReply,
  upsertDraftReply,
} from "./rita-v3-heard.ts";

test("interrupted reply cannot fall back to generated but unspoken text", () => {
  assert.equal(
    committedRitaReply({
      reportedSpokenText: "",
      generatedText: "A long explanation",
      interrupted: true,
    }),
    "",
  );
  assert.equal(
    committedRitaReply({
      reportedSpokenText: "First phrase",
      generatedText: "First phrase and more",
      interrupted: true,
    }),
    "First phrase",
  );
});

test("completed reply can use generated text if no spoken progress event arrived", () => {
  assert.equal(
    committedRitaReply({
      reportedSpokenText: "",
      generatedText: "Short answer",
      interrupted: false,
    }),
    "Short answer",
  );
});

test("completed reply keeps both chunks even when the last progress event covers only one", () => {
  assert.equal(
    committedRitaReply({
      reportedSpokenText: "Second sentence.",
      generatedText: "First sentence. Second sentence.",
      interrupted: false,
    }),
    "First sentence. Second sentence.",
  );
});

test("a brief acknowledgement is only an interruption candidate", () => {
  assert.equal(wasRitaInterrupted(1_000, 1_400), true);
  assert.equal(wasRitaInterrupted(1_000, 3_000), false);
  assert.equal(wasRitaInterrupted(0, 1_400), false);
});

test("streamed replies appear immediately and update in place", () => {
  const first = upsertDraftReply([{ id: "a", text: "hi" }], { id: "d", text: "Hello" });
  assert.deepEqual(first, [
    { id: "a", text: "hi" },
    { id: "d", text: "Hello" },
  ]);
  const second = upsertDraftReply(first, { id: "d", text: "Hello there" });
  assert.deepEqual(second, [
    { id: "a", text: "hi" },
    { id: "d", text: "Hello there" },
  ]);
});

test("an interrupted reply is trimmed to what was heard, or removed when nothing was", () => {
  const list = [{ id: "d", text: "Hello there, how are you today" }];
  assert.deepEqual(settleDraftReply(list, "d", "Hello there", null), [
    { id: "d", text: "Hello there" },
  ]);
  assert.deepEqual(settleDraftReply(list, "d", "", null), []);
});

test("without a draft the committed reply is appended once", () => {
  const added = settleDraftReply([], null, "Hi", { id: "n", text: "Hi" });
  assert.deepEqual(added, [{ id: "n", text: "Hi" }]);
  assert.deepEqual(settleDraftReply([], null, "", { id: "n", text: "" }), []);
});

test("a scripted acknowledgement cannot reuse the previous LLM answer", () => {
  const reply = new RitaReplyAccumulator();
  reply.beginLlm();
  reply.appendGenerated("A previous long answer.");
  reply.reportSpoken("A previous long answer.");
  assert.equal(reply.settle(false).reply, "A previous long answer.");

  reply.beginTts();
  reply.reportSpoken("تمام.");
  assert.equal(reply.visibleText(), "تمام.");
  assert.equal(reply.settle(false).reply, "تمام.");
});

test("spoken progress supplies visible text for a TTS-only response", () => {
  const reply = new RitaReplyAccumulator();
  reply.beginTts();
  reply.reportSpoken("حاضر.");
  assert.equal(reply.generatedText, "");
  assert.equal(reply.visibleText(), "حاضر.");
  assert.equal(reply.settle(false).reply, "حاضر.");
});

test("starting TTS does not erase the active streamed LLM response", () => {
  const reply = new RitaReplyAccumulator();
  reply.beginLlm();
  reply.appendGenerated("First sentence. Second sentence.");
  reply.beginTts();
  reply.reportSpoken("First sentence.");
  assert.equal(reply.visibleText(), "First sentence. Second sentence.");
  assert.equal(reply.settle(false).reply, "First sentence. Second sentence.");
});
