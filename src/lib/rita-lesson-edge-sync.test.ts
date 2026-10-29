// The Edge Function runs outside the app bundle, so it uses copies of the lesson engine files.
// This test fails when a copy drifts, and checks what must never leave the function.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SHARED_FILES } from "../../scripts/sync-lesson-edge.mjs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("every shared lesson file in the Edge Function is identical to the app's file", () => {
  for (const name of SHARED_FILES) {
    assert.equal(
      read(`../../supabase/functions/_shared/${name}`),
      read(`./${name}`),
      `${name} drifted: run node scripts/sync-lesson-edge.mjs`,
    );
  }
});

test("the shared files only import each other, zod and supabase types", () => {
  for (const name of SHARED_FILES) {
    const imports = [...read(`./${name}`).matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) {
      assert.ok(
        spec.startsWith("./") || spec === "zod" || spec === "@supabase/supabase-js",
        `${name} imports ${spec}, which the Edge Function cannot resolve`,
      );
    }
  }
});

test("the Edge Function checks the token before touching any data and never sends content", () => {
  const source = read("../../supabase/functions/rita-lesson-run/index.ts");
  assert.ok(source.indexOf("getClaims") < source.indexOf("createClient(env.url, env.serviceKey"));
  assert.match(source, /request\.method !== "POST"/);
  // Responses are the core's results only (they are built by a whitelist), never a raw row.
  assert.doesNotMatch(source, /\.select\([^)]*content/);
});

test("config turns the gateway JWT check off only because the function checks the token itself", () => {
  const config = read("../../supabase/config.toml");
  assert.match(config, /\[functions\.rita-lesson-run\]\s+verify_jwt = false/);
});

test("the review Edge Function checks the worker key before it reviews, and answers with counts", () => {
  const source = read("../../supabase/functions/rita-review/index.ts");
  assert.match(source, /request\.method !== "POST"/);
  assert.ok(source.indexOf("worker_cron_key") < source.indexOf("reviewConversation(db"));
  // One conversation per run, claimed first, and no polling: the next run is woken, not scheduled.
  assert.ok(source.indexOf("rita_review_claim") < source.indexOf("reviewConversation(db"));
  assert.match(source, /rita_review_wake/);
  assert.match(source, /MAX_DEPTH/);
  assert.ok(source.indexOf("sameText(provided, expected)") < source.indexOf("setReviewDeps("));
  const config = read("../../supabase/config.toml");
  assert.match(config, /\[functions\.rita-review\]\s+verify_jwt = false/);
});
