import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./start.ts", import.meta.url);

test("Rita v3 starts through Modal without a Pipecat fallback", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.doesNotMatch(source, /api\.pipecat\.daily\.co/);
  assert.doesNotMatch(source, /pipecat_not_configured/);
  assert.match(source, /backend:\s*"modal"/);
  assert.match(source, /getServerRuntimeSecret\("MODAL_START_TOKEN"\)/);
});

test("the session start sends the learner's language to the worker and refuses a language without voice", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /loadTargetLanguage\(/);
  assert.match(source, /voice_not_available_for_language/);
  assert.match(source, /targetLanguage:\s*\{/);
  // A language that is not in the list, or no language at all, must leave the request as it was.
  assert.match(source, /\.\.\.\(target\s*\?/);
});
