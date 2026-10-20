import assert from "node:assert/strict";
import test from "node:test";
import { resolveTargetLanguage, type RegistryLanguage } from "./rita-target-language.ts";

const registry: RegistryLanguage[] = [
  { code: "en", name_en: "English", speech_code: "en", voice_enabled: true, enabled: true },
  { code: "de", name_en: "German", speech_code: "de", voice_enabled: true, enabled: true },
  { code: "fr", name_en: "French", speech_code: "fr", voice_enabled: false, enabled: true },
  { code: "es", name_en: "Spanish", speech_code: "es", voice_enabled: true, enabled: false },
];

test("a conversation keeps its own language, whatever the learner is on now", () => {
  const target = resolveTargetLanguage({
    conversationLanguage: "de",
    profileLanguage: "en",
    registry,
  });
  assert.deepEqual(target, { code: "de", name: "German", speechCode: "de", voiceEnabled: true });
});

test("without a conversation language the learner's active language is used", () => {
  assert.equal(resolveTargetLanguage({ profileLanguage: "en", registry })?.code, "en");
  assert.equal(
    resolveTargetLanguage({ conversationLanguage: null, profileLanguage: "de", registry })?.code,
    "de",
  );
});

test("no language, or one that is not in the list, means no target (the old behaviour)", () => {
  assert.equal(resolveTargetLanguage({ registry }), null);
  assert.equal(resolveTargetLanguage({ profileLanguage: "xx", registry }), null);
  assert.equal(resolveTargetLanguage({ profileLanguage: "en", registry: [] }), null);
});

test("voice is offered only for enabled languages with voice switched on", () => {
  assert.equal(resolveTargetLanguage({ profileLanguage: "fr", registry })?.voiceEnabled, false);
  assert.equal(resolveTargetLanguage({ profileLanguage: "es", registry })?.voiceEnabled, false);
  assert.equal(resolveTargetLanguage({ profileLanguage: "de", registry })?.voiceEnabled, true);
});

test("the speech code falls back to the code", () => {
  const rows = [{ ...registry[0]!, code: "pt-br", speech_code: "" }];
  assert.equal(
    resolveTargetLanguage({ profileLanguage: "pt-br", registry: rows })?.speechCode,
    "pt-br",
  );
});
