// Keeps the learner's words list accurate. The language model proposes items from an
// exchange; nothing is accepted unless the term really appears in what the learner asked
// or in what Rita answered, so an invented or neighbouring word can never slip in.
import type { LearningItem } from "./rita-learning.ts";
import { learningKey } from "./rita-learning.ts";

/** At most this many words come from one question ("what does X mean?" is one to three). */
export const MAX_ITEMS_PER_TURN = 3;

/** Removes markdown, quotes and edge punctuation the voice reply may carry around a word. */
export function cleanTerm(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(/[*_`~#]+/g, "")
    .replace(/[“”„"«»‹›]/g, "")
    .replace(/^[\s.,;:!?،؛؟()[\]{}\-–—]+|[\s.,;:!?،؛؟()[\]{}\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0640]/g, "")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ARTICLE = /^(?:der|die|das|ein|eine|the|a|an)\s+/i;

/** True when the term (with or without its article) occurs in any of the texts. */
export function appearsIn(term: string, ...texts: string[]): boolean {
  const bare = fold(cleanTerm(term).replace(ARTICLE, ""));
  if (!bare) return false;
  const haystack = ` ${texts.map(fold).join(" | ")} `;
  return haystack.includes(` ${bare} `);
}

const LANGUAGE = /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i;

/** Validates and filters the model's proposals; returns clean items, most relevant first. */
export function guardItems(rawItems: unknown, spoken: string, reply: string): LearningItem[] {
  if (!Array.isArray(rawItems)) return [];
  const seen = new Set<string>();
  const out: LearningItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const term = cleanTerm(item.term);
    const meaning = cleanTerm(item.meaning).slice(0, 280);
    const language = String(item.language ?? "")
      .trim()
      .slice(0, 30);
    if (!term || !meaning || !LANGUAGE.test(language)) continue;
    if (fold(term) === fold(meaning)) continue;
    // The word must come from this exchange. A made-up or neighbouring word is dropped.
    if (!appearsIn(term, spoken, reply)) continue;
    const isGerman = language.toLowerCase().startsWith("de");
    const article =
      isGerman && ["der", "die", "das"].includes(String(item.article))
        ? (String(item.article) as "der" | "die" | "das")
        : null;
    const cleaned: LearningItem = {
      term: article ? term.replace(new RegExp(`^${article}\\s+`, "i"), "").trim() || term : term,
      meaning,
      language,
      kind: item.kind === "sentence" ? "sentence" : "word",
      article,
      plural: item.plural ? cleanTerm(item.plural).slice(0, 120) || null : null,
    };
    const key = learningKey(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= MAX_ITEMS_PER_TURN) break;
  }
  return out;
}
