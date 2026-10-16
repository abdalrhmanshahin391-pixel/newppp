import assert from "node:assert/strict";
import test from "node:test";
import { readExplanation, writeExplanation } from "./phrase-cache.ts";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const sample = {
  lang: "de" as const,
  translation_ar: "صباح الخير",
  pronunciation_ar: "غوتن مورغن",
  tip_ar: "",
};

test("an explanation is stored once and found again however the phrase is written", () => {
  const storage = fakeStorage();
  writeExplanation("Guten Morgen", sample, storage);
  assert.deepEqual(readExplanation(" “guten  morgen”. ", storage), sample);
  assert.equal(readExplanation("Gute Nacht", storage), null);
});

test("the oldest entries are dropped past the cap", () => {
  const storage = fakeStorage();
  for (const word of ["a", "b", "c", "d"]) writeExplanation(word, sample, storage, 3);
  assert.equal(readExplanation("a", storage), null);
  assert.ok(readExplanation("d", storage));
  assert.ok(readExplanation("b", storage));
});

test("broken storage never throws", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("full");
    },
    removeItem: () => undefined,
  };
  assert.equal(readExplanation("x", broken), null);
  assert.doesNotThrow(() => writeExplanation("x", sample, broken));
});

test("a stored value without a translation is ignored", () => {
  const storage = fakeStorage();
  storage.setItem("rita.phrase.v1:x", JSON.stringify({ lang: "de", translation_ar: "" }));
  assert.equal(readExplanation("x", storage), null);
});
