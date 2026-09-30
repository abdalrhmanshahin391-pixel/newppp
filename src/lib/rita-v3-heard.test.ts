import assert from "node:assert/strict";
import test from "node:test";
import { committedRitaReply, wasRitaInterrupted } from "./rita-v3-heard.ts";

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
