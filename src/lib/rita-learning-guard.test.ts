import assert from "node:assert/strict";
import test from "node:test";
import { appearsIn, cleanTerm, guardItems } from "./rita-learning-guard.ts";

const guten = {
  term: "Guten Morgen",
  meaning: "صباح الخير",
  language: "de",
  kind: "sentence",
  article: null,
  plural: null,
};

test("markdown and quotes never reach the list", () => {
  assert.equal(cleanTerm("**Guten Morgen**"), "Guten Morgen");
  assert.equal(cleanTerm(" “Good morning”. "), "Good morning");
  assert.equal(cleanTerm("(das Haus)"), "das Haus");
  assert.equal(cleanTerm(undefined), "");
});

test("a word is found with or without its article and in any spelling of the letters", () => {
  assert.equal(appearsIn("das Haus", "ما معنى Haus؟"), true);
  assert.equal(appearsIn("Straße", "what is strasse"), true);
  assert.equal(appearsIn("إيمان", "ما معنى ايمان"), true);
  assert.equal(appearsIn("Guten Morgen", "صباح الخير بالألماني هو **Guten Morgen**"), true);
  assert.equal(appearsIn("Gute Nacht", "صباح الخير بالألماني هو Guten Morgen"), false);
  assert.equal(appearsIn("", "anything"), false);
});

test("a word that is not in the exchange is dropped", () => {
  const items = guardItems(
    [guten, { ...guten, term: "Auf Wiedersehen", meaning: "مع السلامة" }],
    'شو معنى "صباح الخير" بالألماني؟',
    "صباح الخير بالألماني هو **Guten Morgen**.",
  );
  assert.deepEqual(
    items.map((item) => item.term),
    ["Guten Morgen"],
  );
});

test("one question gives at most three words, without duplicates", () => {
  const many = ["eins", "zwei", "drei", "vier", "eins"]
    .map((term) => ({
      ...guten,
      term,
      meaning: term,
      kind: "word",
    }))
    .map((item, index) => ({ ...item, meaning: `m${index}` }));
  const items = guardItems(many, "eins zwei drei vier", "eins zwei drei vier");
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((item) => item.term),
    ["eins", "zwei", "drei"],
  );
});

test("invalid or lazy proposals are rejected", () => {
  const spoken = "Haus";
  assert.deepEqual(guardItems("nope", spoken, spoken), []);
  assert.deepEqual(guardItems([null, 3, {}], spoken, spoken), []);
  assert.deepEqual(
    guardItems([{ term: "Haus", meaning: "Haus", language: "de" }], spoken, spoken),
    [],
  );
  assert.deepEqual(
    guardItems([{ term: "Haus", meaning: "بيت", language: "german" }], spoken, spoken),
    [],
  );
  assert.deepEqual(guardItems([{ term: "Haus", meaning: "", language: "de" }], spoken, spoken), []);
});

test("German nouns keep their article only when it is valid", () => {
  const [house] = guardItems(
    [
      {
        term: "das Haus",
        meaning: "البيت",
        language: "de",
        kind: "word",
        article: "das",
        plural: "Häuser",
      },
    ],
    "ما معنى das Haus",
    "das Haus يعني البيت",
  );
  assert.equal(house.article, "das");
  assert.equal(house.term, "Haus");
  assert.equal(house.plural, "Häuser");
  const [english] = guardItems(
    [{ term: "house", meaning: "بيت", language: "en", article: "das" }],
    "meaning of house",
    "house means بيت",
  );
  assert.equal(english.article, null);
});
