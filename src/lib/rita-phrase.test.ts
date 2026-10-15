import assert from "node:assert/strict";
import test from "node:test";
import {
  allowRequest,
  cleanPhrase,
  normalizePhrase,
  parseExplanation,
  ttsPlan,
} from "./rita-phrase.ts";

test("one key for the same phrase however it is written", () => {
  assert.equal(normalizePhrase(" “Guten  Morgen”. "), "guten morgen");
  assert.equal(normalizePhrase("Good morning,"), "good morning");
  assert.equal(normalizePhrase(""), "");
  assert.equal(cleanPhrase(" “Guten  Morgen”. "), "Guten Morgen");
  assert.equal(normalizePhrase("x".repeat(500)).length, 120);
});

test("the model's answer is read defensively", () => {
  const ok = parseExplanation(
    '{"lang":"de","translation_ar":"صباح الخير","pronunciation_ar":"غوتن مورغن","tip_ar":""}',
  );
  assert.deepEqual(ok, {
    lang: "de",
    translation_ar: "صباح الخير",
    pronunciation_ar: "غوتن مورغن",
    tip_ar: "",
  });
  assert.equal(parseExplanation("not json"), null);
  assert.equal(parseExplanation({ lang: "de" }), null);
  assert.equal(parseExplanation(null), null);
  assert.equal(parseExplanation({ lang: "fr", translation_ar: "x" })?.lang, "other");
});

test("the three pronunciation styles differ in speed and wording", () => {
  const fast = ttsPlan("de", "fast", "Guten Morgen");
  const slow = ttsPlan("de", "slow", "Guten Morgen");
  const precise = ttsPlan("en", "precise", "Good morning again");
  assert.ok(slow.speed < fast.speed);
  assert.equal(fast.input, "Guten Morgen");
  assert.equal(precise.input, "Good, morning, again");
  assert.equal(ttsPlan("en", "precise", "Hello").input, "Hello");
  assert.match(slow.instructions, /slowly/);
  assert.match(ttsPlan("de", "fast", "x").instructions, /German/);
  assert.match(precise.instructions, /English/);
  for (const plan of [fast, slow, precise]) assert.ok(plan.speed >= 0.65 && plan.speed <= 1.05);
});

test("the limiter allows a burst then blocks until the window passes", () => {
  const hits = new Map<string, number[]>();
  for (let i = 0; i < 3; i += 1) assert.equal(allowRequest(hits, "u", 1000 + i, 3, 60_000), true);
  assert.equal(allowRequest(hits, "u", 2000, 3, 60_000), false);
  assert.equal(allowRequest(hits, "other", 2000, 3, 60_000), true);
  assert.equal(allowRequest(hits, "u", 70_000, 3, 60_000), true);
});
