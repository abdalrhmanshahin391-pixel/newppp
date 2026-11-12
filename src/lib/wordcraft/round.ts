// One Wordcraft round: four words (from the AI, or from the built-in list when the AI cannot
// help), written into a grid with exactly one answer. Nothing the AI says is trusted before it
// passes cleanCandidates; every grid passes the solver's proof and the quality gates:
//   1. every tile is used once and there is exactly one full cover (buildOnce);
//   2. no two words share an Arabic meaning (the clue must point to one word);
//   3. few other real words hide in the grid, and none of 5 letters or more (they mislead);
//   4. no word twice, and never a word with its plural.
// No React, no DOM, no network: the server function and the browser both use it.
import { buildOnce, difficulty, hiddenWords, rng, type Built, type Path } from "./engine.ts";
import { EXTRA_WORDS, LEXICON } from "./lexicon.ts";

export type Level = "easy" | "medium" | "hard";
export const LEVEL_IDS: Level[] = ["easy", "medium", "hard"];

export type LevelInfo = {
  rows: number;
  cols: number;
  /** One length per word; they fill the grid exactly. */
  lengths: number[];
  /** How many candidates of each length the AI is asked for (more than needed, to choose from). */
  ask: Record<number, number>;
  cefr: string;
  /** The built-in list's levels used when the AI cannot help (1 = A1, 2 = A2, 3 = B1). */
  listLevels: number[];
};

export const LEVELS: Record<Level, LevelInfo> = {
  easy: {
    rows: 4,
    cols: 4,
    lengths: [4, 4, 4, 4],
    ask: { 4: 12 },
    cefr: "A1 (very common everyday words)",
    listLevels: [1],
  },
  medium: {
    rows: 4,
    cols: 5,
    lengths: [5, 5, 5, 5],
    ask: { 5: 12 },
    cefr: "A2 to B1",
    listLevels: [1, 2],
  },
  hard: {
    rows: 4,
    cols: 6,
    lengths: [5, 6, 6, 7],
    ask: { 5: 4, 6: 7, 7: 5 },
    cefr: "B1 to B2 (less common words)",
    listLevels: [2, 3],
  },
};

export type RoundWord = { word: string; ar: string; example: string; exampleAr: string };

export type Round = {
  level: Level;
  rows: number;
  cols: number;
  letters: string;
  words: string[];
  /** The proven answer (tile indices for each word). */
  paths: Path[];
  /** Meaning and example for each word, in the same order as `words`. */
  info: RoundWord[];
  /** Where the words came from. */
  source: "ai" | "list";
};

/** Words that never go in a learner's puzzle, whatever the AI suggests. */
const BLOCKED = new Set(
  (
    "KILL KILLS KILLER KILLED DEAD DEATH DIE DIES DYING MURDER GUN GUNS BOMB BOMBS WAR WARS SHOOT " +
    "KNIFE BLOOD DRUG DRUGS BEER WINE VODKA DRUNK SEXY NAKED NUDE BITCH DAMN HELL CRAP STUPID IDIOT " +
    "SUICIDE TERROR WEAPON WEAPONS ATTACK RAPE PORK BACON CASINO"
  ).split(" "),
);

/** Every word the game recognises as "a real word" (the built-in list and common words). */
export const DICTIONARY: ReadonlySet<string> = new Set([
  ...LEXICON.map((e) => e.word),
  ...EXTRA_WORDS,
]);

