import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceRitaLanguageState,
  inferRitaTranscriptLanguage,
  initialRitaLanguageState,
} from "./rita-language-state.ts";

test("one borrowed-language turn does not switch Rita", () => {
  const initial = initialRitaLanguageState({ language: "ar", dialect: "ar-JO" });
  const once = advanceRitaLanguageState(initial, { language: "en", confidence: 0.9 });
  assert.equal(once.activeLanguage, "ar");
  assert.equal(once.consecutiveEvidence, 1);
  const twice = advanceRitaLanguageState(once, { language: "en", confidence: 0.9 });
  assert.equal(twice.activeLanguage, "en");
});

test("explicit language request switches immediately", () => {
  const initial = initialRitaLanguageState({ language: "ar", dialect: "ar-JO" });
  const next = advanceRitaLanguageState(initial, {
    language: "de",
    dialect: "de-DE",
    confidence: 1,
    explicit: true,
  });
  assert.equal(next.activeLanguage, "de");
  assert.equal(next.source, "explicit");
});

test("the first clear turn initializes an unknown session", () => {
  const initial = initialRitaLanguageState({ language: "automatic" });
  const next = advanceRitaLanguageState(initial, {
    language: "ar",
    dialect: "ar-JO",
    confidence: 0.92,
  });
  assert.equal(next.activeLanguage, "ar");
  assert.equal(next.activeDialect, "ar-JO");
});

test("infers Arabic and German scripts without another model call", () => {
  assert.equal(inferRitaTranscriptLanguage("هسا بدي أتعلم").language, "ar");
  assert.equal(inferRitaTranscriptLanguage("Ich möchte Deutsch lernen").language, "de");
});
