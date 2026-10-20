import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILT_IN_LANGUAGES,
  isLanguageKey,
  languageFilter,
  legacyKeysToMove,
  moveLegacyKeys,
  resolveActiveLanguage,
  scopedKey,
  showsGermanLab,
  sortLanguages,
  splitScopedKey,
  validateNewLanguage,
} from "./learning-language.ts";

test("built-in languages are English and German, enabled, with voice on", () => {
  assert.deepEqual(
    BUILT_IN_LANGUAGES.map((l) => [l.code, l.enabled, l.voice_enabled]),
    [
      ["en", true, true],
      ["de", true, true],
    ],
  );
});

test("a scoped key keeps the rita_ prefix and round-trips", () => {
  const key = scopedKey("rita_study_subjects", "de");
  assert.equal(key, "rita_@de_study_subjects");
  assert.ok(key.startsWith("rita_"));
  assert.deepEqual(splitScopedKey(key), { base: "rita_study_subjects", language: "de" });
  assert.equal(scopedKey("rita_fc_verbs_a1", "pt-br"), "rita_@pt-br_fc_verbs_a1");
  assert.deepEqual(splitScopedKey("rita_@pt-br_fc_verbs_a1"), {
    base: "rita_fc_verbs_a1",
    language: "pt-br",
  });
});

test("keys from before languages are never read as scoped, whatever the subject is called", () => {
  // Subject names become part of the key; none of these can look like a scoped key.
  for (const key of ["rita_fc_de_verbs", "rita_q_mem_a", "rita_mem_fc_x", "rita_study_subjects"]) {
    assert.equal(splitScopedKey(key).language, null, key);
  }
});

test("no language leaves the key as it was; non-rita keys are never rewritten", () => {
  assert.equal(scopedKey("rita_study_subjects", null), "rita_study_subjects");
  assert.equal(scopedKey("other_key", "de"), "other_key");
});

test("only the study kit is per language; goals, to-do and sound settings are shared", () => {
  for (const key of [
    "rita_study_subjects",
    "rita_question_subjects",
    "rita_memory_subjects",
    "rita_fc_a_b",
    "rita_q_a_b",
    "rita_mem_a_b",
  ]) {
    assert.equal(isLanguageKey(key), true, key);
  }
  for (const key of [
    "rita_todo_tasks",
    "rita_todo_goal",
    "rita_study_muted",
    "rita_mem_muted",
    "rita_fc_creator_mode",
    "rita_demo_seeded_v2",
  ]) {
    assert.equal(isLanguageKey(key), false, key);
  }
});

test("legacy keys to move: unscoped study-kit keys only, scoped copies left alone", () => {
  const existing = [
    "rita_study_subjects",
    "rita_fc_verbs_a1",
    "rita_@de_study_subjects",
    "rita_@de_fc_verbs_a1",
    "rita_todo_tasks",
    "unrelated",
  ];
  assert.deepEqual(legacyKeysToMove(existing), ["rita_study_subjects", "rita_fc_verbs_a1"]);
});

test("active language: chosen and enabled, otherwise none", () => {
  const list = [...BUILT_IN_LANGUAGES, { ...BUILT_IN_LANGUAGES[0], code: "fr", enabled: false }];
  assert.equal(resolveActiveLanguage("de", list), "de");
  assert.equal(resolveActiveLanguage("fr", list), null, "disabled since it was chosen");
  assert.equal(resolveActiveLanguage("xx", list), null, "unknown");
  assert.equal(resolveActiveLanguage(null, list), null);
  assert.equal(resolveActiveLanguage(undefined, list), null);
});

test("row filter: the legacy language also gets rows with no language", () => {
  assert.equal(languageFilter("de", "de"), "language.eq.de,language.is.null");
  assert.equal(languageFilter("en", "de"), "language.eq.en");
  assert.equal(languageFilter("en", null), "language.eq.en");
  assert.equal(
    languageFilter("de", "de", "learning_language"),
    "learning_language.eq.de,learning_language.is.null",
  );
});

