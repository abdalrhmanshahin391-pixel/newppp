import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_LIMITS,
  MAX_PROMPT_CHARS,
  bearerToken,
  checkUsage,
  parseImageRequest,
  promptPreview,
  tokenIsUsable,
} from "./rita-image-request.ts";

test("bearerToken reads only a well-formed Authorization header", () => {
  assert.equal(bearerToken("Bearer abc123"), "abc123");
  assert.equal(bearerToken("bearer   abc123  "), "abc123");
  assert.equal(bearerToken("Basic abc123"), "");
  assert.equal(bearerToken("Bearer"), "");
  assert.equal(bearerToken("Bearer a b"), "");
  assert.equal(bearerToken(null), "");
  assert.equal(bearerToken(undefined), "");
});

test("a short or missing configured token keeps the endpoint closed", () => {
  assert.equal(tokenIsUsable(undefined), false);
  assert.equal(tokenIsUsable(""), false);
  assert.equal(tokenIsUsable("x".repeat(31)), false);
  assert.equal(tokenIsUsable("x".repeat(32)), true);
  assert.equal(tokenIsUsable(`  ${"x".repeat(32)}  `), true);
});

test("parseImageRequest applies safe defaults", () => {
  const parsed = parseImageRequest({ prompt: "  a red apple on a desk  " });
  assert.deepEqual(parsed, {
    ok: true,
    value: {
      prompt: "a red apple on a desk",
      size: "1024x1024",
      quality: "medium",
      style: "raw",
      save: false,
    },
  });
});

test("parseImageRequest accepts every documented option", () => {
  const parsed = parseImageRequest({
    prompt: "heart anatomy poster",
    size: "1536x1024",
    quality: "high",
    style: "lesson",
    save: true,
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.size, "1536x1024");
    assert.equal(parsed.value.quality, "high");
    assert.equal(parsed.value.style, "lesson");
    assert.equal(parsed.value.save, true);
  }
});

test("parseImageRequest rejects bad input with a readable reason", () => {
  const cases: [unknown, RegExp][] = [
    [null, /JSON object/],
    [[], /JSON object/],
    ["text", /JSON object/],
    [{}, /at least/],
    [{ prompt: "hi" }, /at least/],
    [{ prompt: 42 }, /at least/],
    [{ prompt: "x".repeat(MAX_PROMPT_CHARS + 1) }, /at most/],
    [{ prompt: "a cat", size: "4096x4096" }, /size must be/],
    [{ prompt: "a cat", quality: "ultra" }, /quality must be/],
    [{ prompt: "a cat", style: "anime" }, /style must be/],
    [{ prompt: "a cat", save: "yes" }, /save must be/],
  ];
  for (const [body, reason] of cases) {
    const parsed = parseImageRequest(body);
    assert.equal(parsed.ok, false, JSON.stringify(body)?.slice(0, 40));
    if (!parsed.ok) assert.match(parsed.error, reason);
  }
});

test("a prompt of exactly the maximum length is accepted", () => {
  assert.equal(parseImageRequest({ prompt: "x".repeat(MAX_PROMPT_CHARS) }).ok, true);
});

test("Arabic prompts are measured in characters, not bytes", () => {
  assert.equal(parseImageRequest({ prompt: "قلب بشري مرسوم بوضوح" }).ok, true);
});

test("checkUsage allows normal use and stops at each cap", () => {
  assert.deepEqual(checkUsage({ hour: 0, day: 0, running: 0 }), { allowed: true });
  assert.deepEqual(checkUsage({ hour: IMAGE_LIMITS.perHour - 1, day: 5, running: 1 }), {
    allowed: true,
  });
  const hour = checkUsage({ hour: IMAGE_LIMITS.perHour, day: 5, running: 0 });
  assert.equal(hour.allowed, false);
  if (!hour.allowed) assert.equal(hour.retryAfterSecs, 3600);
  const day = checkUsage({ hour: 1, day: IMAGE_LIMITS.perDay, running: 0 });
  assert.equal(day.allowed, false);
  if (!day.allowed) assert.equal(day.retryAfterSecs, 86_400);
  const busy = checkUsage({ hour: 0, day: 0, running: IMAGE_LIMITS.concurrent });
  assert.equal(busy.allowed, false);
});

test("promptPreview is one short line", () => {
  const preview = promptPreview(`line one\n\n  line two ${"y".repeat(300)}`);
  assert.equal(preview.includes("\n"), false);
  assert.ok(preview.length <= 120);
  assert.ok(preview.startsWith("line one line two"));
});
