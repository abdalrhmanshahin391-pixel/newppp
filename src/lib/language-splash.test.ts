import assert from "node:assert/strict";
import test from "node:test";
import {
  dismissLanguageSplash,
  getSplash,
  resetSplash,
  showLanguageSplash,
  subscribeSplash,
} from "./language-splash.ts";

test("a change shows the splash with where it came from and where it goes", () => {
  resetSplash();
  showLanguageSplash("en", "de");
  assert.deepEqual({ from: getSplash()?.from, to: getSplash()?.to }, { from: "en", to: "de" });
});

test("the first choice has no language to come from", () => {
  resetSplash();
  showLanguageSplash(null, "de");
  assert.equal(getSplash()?.from, null);
});

test("the same language twice, or nothing, shows nothing", () => {
  resetSplash();
  showLanguageSplash("de", "de");
  showLanguageSplash("en", "");
  assert.equal(getSplash(), null);
});

test("a late timer from an earlier splash does not close a newer one", () => {
  resetSplash();
  showLanguageSplash("en", "de");
  const first = getSplash()!.id;
  showLanguageSplash("de", "en");
  dismissLanguageSplash(first);
  assert.equal(getSplash()?.to, "en");
  dismissLanguageSplash(getSplash()!.id);
  assert.equal(getSplash(), null);
});

test("listeners hear every change and can stop listening", () => {
  resetSplash();
  let heard = 0;
  const stop = subscribeSplash(() => (heard += 1));
  showLanguageSplash("en", "de");
  dismissLanguageSplash(getSplash()!.id);
  stop();
  showLanguageSplash("en", "de");
  assert.equal(heard, 2);
});