test("languages sort by their order, then by name", () => {
  const list = [
    { sort: 20, name_en: "German" },
    { sort: 10, name_en: "English" },
    { sort: 20, name_en: "Arabic" },
  ];
  assert.deepEqual(
    sortLanguages(list).map((l) => l.name_en),
    ["English", "Arabic", "German"],
  );
});

test("a new language: code is normalised and checked, names are required", () => {
  const ok = validateNewLanguage(
    {
      code: " FR ",
      name_en: "French",
      name_native: "Français",
      name_ar: "الفرنسية",
      direction: "ltr",
    },
    ["en", "de"],
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.code, "fr");
    assert.equal(ok.value.speech_code, "fr");
  }
  const bad = (code: string, existing: string[] = ["en", "de"]) =>
    validateNewLanguage(
      { code, name_en: "X", name_native: "X", name_ar: "X", direction: "ltr" },
      existing,
    );
  assert.equal(bad("french").ok, false);
  assert.equal(bad("f").ok, false);
  assert.equal(bad("DE").ok, false, "already exists after normalising");
  assert.equal(
    validateNewLanguage(
      { code: "es", name_en: "Spanish", name_native: "", name_ar: "الإسبانية", direction: "ltr" },
      [],
    ).ok,
    false,
  );
  const rtl = validateNewLanguage(
    {
      code: "fa",
      name_en: "Persian",
      name_native: "فارسی",
      name_ar: "الفارسية",
      direction: "rtl",
      speech_code: "FA",
    },
    [],
  );
  assert.equal(rtl.ok && rtl.value.speech_code, "fa");
});

function fakeStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

test("moving legacy keys copies them under the language, removes the old ones, leaves the rest", () => {
  const store = fakeStorage({
    rita_study_subjects: '[{"name":"A","subs":[]}]',
    rita_fc_a_b: "[1]",
    rita_todo_tasks: "[]",
    rita_study_muted: "1",
    unrelated: "x",
  });
  assert.equal(moveLegacyKeys(store, "de"), 2);
  assert.equal(store.getItem("rita_@de_study_subjects"), '[{"name":"A","subs":[]}]');
  assert.equal(store.getItem("rita_@de_fc_a_b"), "[1]");
  assert.equal(store.getItem("rita_study_subjects"), null);
  assert.equal(store.getItem("rita_fc_a_b"), null);
  for (const kept of ["rita_todo_tasks", "rita_study_muted", "unrelated"]) {
    assert.notEqual(store.getItem(kept), null, kept);
  }
});

test("moving legacy keys never overwrites a language's own copy and can be repeated", () => {
  const store = fakeStorage({
    rita_study_subjects: "old",
    "rita_@de_study_subjects": "already here",
    rita_fc_a_b: "cards",
  });
  assert.equal(moveLegacyKeys(store, "de"), 1);
  assert.equal(store.getItem("rita_@de_study_subjects"), "already here");
  assert.equal(store.getItem("rita_study_subjects"), "old", "kept: nothing is lost");
  assert.equal(moveLegacyKeys(store, "de"), 0, "second run changes nothing");
  assert.equal(store.getItem("rita_@de_fc_a_b"), "cards");
});

test("a second language never receives the first language's keys", () => {
  const store = fakeStorage({ rita_fc_a_b: "cards" });
  moveLegacyKeys(store, "de");
  assert.equal(moveLegacyKeys(store, "en"), 0);
  assert.equal(store.getItem("rita_@en_fc_a_b"), null);
});

test("the German Lab shows for German learners and for learners who have not chosen", () => {
  assert.equal(showsGermanLab("de"), true);
  assert.equal(showsGermanLab(null), true);
  assert.equal(showsGermanLab(undefined), true);
  assert.equal(showsGermanLab("en"), false);
  assert.equal(showsGermanLab("fr"), false);
});
