/**
 * Flags for learning languages. A flag is a country's flag (a language is not a country, so the
 * admin picks the country: English can be the UK or the US). Images are self-hosted in
 * public/flags (MIT licence, see LICENSE-flag-icons.txt); a language without one shows its code.
 */

/** Countries with a flag file in public/flags. Add the file and the code to offer a new one. */
export const FLAG_COUNTRIES = [
  "ae",
  "af",
  "am",
  "ar",
  "at",
  "au",
  "az",
  "bd",
  "be",
  "bg",
  "br",
  "ca",
  "ch",
  "cl",
  "cn",
  "co",
  "cz",
  "de",
  "dk",
  "dz",
  "ee",
  "eg",
  "es",
  "et",
  "fi",
  "fr",
  "gb",
  "ge",
  "gr",
  "hk",
  "hr",
  "hu",
  "id",
  "ie",
  "il",
  "in",
  "iq",
  "ir",
  "is",
  "it",
  "jo",
  "jp",
  "ke",
  "kr",
  "lb",
  "lk",
  "lt",
  "lv",
  "ma",
  "my",
  "ng",
  "nl",
  "no",
  "np",
  "nz",
  "pe",
  "ph",
  "pk",
  "pl",
  "pt",
  "ro",
  "ru",
  "sa",
  "se",
  "si",
  "sk",
  "sy",
  "th",
  "tn",
  "tr",
  "tw",
  "tz",
  "ua",
  "us",
  "vn",
  "za",
] as const;

export type FlagCountry = (typeof FLAG_COUNTRIES)[number];

const KNOWN = new Set<string>(FLAG_COUNTRIES);

export function isFlagCountry(value: string | null | undefined): value is FlagCountry {
  return typeof value === "string" && KNOWN.has(value);
}

/** The flag shown when an admin has not chosen a country for a language yet. */
const DEFAULT_COUNTRY_BY_LANGUAGE: Record<string, FlagCountry> = {
  en: "gb",
  de: "de",
  fr: "fr",
  es: "es",
  it: "it",
  pt: "pt",
  nl: "nl",
  sv: "se",
  no: "no",
  da: "dk",
  fi: "fi",
  pl: "pl",
  cs: "cz",
  ro: "ro",
  el: "gr",
  tr: "tr",
  ru: "ru",
  uk: "ua",
  ja: "jp",
  ko: "kr",
  zh: "cn",
  hi: "in",
  id: "id",
  vi: "vn",
  th: "th",
  he: "il",
  fa: "ir",
};

/** The country whose flag represents a language: the admin's choice, else a sensible default. */
export function flagCountryFor(language: {
  code: string;
  flag_country?: string | null;
}): FlagCountry | null {
  if (isFlagCountry(language.flag_country)) return language.flag_country;
  return DEFAULT_COUNTRY_BY_LANGUAGE[language.code.split("-")[0] ?? ""] ?? null;
}

export function flagSrc(country: string | null | undefined): string | null {
  return isFlagCountry(country) ? `/flags/${country}.svg` : null;
}

/** A country's name in the reader's language (Arabic or English), falling back to its code. */
export function countryName(country: string, locale: "en" | "ar"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(country.toUpperCase()) ?? country;
  } catch {
    return country.toUpperCase();
  }
}
