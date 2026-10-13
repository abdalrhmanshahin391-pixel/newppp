import { detectLatinLang, spokenTextOf } from "./rita-message.ts";

/** One short correction: what the learner said, the better phrase, and why. */
export type Correction = {
  said: string;
  better: string;
  why: string;
  /** What the better phrase means, in the learner's own language. */
  translation: string;
  language: "de" | "en";
};

/** A correction the lesson is tracking, with the learner's retries. */
export type CorrectionRecord = Correction & {
  id: string;
  attempts: number;
  fixed: boolean;
};

const clean = (value: unknown, max: number) =>
  spokenTextOf(String(value ?? ""))
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, max);

export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Accept a model answer only if it is a real, different, well-formed correction. */
export function sanitizeCorrection(value: unknown): Correction | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const said = clean(raw.said, 160);
  const better = clean(raw.better, 200);
  if (!said || !better) return null;
  if (normalizeForMatch(said) === normalizeForMatch(better)) return null;
  const language =
    raw.language === "en" ? "en" : raw.language === "de" ? "de" : detectLatinLang(better);
  return {
    said,
    better,
    why: clean(raw.why, 220),
    translation: clean(raw.translation, 200),
    language,
  };
}

/** Did the learner's next turn contain the corrected phrase? Tolerates small extra words. */
export function matchesCorrection(spoken: string, better: string): boolean {
  const wanted = normalizeForMatch(better).split(" ").filter(Boolean);
  const heard = normalizeForMatch(spoken).split(" ").filter(Boolean);
  if (!wanted.length || !heard.length) return false;
  const heardSet = new Set(heard);
  const hits = wanted.filter((word) => heardSet.has(word)).length;
  const recall = hits / wanted.length;
  const precision = hits / heard.length;
  return (wanted.length <= 3 ? recall === 1 : recall >= 0.8) && precision >= 0.5;
}

const ARABIC_WORDS = /\p{Script=Arabic}+/gu;
const LATIN_WORDS = /\p{Script=Latin}+/gu;

/**
 * A cheap gate before asking a model for a correction. The learner must have
 * attempted a German or English sentence (mostly Latin-script words). Questions
 * written mostly in Arabic ("how do I say good morning in German") are not attempts.
 */
export function shouldCheckCorrection(spoken: string, mode: string): boolean {
  const latin = spoken.match(LATIN_WORDS)?.length ?? 0;
  const arabic = spoken.match(ARABIC_WORDS)?.length ?? 0;
  if (latin > 40) return false;
  if (latin < (mode === "pronunciation_drill" ? 1 : 2)) return false;
  return latin >= arabic;
}
