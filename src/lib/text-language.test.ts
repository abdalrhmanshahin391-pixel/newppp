import assert from "node:assert/strict";
import test from "node:test";
import { guessTextLanguage, languageMismatch } from "./text-language.ts";

const GERMAN =
  "Lektion 3: Der Artikel. Im Deutschen hat jedes Nomen einen Artikel: der, die oder das. Ich bin heute müde, aber wir lernen noch. Das ist nicht schwer, und du kannst es auch. Die Übung ist für dich.";
const ENGLISH =
  "Unit 3: The present simple. We use the present simple for habits and facts. She works in a bank and they live in London. This is the rule that you should learn, and it's easy.";

test("an English page is English, a German page is German", () => {
  assert.equal(guessTextLanguage(ENGLISH).code, "en");
  assert.equal(guessTextLanguage(GERMAN).code, "de");
});

test("a grammar book about German written partly in English still reads as German when German leads", () => {
  const mixed = `${GERMAN} ${GERMAN} Note: the article changes.`;
  assert.equal(guessTextLanguage(mixed).code, "de");
});

test("too little text, or an even mix, decides nothing", () => {
  assert.equal(guessTextLanguage("Hallo").code, null);
  assert.equal(guessTextLanguage("").code, null);
  assert.equal(guessTextLanguage(`${ENGLISH} ${GERMAN}`).code, null);
});

test("a mismatch is only flagged for English and German with a clear guess", () => {
  assert.ok(languageMismatch("en", guessTextLanguage(GERMAN)));
  assert.ok(!languageMismatch("de", guessTextLanguage(GERMAN)));
  assert.ok(!languageMismatch("fr", guessTextLanguage(GERMAN)));
  assert.ok(!languageMismatch("en", guessTextLanguage("Hallo")));
});
