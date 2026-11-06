import assert from "node:assert/strict";
import test from "node:test";
import { getPhraseAudio, readExplanation, writeExplanation } from "./phrase-cache.ts";

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

test("the same word keeps separate meanings in separate sentences and never uses a dictionary entry", () => {
  const storage = fakeStorage();
  const river = { ...sample, lang: "en" as const, translation_ar: "ضفة" };
  const money = { ...sample, lang: "en" as const, translation_ar: "بنك" };
  writeExplanation("bank", sample, storage);
  assert.equal(readExplanation("bank", storage, "We sat on the river bank."), null);
  writeExplanation("bank", river, storage, 300, "We sat on the river bank.");
  writeExplanation("bank", money, storage, 300, "She went to the bank.");
  assert.deepEqual(readExplanation("BANK", storage, "We sat on the river bank."), river);
  assert.deepEqual(readExplanation("bank", storage, "She went to the bank."), money);
  assert.deepEqual(readExplanation("bank", storage), sample);
});

test("blocked browser Cache Storage still fetches playable audio", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      open: async () => {
        throw new Error("Storage blocked");
      },
    },
  });
  try {
    let fetched = 0;
    const url = await getPhraseAudio("cache fallback test", "en", "fast", async () => {
      fetched += 1;
      return new Blob(["fixture"], { type: "audio/mpeg" });
    });
    assert.equal(fetched, 1);
    assert.ok(url?.startsWith("blob:"));
  } finally {
    if (original) Object.defineProperty(globalThis, "caches", original);
    else Reflect.deleteProperty(globalThis, "caches");
  }
});
