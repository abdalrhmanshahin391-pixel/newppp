import assert from "node:assert/strict";
import test from "node:test";
import {
  committedRitaReply,
  LearnerTurn,
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

test("an interrupted reply keeps generated text and marks the heard boundary", () => {
  const list = [{ id: "d", text: "Hello there, how are you today" }];
  assert.deepEqual(settleDraftReply(list, "d", "Hello there, how are you today", null, 11), [
    { id: "d", text: "Hello there, how are you today", interruptedAt: 11 },
  ]);
  assert.deepEqual(settleDraftReply(list, "d", "", null), []);
});

test("without a draft the committed reply is appended once", () => {
  const added = settleDraftReply([], null, "Hi", { id: "n", text: "Hi" });
  assert.deepEqual(added, [{ id: "n", text: "Hi", interruptedAt: null }]);
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

test("pieces of one learner turn share one bubble and each word appears once", () => {
  const turn = new LearnerTurn();
  turn.speechStarted("a", "t1");
  assert.equal(turn.addFinal("Äh. You are so confused.", "x", "tx"), "Äh. You are so confused.");
  // The learner carries on before Rita answers: new speech start, same bubble.
  turn.speechStarted("b", "t2");
  assert.equal(
    turn.addFinal("You don't understand what I say.", "y", "ty"),
    "Äh. You are so confused. You don't understand what I say.",
  );
  assert.equal(turn.id, "a");
  assert.equal(turn.createdAt, "t1");
});

test("once Rita starts to answer, the next words are a new bubble that starts from nothing", () => {
  const turn = new LearnerTurn();
  turn.speechStarted("a", "t1");
  turn.addFinal("أعطيني مجموعة.", "x", "tx");
  turn.replyStarted();
  assert.equal(turn.text, "أعطيني مجموعة.", "the asked words stay readable for the reply");
  turn.speechStarted("b", "t2");
  assert.equal(turn.addFinal("لا، بدي أحكي.", "y", "ty"), "لا، بدي أحكي.");
  assert.equal(turn.id, "b");
  assert.equal(turn.createdAt, "t2");
});

test("a barge-in that settles the old reply does not lend its id to the next piece", () => {
  const turn = new LearnerTurn();
  turn.speechStarted("a", "t1");
  turn.addFinal("first", "x", "tx");
  turn.replyStarted();
  turn.speechStarted("b", "t2");
  turn.addFinal("second", "y", "ty");
  assert.equal(turn.take(), "second", "the settled reply is handed the words it answered");
  // Another finished piece of the same speech arrives afterwards: it must not reuse "b".
  turn.addFinal("third", "c", "t3");
  assert.equal(turn.id, "c");
  assert.equal(turn.text, "third");
});

test("a turn longer than the limit keeps its most recent words", () => {
  const turn = new LearnerTurn();
  turn.speechStarted("a", "t1");
  assert.equal(turn.addFinal("0123456789", "x", "tx", 5), "56789");
});