/** The first word of an Arabic meaning, without marks: "صغير جداً" and "صغير السن" share "صغير". */
export function clueKey(ar: string): string {
  return ar
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[()«»"'.,،:؛]/g, " ")
    .trim()
    .split(/\s+/)[0];
}

export const isPlural = (a: string, b: string) =>
  a === `${b}S` || a === `${b}ES` || b === `${a}S` || b === `${a}ES`;

const ARABIC = /[؀-ۿ]/;
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** The example has to use the word (or a form of it: "draws" for DRAW, "made" is not checked). */
function usesWord(example: string, word: string): boolean {
  const stem = word.length > 4 ? word.slice(0, word.length - 2) : word.slice(0, 3);
  return new RegExp(`\\b${stem}`, "i").test(example);
}

/**
 * The AI's reply as usable words: right lengths, letters only, not blocked, with an Arabic
 * meaning and an example that uses the word. Repeats, plurals of an earlier word and a second
 * word with the same Arabic meaning are dropped.
 */
export function cleanCandidates(reply: unknown, level: Level): RoundWord[] {
  const lengths = new Set(LEVELS[level].lengths);
  const list =
    reply && typeof reply === "object" && Array.isArray((reply as { words?: unknown }).words)
      ? ((reply as { words: unknown[] }).words as unknown[])
      : Array.isArray(reply)
        ? reply
        : [];
  const out: RoundWord[] = [];
  const keys = new Set<string>();
  for (const item of list.slice(0, 60)) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const word = text(raw.word, 20).toUpperCase();
    const ar = text(raw.ar, 40);
    const example = text(raw.example, 160);
    const exampleAr = text(raw.exampleAr, 200);
    if (!/^[A-Z]+$/.test(word) || !lengths.has(word.length) || BLOCKED.has(word)) continue;
    if (!ARABIC.test(ar) || !example || !ARABIC.test(exampleAr) || !usesWord(example, word))
      continue;
    if (out.some((o) => o.word === word || isPlural(o.word, word))) continue;
    const key = clueKey(ar);
    if (!key || keys.has(key)) continue;
    keys.add(key);
    out.push({ word, ar, example, exampleAr });
  }
  return out;
}

/** The built-in list's words for a level (used when the AI cannot help, and for guests). */
export function listCandidates(level: Level): RoundWord[] {
  const info = LEVELS[level];
  return LEXICON.filter(
    (e) => info.lengths.includes(e.word.length) && info.listLevels.includes(e.level),
  ).map(({ word, ar, example, exampleAr }) => ({ word, ar, example, exampleAr }));
}

/** Too many other real words in the grid, or a long one, would send the player the wrong way. */
function misleading(built: Built): boolean {
  const hidden = hiddenWords(built.grid, DICTIONARY, new Set(built.words));
  return (
    hidden.length > Math.ceil(built.grid.letters.length / 6) || hidden.some((w) => w.length >= 5)
  );
}

/** Four words that fit the level's lengths, chosen at random among the candidates. */
function pickWords(pool: RoundWord[], lengths: number[], random: () => number): RoundWord[] | null {
  const chosen: RoundWord[] = [];
  for (const length of lengths) {
    const options = pool.filter(
      (c) =>
        c.word.length === length &&
        !chosen.some(
          (o) => o.word === c.word || isPlural(o.word, c.word) || clueKey(o.ar) === clueKey(c.ar),
        ),
    );
    if (!options.length) return null;
    chosen.push(options[Math.floor(random() * options.length)]);
  }
  return chosen;
}

/**
 * A round from the candidates: several good grids are made, then the level picks among them
 * (easy takes the simplest, hard the most tangled, medium one in the middle). Null when the
 * candidates cannot make a good grid.
 */
export function buildRound(
  candidates: RoundWord[],
  level: Level,
  source: Round["source"],
  random: () => number = rng(Date.now() % 2 ** 31),
): Round | null {
  const info = LEVELS[level];
  const made: { built: Built; words: RoundWord[]; score: number }[] = [];
  const unknown = (w: string) => (DICTIONARY.has(w) ? 1 : 3);
  for (let attempt = 0; attempt < 120 && made.length < 5; attempt++) {
    const words = pickWords(candidates, info.lengths, random);
    if (!words) return null;
    const built = buildOnce(
      info.rows,
      info.cols,
      words.map((w) => w.word),
      random,
    );
    if (!built || misleading(built)) continue;
    made.push({ built, words, score: difficulty(built, unknown).score });
  }
  if (!made.length) return null;
  made.sort((a, b) => a.score - b.score);
  const pick =
    level === "easy"
      ? made[0]
      : level === "hard"
        ? made[made.length - 1]
        : made[Math.floor(made.length / 2)];
  const { built } = pick;
  return {
    level,
    rows: built.grid.rows,
    cols: built.grid.cols,
    letters: built.grid.letters,
    words: built.words,
    paths: built.paths,
    info: built.words.map((w) => pick.words.find((x) => x.word === w)!),
    source,
  };
}

