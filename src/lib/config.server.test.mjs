import assert from "node:assert/strict";
import test from "node:test";

import { resolveServerRuntimeValue } from "./config.server.ts";

test("server runtime values prefer process.env when it is available", () => {
  assert.equal(
    resolveServerRuntimeValue(
      "MODAL_START_TOKEN",
      { MODAL_START_TOKEN: " process-token " },
      { MODAL_START_TOKEN: "binding-token" },
    ),
    "process-token",
  );
});

test("server runtime values fall back to Cloudflare bindings", () => {
  assert.equal(
    resolveServerRuntimeValue("MODAL_START_TOKEN", {}, { MODAL_START_TOKEN: " binding-token " }),
    "binding-token",
  );
});

test("server runtime values never stringify non-string bindings", () => {
  assert.equal(resolveServerRuntimeValue("MODAL_START_TOKEN", {}, { MODAL_START_TOKEN: {} }), "");
});
