import assert from "node:assert/strict";
import test from "node:test";
import { allSaid, mergeSaid, sameWord, sentenceWords, spokenTokens, wordsSaid } from "./match.ts";
import { pickRound, ROUND_SIZE, SENTENCES } from "./sentences.ts";

const said = (sentence: string, heard: string) => wordsSaid(sentenceWords(sentence), heard);

test("the whole sentence said turns every word black", () => {
  assert.deepEqual(said("I live alone", "I live alone"), [true, true, true]);
  assert.ok(allSaid(said("Actually, I'm fine", "actually I am fine")));
  assert.ok(allSaid(said("May I listen?", "may i listen")));
});

test("only the first words said: they turn black, the rest stay grey", () => {
  assert.deepEqual(said("The battery is dead", "the battery is"), [true, true, true, false]);
  assert.deepEqual(said("Let's play a game", "let's"), [true, false, false, false]);
  assert.deepEqual(said("I like honey", ""), [false, false, false]);
});

test("a word missed in the middle does not stop the end from counting", () => {
  assert.deepEqual(said("The captain is here", "the captain here"), [true, true, false, true]);
});

test("filler before a word is skipped; words out of order do not count", () => {
  assert.ok(allSaid(said("I need change", "uh I need um change")));
  assert.ok(!allSaid(said("Be kind", "kind be")));
});

test("contractions, numbers and sound-alike words count either way", () => {
  assert.deepEqual(spokenTokens("I'm here, it's 10"), ["i", "am", "here", "it", "is", "ten"]);
  assert.ok(allSaid(said("I'm here", "I am hear")));
  assert.ok(allSaid(said("I don't understand", "I do not understand")));
  assert.ok(allSaid(said("I agree with you", "I agree with you")));
  assert.ok(sameWord("two", "too"));
});

test("near spellings count only for longer words", () => {
  assert.ok(sameWord("delicious", "delicous"));
  assert.ok(sameWord("listen", "listn"));
  assert.ok(!sameWord("i", "a"));
  assert.ok(!sameWord("cat", "cut"));
  assert.ok(sameWord("games", "game"));
});

test("a word stays black once said, even if the recogniser changes its guess", () => {
  assert.deepEqual(mergeSaid([true, false, false], [false, true, false]), [true, true, false]);
});

test("a round is ten different sentences, and every sentence can be matched", () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const round = pickRound(ROUND_SIZE, random);
  assert.equal(round.length, 10);
  assert.equal(new Set(round.map((s) => s.en)).size, 10);
  for (const sentence of SENTENCES) {
    assert.ok(sentence.ar.trim(), sentence.en);
    assert.ok(allSaid(said(sentence.en, sentence.en)), sentence.en);
    const count = sentence.en.split(/\s+/).length;
    assert.ok(count >= 2 && count <= 6, sentence.en);
  }
});

// ---- German ----------------------------------------------------------------------------------

const saidDe = (sentence: string, heard: string) =>
  wordsSaid(sentenceWords(sentence, "de"), heard, "de");

test("German: the whole sentence turns black; the first words alone stay partial", () => {
  assert.ok(allSaid(saidDe("Ich lerne Deutsch", "ich lerne deutsch")));
  assert.deepEqual(saidDe("Das Wasser ist kalt", "das wasser"), [true, true, false, false]);
});

test("German: geht's, umlauts written out, numbers and das/dass count", () => {
  assert.ok(allSaid(saidDe("Wie geht's?", "wie geht es")));
  assert.ok(allSaid(saidDe("Ich bin müde", "ich bin muede")));
  assert.ok(allSaid(saidDe("Wir essen um 7", "wir essen um sieben")));
  assert.ok(allSaid(saidDe("Das ist gut", "dass ist gut")));
  assert.ok(allSaid(saidDe("Übung macht den Meister", "übung macht den meister")));
  assert.ok(sameWord("gerne", "gern", "de"));
  assert.ok(!sameWord("ich", "ach", "de"));
});

test("every German sentence can be matched, and has its Arabic meaning", async () => {
  const { SENTENCES_DE, sentencesFor } = await import("./sentences.ts");
  assert.ok(SENTENCES_DE.length >= 70);
  assert.equal(new Set(SENTENCES_DE.map((s) => s.en)).size, SENTENCES_DE.length);
  assert.equal(sentencesFor("de"), SENTENCES_DE);
  for (const sentence of SENTENCES_DE) {
    assert.ok(sentence.ar.trim(), sentence.en);
    assert.ok(allSaid(saidDe(sentence.en, sentence.en)), sentence.en);
    const count = sentence.en.split(/\s+/).length;
    assert.ok(count >= 1 && count <= 6, sentence.en);
  }
});
