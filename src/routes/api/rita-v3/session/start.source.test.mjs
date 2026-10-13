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
