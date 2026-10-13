import assert from "node:assert/strict";
import test from "node:test";
import { matchesCorrection, sanitizeCorrection, shouldCheckCorrection } from "./rita-correction.ts";

test("a valid correction is cleaned of markdown and trimmed", () => {
  const result = sanitizeCorrection({
    said: "Ich will einen Schawarma",
    better: "**Ich möchte** einen Shawarma.",
    why: "Shawarma has no c.",
    translation: "بدي شاورما",
    language: "de",
  });
  assert.deepEqual(result, {
    said: "Ich will einen Schawarma",
    better: "Ich möchte einen Shawarma.",
    why: "Shawarma has no c.",
    translation: "بدي شاورما",
    language: "de",
  });
});

test("an unchanged phrase, a missing field, or junk is rejected", () => {
  assert.equal(sanitizeCorrection({ said: "Guten Morgen", better: "guten morgen!" }), null);
  assert.equal(sanitizeCorrection({ said: "", better: "Guten Morgen" }), null);
  assert.equal(sanitizeCorrection(null), null);
  assert.equal(sanitizeCorrection("text"), null);
});

test("language falls back to detection and long fields are capped", () => {
  const result = sanitizeCorrection({
    said: "I has a car",
    better: "I have a car",
    why: "x".repeat(400),
  });
  assert.equal(result?.language, "en");
  assert.equal(result?.why.length, 220);
});

test("a retry matches the corrected phrase even with a small extra word", () => {
  assert.equal(matchesCorrection("Ich möchte einen Shawarma", "Ich möchte einen Shawarma."), true);
  assert.equal(
    matchesCorrection("ähm ich möchte einen Shawarma", "Ich möchte einen Shawarma"),
    true,
  );
  assert.equal(matchesCorrection("Ich will einen Schawarma", "Ich möchte einen Shawarma"), false);
  assert.equal(matchesCorrection("", "Guten Morgen"), false);
});

test("the gate only fires for German or English attempts", () => {
  assert.equal(shouldCheckCorrection("Ich will einen Schawarma", "free_conversation"), true);
  assert.equal(
    shouldCheckCorrection('كيف بدي أحكي "صباح الخير" بالألماني', "free_conversation"),
    false,
  );
  assert.equal(
    shouldCheckCorrection("إيه، كيف بدي أحكي Guten Morgen ثانية", "free_conversation"),
    false,
  );
  assert.equal(shouldCheckCorrection("Hallo", "free_conversation"), false);
  assert.equal(shouldCheckCorrection("Hallo", "pronunciation_drill"), true);
});
