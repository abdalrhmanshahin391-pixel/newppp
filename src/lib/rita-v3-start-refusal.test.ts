import assert from "node:assert/strict";
import test from "node:test";
import { withRefusalInfo } from "./rita-v3-start-refusal.ts";

test("a refusal carries its code where the voice client reads it", async () => {
  const refused = Response.json(
    { ok: false, code: "voice_not_available_for_language", message: "Not for German yet." },
    { status: 409 },
  );
  const out = await withRefusalInfo(refused);
  assert.equal(out.status, 409);
  assert.equal((await out.json()).info, "voice_not_available_for_language: Not for German yet.");
});

test("a plain-text 401 becomes JSON with the unauthorized code", async () => {
  const out = await withRefusalInfo(new Response("Unauthorized", { status: 401 }));
  assert.equal(out.status, 401);
  assert.equal((await out.json()).info, "unauthorized: Unauthorized");
});

test("a success and an info that already names its code pass unchanged", async () => {
  const ok = Response.json({ dailyRoom: "r" });
  assert.equal(await withRefusalInfo(ok), ok);
  const named = Response.json({ code: "x", info: "x: y" }, { status: 502 });
  assert.equal(await withRefusalInfo(named), named);
});
