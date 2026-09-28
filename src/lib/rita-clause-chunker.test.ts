import assert from "node:assert/strict";
import test from "node:test";
import { cleanRitaSpokenText, RitaClauseChunker } from "./rita-clause-chunker.ts";

test("cleans formatting before speech", () => {
  assert.equal(cleanRitaSpokenText("**Hello** 👋\n- how are you?"), "Hello how are you?");
});

test("emits a natural first clause and no more than three segments", () => {
  const chunker = new RitaClauseChunker();
  assert.deepEqual(
    chunker.push("This is a natural opening sentence with enough words to speak. "),
    ["This is a natural opening sentence with enough words to speak."],
  );
  chunker.push("This is the second complete sentence with enough words to prefetch. ");
  chunker.push("A third sentence stays with the final remainder. A fourth one does too.");
  const final = chunker.flush();
  assert.equal(final.length, 1);
});
