import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRitaLearningIntent,
  hasRitaLanguageLearningIntent,
} from "./rita-learning-intent.ts";

test("allows explicit translation and vocabulary requests", () => {
  assert.equal(hasRitaLanguageLearningIntent("What does Guten Morgen mean?"), true);
  assert.equal(hasRitaLanguageLearningIntent("اعطيني خمس كلمات ألماني"), true);
  assert.equal(hasRitaLanguageLearningIntent("Save these phrases to my flashcards"), true);
  assert.equal(classifyRitaLearningIntent("ترجم هاي الجملة"), "translation");
  assert.equal(classifyRitaLearningIntent("شو معنى Guten Morgen؟"), "word_meaning");
  assert.equal(classifyRitaLearningIntent("اعطيني خمس كلمات ألماني"), "language_word_list");
  assert.equal(classifyRitaLearningIntent("Always put these in German Lab"), "explicit_save");
});

test("does not turn ordinary knowledge questions into vocabulary cards", () => {
  assert.equal(hasRitaLanguageLearningIntent("Tell me about the Mongol war"), false);
  assert.equal(hasRitaLanguageLearningIntent("شو صار بحرب المغول؟"), false);
  assert.equal(hasRitaLanguageLearningIntent("Why is the sky blue?"), false);
  assert.equal(hasRitaLanguageLearningIntent("Explain the term photosynthesis"), false);
  assert.equal(hasRitaLanguageLearningIntent("Guten Morgen, how are you?"), false);
});

test("understands the everyday ways of asking what a word means", () => {
  for (const text of [
    "شو يعني Haus؟",
    "يعني شو Guten Morgen",
    'إيه بدي أسألك شو معنى "صباح الخير" بالألماني؟',
    "what's the meaning of nevertheless",
    "was heißt Danke",
  ]) {
    assert.equal(hasRitaLanguageLearningIntent(text), true, text);
  }
  for (const text of [
    "كيف بنحكيها بالإنجليزي؟",
    "كيف بقول صباح الخير بالألماني",
    "شو بنقول للمعلم بالإنجليزي",
    "what is thank you in German",
    "wie heißt Haus auf Englisch",
  ]) {
    assert.equal(classifyRitaLearningIntent(text), "translation", text);
  }
});

test("does not mistake knowledge questions for vocabulary", () => {
  for (const text of [
    "شو يعني الحرب العالمية؟ احكيلي عن الثورة الفرنسية",
    "شو بتعرفي عن الثورة الفرنسية؟",
    "what is the capital of France",
  ]) {
    assert.notEqual(classifyRitaLearningIntent(text), "translation", text);
  }
});