/** A round from the built-in list (always possible: the list is large enough for every level). */
export function listRound(level: Level, random?: () => number, avoid: string[] = []): Round {
  const all = listCandidates(level);
  const fresh = all.filter((c) => !avoid.includes(c.word));
  // Skip recently seen words when enough are left for a grid.
  const round =
    buildRound(fresh.length >= 24 ? fresh : all, level, "list", random) ??
    buildRound(all, level, "list", random);
  if (!round) throw new Error("wordcraft_list_round_failed");
  return round;
}

/** A round passed to the browser is checked again before it is played (a bad one is refused). */
export function validRound(value: unknown): value is Round {
  if (!value || typeof value !== "object") return false;
  const r = value as Round;
  if (!LEVEL_IDS.includes(r.level) || !Number.isInteger(r.rows) || !Number.isInteger(r.cols))
    return false;
  const total = r.rows * r.cols;
  if (typeof r.letters !== "string" || r.letters.length !== total) return false;
  if (!Array.isArray(r.words) || !Array.isArray(r.paths) || !Array.isArray(r.info)) return false;
  if (r.words.length !== r.paths.length || r.words.length !== r.info.length) return false;
  const seen = new Set<number>();
  for (let i = 0; i < r.words.length; i++) {
    const path = r.paths[i];
    if (!Array.isArray(path) || path.length !== r.words[i].length) return false;
    for (const [k, tile] of path.entries()) {
      if (!Number.isInteger(tile) || tile < 0 || tile >= total || seen.has(tile)) return false;
      if (r.letters[tile] !== r.words[i][k]) return false;
      seen.add(tile);
    }
  }
  return seen.size === total;
}

// ---- asking the AI --------------------------------------------------------------------------

/** Topics a round's words are drawn around, so rounds differ even at a low temperature. */
export const THEMES = [
  "food and cooking",
  "home and family",
  "school and study",
  "travel and places",
  "nature and weather",
  "work and jobs",
  "sports and games",
  "the body and health",
  "shopping and money",
  "the city and transport",
  "feelings and people",
  "time and daily routine",
  "animals",
  "clothes and colours",
  "music, art and free time",
  "technology and phones",
];

export function roundSystemPrompt(): string {
  return [
    "You choose English words for a word puzzle played by Arabic-speaking learners of English.",
    'Reply with JSON only, no other text: {"words":[{"word":"...","ar":"...","example":"...","exampleAr":"..."}]}',
    "Rules for every word:",
    "- a real, common English word, letters A-Z only: no names, places, brands, abbreviations or hyphens;",
    "- not a plural form, and not violent, sexual, religious, political, about alcohol or drugs, or rude;",
    "- every word has a different meaning from the others;",
    '- "ar": its meaning in one or two Arabic words (Modern Standard Arabic), different for every word;',
    '- "example": a short, simple English sentence (at most 10 words) that uses the word;',
    '- "exampleAr": the Arabic translation of that sentence.',
  ].join("\n");
}

export function roundUserMessage(level: Level, theme: string, avoid: string[]): string {
  const info = LEVELS[level];
  const counts = Object.entries(info.ask)
    .map(([length, count]) => `${count} words of exactly ${length} letters`)
    .join(", ");
  return [
    `Level: ${info.cefr}.`,
    `Give ${counts}.`,
    `Mostly around the topic "${theme}", but any common word of the right length is fine.`,
    avoid.length ? `Do not use these words: ${avoid.slice(0, 40).join(", ")}.` : "",
    "Count the letters of every word carefully.",
  ]
    .filter(Boolean)
    .join("\n");
}
