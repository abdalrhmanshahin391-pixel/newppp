/**
 * Learning languages: what a learner is learning (English, German, ...), not the language the
 * site is shown in. Each language is a separate space for flashcards, lessons and
 * conversations. The list lives in the `learning_languages` table so an admin can add one
 * without a deploy; the two built-in entries are used until the list has loaded and on a
 * database that has not been migrated yet.
 */

export type LearningLanguage = {
  code: string;
  name_en: string;
  name_native: string;
  name_ar: string;
  direction: "ltr" | "rtl";
  speech_code: string;
  voice_enabled: boolean;
  enabled: boolean;
  sort: number;
};

export const BUILT_IN_LANGUAGES: LearningLanguage[] = [
  {
    code: "en",
    name_en: "English",
    name_native: "English",
    name_ar: "الإنجليزية",
    direction: "ltr",
    speech_code: "en",
    voice_enabled: true,
    enabled: true,
    sort: 10,
  },
  {
    code: "de",
    name_en: "German",
    name_native: "Deutsch",
    name_ar: "الألمانية",
    direction: "ltr",
    speech_code: "de",
    voice_enabled: true,
    enabled: true,
    sort: 20,
  },
];

/** Same rule the database enforces: ISO-style, lower case, e.g. "fr", "pt-br". */
export const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

export function normalizeLanguageCode(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidLanguageCode(code: string): boolean {
  return LANGUAGE_CODE_PATTERN.test(code);
}

export function sortLanguages<T extends Pick<LearningLanguage, "sort" | "name_en">>(
  list: readonly T[],
): T[] {
  return [...list].sort((a, b) => a.sort - b.sort || a.name_en.localeCompare(b.name_en));
}

export function languageLabel(language: LearningLanguage, ui: "en" | "ar"): string {
  return ui === "ar" ? language.name_ar : language.name_en;
}

/**
 * The learner's active language, or null when none has been chosen (or the chosen one has been
 * disabled since). Never returns a code the learner could not pick today.
 */
export function resolveActiveLanguage(
  chosen: string | null | undefined,
  languages: readonly LearningLanguage[],
): string | null {
  if (!chosen) return null;
  return languages.some((l) => l.code === chosen && l.enabled) ? chosen : null;
}

/* ---------------------------------------------------------------------------------------- *
 * Device storage. The study kit lives in `rita_*` localStorage keys that are mirrored to the
 * account. A language's copy of a key is `rita_@<code>_<rest>`: it still starts with `rita_`
 * (so it syncs and is cleared on sign-out) and can never equal a key the app made before
 * languages existed, because none of those has an "@" right after the prefix.
 * ---------------------------------------------------------------------------------------- */

const KEY_PREFIX = "rita_";
const SCOPED = /^rita_@([a-z0-9-]+)_(.+)$/;

export function scopedKey(base: string, language: string | null | undefined): string {
  if (!language || !base.startsWith(KEY_PREFIX)) return base;
  return `${KEY_PREFIX}@${language}_${base.slice(KEY_PREFIX.length)}`;
}

/** The language and original key of a scoped key; language is null for a key from before languages. */
export function splitScopedKey(key: string): { base: string; language: string | null } {
  const match = SCOPED.exec(key);
  if (!match) return { base: key, language: null };
  return { base: `${KEY_PREFIX}${match[2]}`, language: match[1] };
}

/**
 * Keys that belong to one language's study kit (not to the account as a whole), so they get a
 * copy per language. Everything else under `rita_` (goals, to-do board, sound settings) is shared.
 */
const LANGUAGE_KEY_PREFIXES = [
  "rita_study_subjects",
  "rita_question_subjects",
  "rita_memory_subjects",
  "rita_fc_",
  "rita_q_",
  "rita_mem_",
];

/** Device settings that happen to share a prefix with the kit's keys. */
const SHARED_KEYS = new Set(["rita_study_muted", "rita_mem_muted", "rita_fc_creator_mode"]);

export function isLanguageKey(key: string): boolean {
  if (SHARED_KEYS.has(key)) return false;
  return LANGUAGE_KEY_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * Which stored keys still use the pre-language names and so belong to the learner's legacy
 * language. `existing` is every key on the device.
 */
export function legacyKeysToMove(existing: readonly string[]): string[] {
  return existing.filter((key) => isLanguageKey(key) && splitScopedKey(key).language === null);
}

/* ---------------------------------------------------------------------------------------- *
 * Database rows. A NULL language on a learner's own row means "made before languages
 * existed" and counts as the learner's legacy language.
 * ---------------------------------------------------------------------------------------- */

/**
 * PostgREST `or()` expression that keeps a column's rows for `active`, plus the rows with no
 * language when `active` is the learner's legacy language. Pass the result to `.or(...)`.
 */
export function languageFilter(
  active: string,
  legacy: string | null | undefined,
  column = "language",
): string {
  return active === legacy ? `${column}.eq.${active},${column}.is.null` : `${column}.eq.${active}`;
}

/** The language to stamp on a new row: always the active one, never left empty. */
export function languageForNewRow(active: string | null | undefined): string | null {
  return active ?? null;
}

/* ---------------------------------------------------------------------------------------- *
 * Admin form.
 * ---------------------------------------------------------------------------------------- */

export type NewLanguageInput = {
  code: string;
  name_en: string;
  name_native: string;
  name_ar: string;
  direction: "ltr" | "rtl";
  speech_code?: string;
};

export type LanguageValidation =
  { ok: true; value: Required<NewLanguageInput> } | { ok: false; error: string };

export function validateNewLanguage(
  input: NewLanguageInput,
  existingCodes: readonly string[],
): LanguageValidation {
  const code = normalizeLanguageCode(input.code);
  if (!isValidLanguageCode(code)) {
    return { ok: false, error: "Use the short language code, like fr, es or pt-br." };
  }
  if (existingCodes.includes(code)) {
    return { ok: false, error: `The code “${code}” is already in the list.` };
  }
  const name_en = input.name_en.trim();
  const name_native = input.name_native.trim();
  const name_ar = input.name_ar.trim();
  if (!name_en || !name_native || !name_ar) {
    return {
      ok: false,
      error: "Fill in the name in English, in Arabic and in the language itself.",
    };
  }
  if ([name_en, name_native, name_ar].some((n) => n.length > 60)) {
    return { ok: false, error: "Names can be at most 60 characters." };
  }
  const speech = normalizeLanguageCode(input.speech_code ?? "") || code;
  if (speech.length < 2 || speech.length > 12) {
    return { ok: false, error: "The speech code must be 2 to 12 characters." };
  }
  return {
    ok: true,
    value: { code, name_en, name_native, name_ar, direction: input.direction, speech_code: speech },
  };
}
