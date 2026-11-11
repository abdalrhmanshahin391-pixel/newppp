import assert from "node:assert/strict";
import test from "node:test";

import { resolveServerRuntimeValue } from "./config.server.ts";
import { resolveRitaV3Key } from "./rita-provider-key.server.ts";

function setup({ serviceRole = false, saved = null, environment = {}, bindings = {} } = {}) {
  const calls = { saved: [], runtime: [], warnings: [] };
  const sources = {
    canReadSavedKey: () => serviceRole,
    async readSavedKey(provider) {
      calls.saved.push(provider);
      return saved;
    },
    async readRuntimeSecret(name) {
      calls.runtime.push(name);
      return resolveServerRuntimeValue(name, environment, bindings);
    },
    warn: (message) => calls.warnings.push(message),
  };
  return { calls, sources };
}

test("Groq works with a Workers-only binding and no service role", async () => {
  const { calls, sources } = setup({ bindings: { GROQ_API_KEY: " binding-fixture " } });
  assert.equal(await resolveRitaV3Key("groq", "GROQ_API_KEY", sources), "binding-fixture");
  assert.deepEqual(calls.saved, []);
  assert.deepEqual(calls.runtime, ["GROQ_API_KEY"]);
  assert.deepEqual(calls.warnings, []);
});

test("a configured admin key keeps priority over the runtime key", async () => {
  const { calls, sources } = setup({
    serviceRole: true,
    saved: " saved-fixture ",
    bindings: { GROQ_API_KEY: "binding-fixture" },
  });
  assert.equal(await resolveRitaV3Key("groq", "GROQ_API_KEY", sources), "saved-fixture");
  assert.deepEqual(calls.saved, ["groq"]);
  assert.deepEqual(calls.runtime, []);
});

test("a blank admin key falls back to the Node environment before bindings", async () => {
  const { sources } = setup({
    serviceRole: true,
    saved: " ",
    environment: { GROQ_API_KEY: " process-fixture " },
    bindings: { GROQ_API_KEY: "binding-fixture" },
  });
  assert.equal(await resolveRitaV3Key("groq", "GROQ_API_KEY", sources), "process-fixture");
});

test("a failed admin lookup still uses the binding and never logs its raw error", async () => {
  const { calls, sources } = setup({ serviceRole: true, bindings: { GROQ_API_KEY: "fixture" } });
  sources.readSavedKey = async () => {
    throw new Error("private-error-payload");
  };
  assert.equal(await resolveRitaV3Key("groq", "GROQ_API_KEY", sources), "fixture");
  assert.equal(calls.warnings.length, 1);
  assert.ok(!calls.warnings[0].includes("private-error-payload"));
});

test("an absent key remains absent rather than becoming a usable-looking string", async () => {
  const { sources } = setup({ bindings: { GROQ_API_KEY: {} } });
  assert.equal(await resolveRitaV3Key("groq", "GROQ_API_KEY", sources), "");
});

test("runtime values are read again on each request, including other voice providers", async () => {
  const bindings = { PIPECAT_PRIVATE_API_KEY: "first-fixture" };
  const { sources } = setup({ bindings });
  assert.equal(
    await resolveRitaV3Key("pipecat_private", "PIPECAT_PRIVATE_API_KEY", sources),
    "first-fixture",
  );
  bindings.PIPECAT_PRIVATE_API_KEY = "second-fixture";
  assert.equal(
    await resolveRitaV3Key("pipecat_private", "PIPECAT_PRIVATE_API_KEY", sources),
    "second-fixture",
  );
});
