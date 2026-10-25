// How a lesson item is shown to the learner and how an answer is checked. Checking is plain code,
// never a model: the server decides right or wrong, and Rita only says what it decided.
// The answer never leaves the server before the learner answers: the public item has the options
// and tiles in a shuffled order whose ids say nothing about the right order.
import { GAP, normalizeAnswer, type LessonItem, type ItemTemplate } from "./rita-lesson-content.ts";

export type PublicTile = { id: string; text: string };

/** What the page and Rita may see of an item before it is answered. */
export type PublicItem = {
  id: string;
  template: ItemTemplate;
  prompt: string;
  instruction_ar: string;
  spoken_prompt: string;
  /** choice_fill and meaning_choice */
  options: string[];
  /** word_order and syllable_tiles */
  tiles: PublicTile[];
  /** meaning_choice and syllable_tiles: the word the question is about */
  word: string;
  /** Whether a spoken answer can be checked (tiles that make a spelling cannot). */
  voice: boolean;
};

export type LearnerResponse =
  | { kind: "choice"; value: string }
  | { kind: "tiles"; order: string[] }
  | { kind: "spoken"; text: string };

export type Grade =
  | { status: "correct"; given: string }
  | { status: "wrong"; given: string }
  /** Not counted either way: speech that matched no option, or a malformed answer. */
  | { status: "unclear"; given: string; reason: "not_an_option" | "tap_to_answer" | "malformed" };

/** A small deterministic random generator, so a run shows the same order after a reload. */
function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** The positions 0..length-1 in a seeded order; not the identity when the length allows. */
export function shuffledOrder(length: number, seed: string): number[] {
  const order = Array.from({ length }, (_, index) => index);
  if (length < 2) return order;
  const random = seededRandom(seed);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    for (let index = length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [order[index], order[swap]] = [order[swap], order[index]];
    }
    if (order.some((value, index) => value !== index)) return order;
  }
  return [...order.slice(1), order[0]];
}

function tilesOf(item: LessonItem): string[] {
  return item.template === "word_order" || item.template === "syllable_tiles" ? item.answer : [];
}

/** The tiles in the order the learner sees them. Ids are positions in that order ("p0", "p1"…). */
function shuffledTiles(item: LessonItem, seed: string): PublicTile[] {
  const tiles = tilesOf(item);
  return shuffledOrder(tiles.length, `${seed}:${item.id}:tiles`).map((original, position) => ({
    id: `p${position}`,
    text: tiles[original],
  }));
}

export function publicItem(item: LessonItem, seed: string): PublicItem {
  let options: string[] = [];
  if (item.template === "choice_fill" && item.keep_option_order) options = [...item.options];
  else if (item.template === "choice_fill" || item.template === "meaning_choice") {
    // Shuffled so the right answer is not always in the place the writer put it.
    options = shuffledOrder(item.options.length, `${seed}:${item.id}:options`).map(
      (index) => item.options[index],
    );
  }
  return {
    id: item.id,
    template: item.template,
    prompt: item.prompt,
    instruction_ar: item.instruction_ar,
    spoken_prompt: item.spoken_prompt || item.prompt.replace(GAP, "blank"),
    options,
    tiles: shuffledTiles(item, seed),
    word: item.template === "meaning_choice" || item.template === "syllable_tiles" ? item.word : "",
    voice: item.template !== "syllable_tiles",
  };
}

/** What the learner should have answered, shown after the item is settled. */
export function correctAnswerText(item: LessonItem): string {
  switch (item.template) {
    case "choice_fill":
    case "meaning_choice":
      return item.answer;
    case "word_order":
      return item.answer.join(" ");
    case "syllable_tiles":
      return item.word;
  }
}

const ORDINALS: Record<string, number> = {
  "1": 0,
  one: 0,
  first: 0,
  واحد: 0,
  الاول: 0,
  الأول: 0,
  اول: 0,
  أول: 0,
  "رقم واحد": 0,
  "2": 1,
  two: 1,
  second: 1,
  اثنين: 1,
  اتنين: 1,
  تنين: 1,
  الثاني: 1,
  التاني: 1,
  "3": 2,
  three: 2,
  third: 2,
  ثلاثة: 2,
  تلاتة: 2,
  ثلاثه: 2,
  الثالث: 2,
  التالت: 2,
  "4": 3,
  four: 3,
  fourth: 3,
  أربعة: 3,
  اربعة: 3,
  اربعه: 3,
  الرابع: 3,
};

