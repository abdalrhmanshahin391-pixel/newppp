// Builds Wordcraft's level packs, offline (scripts/wordcraft-generate.ts writes packs.json; a test
// fails when the file differs from what this code makes). Every published puzzle passes the
// quality gates of the research report:
//   1. every tile is used once and there is exactly one full cover (the solver's proof);
//   2. no Arabic clue also fits another word that can be traced on the grid (or another target);
//   3. few other real words hide in the grid, and none of 5 letters or more (they mislead);
//   4. no word twice, and never a word with its plural;
//   5. the same versions and seeds always give the same packs.
import { buildOnce, difficulty, hiddenWords, pathsFor, rng, type Built } from "./engine.ts";
import { BY_WORD, EXTRA_WORDS, LEXICON, LEXICON_VERSION } from "./lexicon.ts";

export const ALGORITHM_VERSION = 1;

export type PackId = "intro" | "easy" | "medium" | "hard";

export type Puzzle = {
  id: string;
  pack: PackId;
  rows: number;
  cols: number;
  letters: string;
  words: string[];
  /** The proven answer (tile indices for each word). */
  paths: number[][];
  difficulty: number;
};

export type PackFile = {
  algorithmVersion: number;
  lexiconVersion: number;
  puzzles: Puzzle[];
};

type Shape = { rows: number; cols: number; lengths: number[] };
type PackPlan = { id: PackId; count: number; levels: number[]; shapes: Shape[]; seed: number };

export const PACK_PLANS: PackPlan[] = [
  {
    id: "intro",
    count: 10,
    levels: [1],
    seed: 11,
    shapes: [
      { rows: 3, cols: 4, lengths: [4, 4, 4] },
      { rows: 4, cols: 4, lengths: [4, 6, 6] },
    ],
  },
  {
    id: "easy",
    count: 20,
    levels: [1, 2],
    seed: 22,
    shapes: [
      { rows: 4, cols: 5, lengths: [5, 5, 5, 5] },
      { rows: 4, cols: 5, lengths: [4, 4, 6, 6] },
      { rows: 4, cols: 5, lengths: [4, 5, 5, 6] },
    ],
  },
  {
    id: "medium",
    count: 25,
    levels: [1, 2],
    seed: 33,
    shapes: [
      { rows: 4, cols: 6, lengths: [4, 4, 4, 5, 7] },
      { rows: 4, cols: 6, lengths: [4, 5, 5, 5, 5] },
      { rows: 4, cols: 6, lengths: [4, 4, 5, 5, 6] },
    ],
  },
  {
    id: "hard",
    count: 15,
    levels: [1, 2, 3],
    seed: 44,
    shapes: [
      { rows: 5, cols: 6, lengths: [5, 5, 6, 7, 7] },
      { rows: 5, cols: 6, lengths: [4, 5, 5, 5, 5, 6] },
      { rows: 5, cols: 6, lengths: [6, 6, 6, 6, 6] },
    ],
  },
];

/** Every word the game recognises (puzzle words and common words). */
export const DICTIONARY: ReadonlySet<string> = new Set([
  ...LEXICON.map((e) => e.word),
  ...EXTRA_WORDS,
]);

/** The first word of an Arabic meaning, without marks: "صغير جداً" and "صغير السن" share "صغير". */
export function clueKey(ar: string): string {
  return ar
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[()]/g, " ")
    .trim()
    .split(/\s+/)[0];
}

const isPlural = (a: string, b: string) =>
  a === `${b}S` || a === `${b}ES` || b === `${a}S` || b === `${a}ES`;

export type GateFailure = "clue_clash" | "misleading" | "repeat" | "plural";

/** The gates after the solver's proof; an empty list means the puzzle may be published. */
export function gateFailures(built: Built): GateFailure[] {
  const out: GateFailure[] = [];
  const { grid, words } = built;
  if (new Set(words).size !== words.length) out.push("repeat");
  if (words.some((a, i) => words.some((b, j) => i < j && isPlural(a, b)))) out.push("plural");
  const keys = words.map((w) => clueKey(BY_WORD.get(w)?.ar ?? w));
  let clash = new Set(keys).size !== keys.length;
  if (!clash)
    for (const e of LEXICON) {
      if (words.includes(e.word) || !keys.includes(clueKey(e.ar))) continue;
      if (pathsFor(grid, e.word, 0, 1).length) {
        clash = true;
        break;
      }
    }
  if (clash) out.push("clue_clash");
  const hidden = hiddenWords(grid, DICTIONARY, new Set(words));
  // About one short decoy per six tiles is normal English; a long one is a trap.
  const allowed = Math.ceil(grid.letters.length / 6);
  if (hidden.length > allowed || hidden.some((w) => w.length >= 5)) out.push("misleading");
  return out;
}

/** All packs, the same every time for the same versions. */
export function generateAll(): PackFile {
  const puzzles: Puzzle[] = [];
  const used = new Map<string, number>();
  for (const plan of PACK_PLANS) {
    const random = rng(plan.seed * 1000 + ALGORITHM_VERSION);
    const pool = (length: number) =>
      LEXICON.filter((e) => e.word.length === length && plan.levels.includes(e.level)).map(
        (e) => e.word,
      );
    const made: { built: Built; score: number }[] = [];
    let guard = 0;
    while (made.length < plan.count) {
      if (++guard > plan.count * 400) throw new Error(`pack ${plan.id}: not enough good puzzles`);
      const shape = plan.shapes[made.length % plan.shapes.length];
      // The least used words first, so the packs spread the vocabulary.
      const words: string[] = [];
      for (const length of shape.lengths) {
        const options = pool(length).filter((w) => !words.includes(w));
        if (!options.length) throw new Error(`no ${length}-letter words for ${plan.id}`);
        const least = Math.min(...options.map((w) => used.get(w) ?? 0));
        const fresh = options.filter((w) => (used.get(w) ?? 0) <= least + 1);
        words.push(fresh[Math.floor(random() * fresh.length)]);
      }
      const built = buildOnce(shape.rows, shape.cols, words, random);
      if (!built || gateFailures(built).length) continue;
      for (const w of words) used.set(w, (used.get(w) ?? 0) + 1);
      made.push({ built, score: difficulty(built, (w) => BY_WORD.get(w)?.level ?? 3).score });
    }
    made
      .sort((a, b) => a.score - b.score)
      .forEach(({ built, score }, i) =>
        puzzles.push({
          id: `${plan.id}-${i + 1}`,
          pack: plan.id,
          rows: built.grid.rows,
          cols: built.grid.cols,
          letters: built.grid.letters,
          words: built.words,
          paths: built.paths,
          difficulty: score,
        }),
      );
  }
  return { algorithmVersion: ALGORITHM_VERSION, lexiconVersion: LEXICON_VERSION, puzzles };
}
