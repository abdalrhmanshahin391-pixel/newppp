import assert from "node:assert/strict";
import test from "node:test";
import { skipsFiller } from "./short-turn.ts";

test("commands, thinking sounds and one-word answers get no filler", () => {
  for (const text of [
    "خلص",
    "خلص، خلص.",
    "وقفي",
    "أمم...",
    "إيه.",
    "نوب",
    "Stop!",
    "um",
    "مش",
    "",
  ]) {
    assert.equal(skipsFiller(text), true, text);
  }
});

test("a real question or sentence still gets one", () => {
  for (const text of [
    "شو بتعرفي عن الثورة الفرنسية؟",
    "كيف بنحكيها بالإنجليزي؟",
    "What does Guten Morgen mean?",
    "بدي أتعلم الألماني",
  ]) {
    assert.equal(skipsFiller(text), false, text);
  }
});

test("a short real question is not mistaken for a command", () => {
  assert.equal(skipsFiller("شو يعني هاي"), false);
  assert.equal(skipsFiller("Was ist das?"), false);
});