function tokensOf(value: string): string[] {
  return normalizeAnswer(value)
    .replace(/[.!?؟,،;:"()]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Which shown option a spoken answer names: the option itself ("is"), or its place ("the second",
 * "الثاني", "2"). Null when nothing or more than one option is named, so a misheard answer is
 * asked again instead of being marked wrong.
 */
export function matchSpokenOption(options: string[], heard: string): string | null {
  const said = normalizeAnswer(heard);
  if (!said) return null;
  const exact = options.find((option) => normalizeAnswer(option) === said);
  if (exact) return exact;
  const words = tokensOf(heard);
  const joined = ` ${words.join(" ")} `;
  const named = options.filter((option) => joined.includes(` ${tokensOf(option).join(" ")} `));
  if (named.length === 1) return named[0];
  if (named.length > 1) return null;
  const places = new Set<number>();
  for (const word of words) {
    if (word in ORDINALS) places.add(ORDINALS[word]);
  }
  for (const phrase of Object.keys(ORDINALS)) {
    if (phrase.includes(" ") && joined.includes(` ${phrase} `)) places.add(ORDINALS[phrase]);
  }
  if (places.size !== 1) return null;
  const [place] = [...places];
  return options[place] ?? null;
}

function sameWords(a: string[], b: string[]): boolean {
  return (
    a.length === b.length &&
    a.every((word, index) => normalizeAnswer(word) === normalizeAnswer(b[index]))
  );
}

/** Checks one answer. The seed must be the run's seed, so tile ids map back to the same tiles. */
export function gradeItem(item: LessonItem, response: LearnerResponse, seed: string): Grade {
  switch (item.template) {
    case "choice_fill":
    case "meaning_choice": {
      const shown = publicItem(item, seed).options;
      let value: string | null = null;
      if (response.kind === "choice") {
        value = shown.find((option) => option === response.value) ?? null;
        if (value === null)
          return { status: "unclear", given: response.value, reason: "malformed" };
      } else if (response.kind === "spoken") {
        value = matchSpokenOption(shown, response.text);
        if (value === null)
          return { status: "unclear", given: response.text, reason: "not_an_option" };
      } else {
        return { status: "unclear", given: "", reason: "malformed" };
      }
      return normalizeAnswer(value) === normalizeAnswer(item.answer)
        ? { status: "correct", given: value }
        : { status: "wrong", given: value };
    }
    case "word_order": {
      const orders = [item.answer, ...item.accepted];
      if (response.kind === "spoken") {
        const said = tokensOf(response.text);
        const match = orders.some((order) =>
          sameWords(
            said,
            order.flatMap((word) => tokensOf(word)),
          ),
        );
        // A spoken sentence that is not one of the right orders may simply be misheard.
        return match
          ? { status: "correct", given: response.text }
          : { status: "unclear", given: response.text, reason: "not_an_option" };
      }
      const words = tilesInOrder(item, response, seed);
      if (!words) return { status: "unclear", given: "", reason: "malformed" };
      const given = words.join(" ");
      return orders.some((order) => sameWords(words, order))
        ? { status: "correct", given }
        : { status: "wrong", given };
    }
    case "syllable_tiles": {
      if (response.kind === "spoken") {
        return { status: "unclear", given: response.text, reason: "tap_to_answer" };
      }
      const pieces = tilesInOrder(item, response, seed);
      if (!pieces) return { status: "unclear", given: "", reason: "malformed" };
      const given = pieces.join("");
      return normalizeAnswer(given) === normalizeAnswer(item.word)
        ? { status: "correct", given }
        : { status: "wrong", given };
    }
  }
}

/** The tile texts in the order the learner placed them; null unless every tile is used once. */
function tilesInOrder(item: LessonItem, response: LearnerResponse, seed: string): string[] | null {
  if (response.kind !== "tiles") return null;
  const tiles = shuffledTiles(item, seed);
  const byId = new Map(tiles.map((tile) => [tile.id, tile.text]));
  if (response.order.length !== tiles.length) return null;
  if (new Set(response.order).size !== response.order.length) return null;
  const words: string[] = [];
  for (const id of response.order) {
    const word = byId.get(id);
    if (word === undefined) return null;
    words.push(word);
  }
  return words;
}
