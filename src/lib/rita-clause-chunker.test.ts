import assert from "node:assert/strict";
import test from "node:test";
import { cleanRitaSpokenText, RitaClauseChunker } from "./rita-clause-chunker.ts";

test("cleans formatting before speech", () => {
  assert.equal(cleanRitaSpokenText("**Hello** 👋\n- how are you?"), "Hello how are you?");
});

test("releases a short first clause early", () => {
  const chunker = new RitaClauseChunker();
  assert.deepEqual(chunker.push("Great question, "), []);
  assert.deepEqual(chunker.push("let me explain it simply, "), [
    "Great question, let me explain it simply,",
  ]);
});

test("first clause is capped at six words without punctuation", () => {
  const chunker = new RitaClauseChunker();
  const out = chunker.push("one two three four five six seven eight nine ten eleven ");
  assert.equal(out.length, 1);
  assert.equal(out[0].split(" ").length, 6);
});

test("Arabic comma releases the first clause", () => {
  const chunker = new RitaClauseChunker();
  assert.deepEqual(chunker.push("أهلين، شو بتحب نتعلم اليوم، "), ["أهلين، شو بتحب نتعلم اليوم،"]);
});

test("keeps final speech segments bounded", () => {
  const chunker = new RitaClauseChunker();
  chunker.push("This is a natural opening sentence with enough words to speak. ");
  chunker.push("This is the second complete sentence with enough words to prefetch. ");
  chunker.push("A third sentence stays with the final remainder. A fourth one does too.");
  const final = chunker.flush();
  assert.ok(final.length <= 6);
  assert.ok(final.every((segment) => segment.split(/\s+/).length <= 24));
});
