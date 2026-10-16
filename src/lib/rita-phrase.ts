// Shared, dependency-free rules for the "tap a word" window: how a phrase is
// normalised for caching, what the explanation looks like, how each pronunciation
// style is spoken, and a small per-user request limiter. Used by both the
// server and the browser, and tested on their own.

export type PhraseLang = "de" | "en" | "other";
export type PronounceStyle = "fast" | "slow" | "precise";

export const MAX_PHRASE_CHARS = 120;
export const PRONOUNCE_STYLES: PronounceStyle[] = ["fast", "slow", "precise"];

export type PhraseExplanation = {
  lang: PhraseLang;
  translation_ar: string;
  /** How it sounds, written with Arabic letters. */
  pronunciation_ar: string;
  /** One short line about the sound, or empty. */
  tip_ar: string;
};

/** One key for a phrase however it was cased or spaced. */
export function normalizePhrase(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[“”"]/g, "")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, "")
    .trim()
    .slice(0, MAX_PHRASE_CHARS)
    .toLowerCase();
}

/** The text as it should be spoken and shown (case kept, ends trimmed). */
export function cleanPhrase(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, "")
    .trim()
    .slice(0, MAX_PHRASE_CHARS);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Reads the model's JSON defensively; null when there is no usable translation. */
export function parseExplanation(raw: unknown): PhraseExplanation | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const translation = text(record.translation_ar, 200);
  if (!translation) return null;
  const lang: PhraseLang = record.lang === "de" || record.lang === "en" ? record.lang : "other";
  return {
    lang,
    translation_ar: translation,
    pronunciation_ar: text(record.pronunciation_ar, 200),
    tip_ar: text(record.tip_ar, 240),
  };
}

const VOICE: Record<"de" | "en", string> = {
  de: "Speak as a calm native German woman from Germany. Clear standard Hochdeutsch, warm classroom tone, crisp consonants, no English accent.",
  en: "Speak as a calm native English teacher. Clear standard pronunciation, warm classroom tone, crisp consonants.",
};

/** Speed, wording and spoken text for one pronunciation style. */
export function ttsPlan(
  lang: "de" | "en",
  style: PronounceStyle,
  phrase: string,
): { speed: number; instructions: string; input: string } {
  const words = phrase.split(" ").filter(Boolean);
  if (style === "fast") {
    return { speed: 1, instructions: `${VOICE[lang]} Natural everyday speed.`, input: phrase };
  }
  if (style === "slow") {
    return {
      speed: 0.7,
      instructions: `${VOICE[lang]} Speak slowly and very clearly, as when teaching a beginner.`,
      input: phrase,
    };
  }
  return {
    speed: 0.75,
    instructions: `${VOICE[lang]} Pronounce every word separately and precisely, with a short pause between words, stressing every sound clearly.`,
    // Commas make the voice pause between words without reading anything extra.
    input: words.length > 1 ? words.join(", ") : phrase,
  };
}

/** Per-user sliding-window limiter; the caller keeps the map. */
export function allowRequest(
  hits: Map<string, number[]>,
  key: string,
  now: number,
  limit: number,
  windowMs: number,
): boolean {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
