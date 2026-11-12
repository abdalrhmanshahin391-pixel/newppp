// The published Wordcraft packs (made by scripts/wordcraft-generate.ts) and their names.
import data from "./packs.json";
import type { PackFile, PackId, Puzzle } from "./generate";

const file = data as PackFile;

export const PUZZLES: Puzzle[] = file.puzzles;
export const PUZZLE_BY_ID: ReadonlyMap<string, Puzzle> = new Map(PUZZLES.map((p) => [p.id, p]));

export type PackInfo = {
  id: PackId;
  name: { en: string; ar: string };
  line: { en: string; ar: string };
};

export const PACKS: PackInfo[] = [
  {
    id: "intro",
    name: { en: "Warm-up", ar: "تمهيدي" },
    line: { en: "Small grids to learn the moves.", ar: "شبكات صغيرة لتتعلّم الحركة." },
  },
  {
    id: "easy",
    name: { en: "Easy", ar: "سهل" },
    line: { en: "Four words, everyday vocabulary.", ar: "أربع كلمات من الحياة اليومية." },
  },
  {
    id: "medium",
    name: { en: "Medium", ar: "متوسط" },
    line: { en: "Five words on a 4 × 6 grid.", ar: "خمس كلمات على شبكة 4 × 6." },
  },
  {
    id: "hard",
    name: { en: "Hard", ar: "صعب" },
    line: { en: "Bigger grids and longer words.", ar: "شبكات أكبر وكلمات أطول." },
  },
];

export function packPuzzles(pack: PackId): Puzzle[] {
  return PUZZLES.filter((p) => p.pack === pack);
}

/** The puzzle after this one in its pack, or the first of the next pack. */
export function nextPuzzle(id: string): Puzzle | null {
  const i = PUZZLES.findIndex((p) => p.id === id);
  return i >= 0 && i < PUZZLES.length - 1 ? PUZZLES[i + 1] : null;
}

/** "Medium 4": a puzzle's short name. */
export function puzzleName(p: Puzzle, lang: "en" | "ar"): string {
  const pack = PACKS.find((x) => x.id === p.pack)!;
  return `${pack.name[lang]} ${p.id.split("-")[1]}`;
}

/** The pool the daily puzzle is chosen from (the 4 × 6 puzzles, as in the original game). */
export const DAILY_POOL: string[] = packPuzzles("medium").map((p) => p.id);
