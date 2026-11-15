// A quick guess at whether a piece of text is English or German, for the admin's checks (a lesson
// book whose language does not match its pages). Pure: no DOM. It counts very common short words
// and German letters; it never claims a language without a clear lead.

export type TextLanguageGuess = {
  /** "en" or "de" when one clearly leads, else null (too little text, or mixed). */
  code: "en" | "de" | null;
  /** How many marker words of each language were found. */
  en: number;
  de: number;
};

// Words that are common in one language and (almost) never appear as words in the other.
const EN = new Set([
  "the",
  "and",
  "of",
  "to",
  "is",
  "are",
  "was",
  "were",
  "you",
  "with",
  "this",
  "that",
  "have",
  "has",
  "for",
  "what",
  "which",
  "they",
  "she",
  "it's",
  "i'm",
  "don't",
  "there",
  "their",
  "would",
  "could",
  "should",
  "been",
  "from",
  "your",
]);
const DE = new Set([
  "der",
  "die",
  "das",
  "und",
  "ist",
  "nicht",
  "ich",
  "du",
  "sie",
  "wir",
  "ihr",
  "ein",
  "eine",
  "einen",
  "dem",
  "den",
  "des",
  "mit",
  "auf",
  "für",
  "von",
  "zu",
  "sind",
  "bin",
  "bist",
  "haben",
  "hat",
  "auch",
  "aber",
  "wie",
  "was",
  "oder",
  "noch",
  "sehr",
  "kein",
  "keine",
  "heute",
  "danke",
  "bitte",
]);
// "was" is a word in both; it counts for neither.
EN.delete("was");
DE.delete("was");

const GERMAN_LETTERS = /[äöüß]/gi;

/** Guesses the language of a text from its common words (needs a few dozen words to decide). */
export function guessTextLanguage(text: string): TextLanguageGuess {
  const words = text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^\p{L}']+/u)
    .filter(Boolean);
  let en = 0;
  let de = 0;
  for (const word of words) {
    if (EN.has(word)) en += 1;
    else if (DE.has(word)) de += 1;
  }
  // Umlauts and ß are a strong German sign (worth half a marker word each).
  de += Math.floor((text.match(GERMAN_LETTERS)?.length ?? 0) / 2);
  const total = en + de;
  if (total < 8) return { code: null, en, de };
  if (en >= de * 2) return { code: "en", en, de };
  if (de >= en * 2) return { code: "de", en, de };
  return { code: null, en, de };
}

/** True when the guess clearly says another language than `chosen` (only "en"/"de" are judged). */
export function languageMismatch(chosen: string, guess: TextLanguageGuess): boolean {
  if (!guess.code) return false;
  if (chosen !== "en" && chosen !== "de") return false;
  return guess.code !== chosen;
}
