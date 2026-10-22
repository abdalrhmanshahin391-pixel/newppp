import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPLANATION_STORAGE_KEY,
  explanationHint,
  explanationLabel,
  nextExplanationIndex,
  pickExplanation,
  parseExplanationLanguage,
  readExplanationLanguage,
  settingsMessage,
  writeExplanationLanguage,
} from "./explanation-language.ts";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

test("only the three offered values are accepted, anything else means automatic", () => {
  for (const ok of ["automatic", "ar", "en"]) assert.equal(parseExplanationLanguage(ok), ok);
  for (const bad of ["de", "fr", "", "AR", null, undefined, 3, "{}", '["ar"]']) {
    assert.equal(parseExplanationLanguage(bad), "automatic", String(bad));
  }
});

test("the value the cloud sync stores (JSON with quotes) and a plain value both read", () => {
  assert.equal(parseExplanationLanguage('"ar"'), "ar");
  assert.equal(parseExplanationLanguage("ar"), "ar");
});

test("writing keeps the key a synced, shared rita_ key and reads back", () => {
  const store = fakeStorage();
  writeExplanationLanguage(store, "en");
  assert.equal(EXPLANATION_STORAGE_KEY.startsWith("rita_"), true);
  assert.equal(store.data.get(EXPLANATION_STORAGE_KEY), '"en"');
  assert.equal(readExplanationLanguage(store), "en");
});

test("no storage, or a storage that throws, falls back to automatic", () => {
  assert.equal(readExplanationLanguage(null), "automatic");
  assert.equal(
    readExplanationLanguage({
      getItem: () => {
        throw new Error("blocked");
      },
    }),
    "automatic",
  );
  assert.doesNotThrow(() =>
    writeExplanationLanguage(
      {
        setItem: () => {
          throw new Error("full");
        },
      },
      "ar",
    ),
  );
  assert.doesNotThrow(() => writeExplanationLanguage(null, "ar"));
});

test("the live message carries the choice for the worker", () => {
  assert.deepEqual(settingsMessage("ar"), {
    type: "rita-settings",
    data: { explanationLanguage: "ar" },
  });
});

test("labels name each language in itself; the automatic one follows the page language", () => {
  assert.equal(explanationLabel("ar", "en"), "العربية");
  assert.equal(explanationLabel("en", "ar"), "English");
  assert.equal(explanationLabel("automatic", "en"), "Like I speak");
  assert.equal(explanationLabel("automatic", "ar"), "حسب كلامي");
});

test("the hint says what changes, and from when once a conversation is running", () => {
  assert.match(explanationHint("en", "en", false), /^Rita explains in English\./);
  assert.match(explanationHint("en", "en", true), /from her next answer/);
  assert.match(explanationHint("ar", "ar", true), /من ردّها الجاي/);
  assert.match(explanationHint("automatic", "en", false), /language you speak/);
});

test("arrow keys wrap around, and left/right swap on a right-to-left page", () => {
  assert.equal(nextExplanationIndex(0, "ArrowRight", false), 1);
  assert.equal(nextExplanationIndex(0, "ArrowLeft", false), 2);
  assert.equal(nextExplanationIndex(2, "ArrowDown", false), 0);
  assert.equal(nextExplanationIndex(0, "ArrowRight", true), 2);
  assert.equal(nextExplanationIndex(0, "ArrowLeft", true), 1);
  assert.equal(nextExplanationIndex(1, "Enter", false), null);
});

test("a key the account sync has cleared for a moment does not flip the choice back", () => {
  const shown = { value: "en" as const, account: "u1" };
  assert.equal(pickExplanation(null, shown, "u1"), "en");
  assert.equal(pickExplanation('"ar"', shown, "u1"), "ar", "a stored value always wins");
});

test("a missing key means automatic when nothing was shown yet or the account changed", () => {
  assert.equal(pickExplanation(null, null, "u1"), "automatic");
  assert.equal(pickExplanation(null, { value: "en", account: "u1" }, "u2"), "automatic");
  assert.equal(pickExplanation(null, { value: "en", account: "u1" }, null), "automatic");
});
