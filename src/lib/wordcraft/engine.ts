// Wordcraft: word-path puzzles that cover the whole grid and have exactly one answer.
//
// Rules: a word is traced through orthogonally adjacent tiles (no diagonals), never visiting a tile
// twice; every target word is used once; together the words cover every tile exactly once. A
// puzzle is published only when the exact cover is unique for its target words.
//
// Ported from the Uzyra research engine (wordcraft_engine.py): Warnsdorff DFS with a
// connectivity check builds a full path, the path is cut into the words' lengths, and an
// exact-cover solver (bitmasks, fewest-options-first) proves there is one and only one cover.
// Puzzles are generated offline (scripts/wordcraft-generate.ts) and shipped as checked packs;
// the game only checks moves. No React, no DOM: tested with node.

/** Tiles are numbered row by row: index = row * cols + col. */
export type Grid = { rows: number; cols: number; letters: string };
/** A path is the list of tile indices a word is traced through. */
export type Path = number[];

/** The largest grid the bitmask arithmetic supports (31 tiles fit in a 32-bit integer). */
export const MAX_TILES = 31;

const bit = (i: number) => 2 ** i;
const has = (mask: number, i: number) => Math.floor(mask / 2 ** i) % 2 === 1;
/** Bitwise "and" for masks up to 31 bits, as unsigned numbers. */
const and = (a: number, b: number) => (a & b) >>> 0;
const or = (a: number, b: number) => (a | b) >>> 0;

/** A small, fast, seedable random number generator (mulberry32). Same seed, same numbers. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Each tile's neighbours: up, down, left, right. */
export function neighbors(rows: number, cols: number): number[][] {
  const out: number[][] = [];
  for (let p = 0; p < rows * cols; p++) {
    const r = Math.floor(p / cols);
    const c = p % cols;
    const ns: number[] = [];
    if (r > 0) ns.push(p - cols);
    if (r < rows - 1) ns.push(p + cols);
    if (c > 0) ns.push(p - 1);
    if (c < cols - 1) ns.push(p + 1);
    out.push(ns);
  }
  return out;
}

export function adjacent(cols: number, a: number, b: number): boolean {
  const ra = Math.floor(a / cols);
  const rb = Math.floor(b / cols);
  return (ra === rb && Math.abs(a - b) === 1) || (a % cols === b % cols && Math.abs(ra - rb) === 1);
}

export function maskOf(path: Path): number {
  let mask = 0;
  for (const p of path) mask = or(mask, bit(p));
  return mask;
}

/**
 * Every self-avoiding orthogonal path that spells `word` on the grid, avoiding `blocked` tiles.
 * `limit` stops early (to ask "is there one?"); a large search budget guards against runaway grids.
 */
export function pathsFor(grid: Grid, word: string, blocked = 0, limit = Infinity): Path[] {
  const adj = neighbors(grid.rows, grid.cols);
  const out: Path[] = [];
  if (!word) return out;
  let steps = 0;
  const walk = (i: number, at: number, mask: number, path: Path) => {
    if (out.length >= limit) return;
    if (++steps > 1_000_000) throw new Error("path_budget");
    if (i === word.length) {
      out.push([...path]);
      return;
    }
    for (const q of adj[at]) {
      if (has(mask, q) || grid.letters[q] !== word[i]) continue;
      path.push(q);
      walk(i + 1, q, or(mask, bit(q)), path);
      path.pop();
    }
  };
  for (let p = 0; p < grid.letters.length && out.length < limit; p++) {
    if (grid.letters[p] !== word[0] || has(blocked, p)) continue;
    walk(1, p, or(blocked, bit(p)), [p]);
  }
  return out;
}

export type Cover = { count: number; paths: Path[] | null; nodes: number };

/**
 * Counts the ways the words cover every free tile exactly once (stopping at `limit`), with the
 * first cover found. `used` marks tiles already taken (words the player has locked); those words
 * are left out of `words`. `nodes` is how much the search had to try (solver effort).
 */
export function covers(grid: Grid, words: string[], used = 0, limit = 2): Cover {
  const total = grid.rows * grid.cols;
  const full = 2 ** total - 1;
  let free = 0;
  for (let p = 0; p < total; p++) if (!has(used, p)) free++;
  if (words.reduce((s, w) => s + w.length, 0) !== free) return { count: 0, paths: null, nodes: 0 };
  const options = words.map((w) => pathsFor(grid, w, used).map((p) => ({ p, m: maskOf(p) })));
  if (options.some((o) => !o.length)) return { count: 0, paths: null, nodes: 0 };
  let count = 0;
  let first: Path[] | null = null;
  let nodes = 0;
  const chosen: (Path | null)[] = words.map(() => null);
  const search = (done: Set<number>, taken: number) => {
    if (count >= limit) return;
    nodes++;
    if (done.size === words.length) {
      if (taken === full) {
        count++;
        if (!first) first = chosen.map((p) => [...(p as Path)]);
      }
      return;
    }
    // The word with the fewest options still fitting goes first.
    let best = -1;
    let bestOpts: { p: Path; m: number }[] = [];
    for (let i = 0; i < words.length; i++) {
      if (done.has(i)) continue;
      const fit = options[i].filter((o) => and(o.m, taken) === 0);
      if (!fit.length) return;
      if (best < 0 || fit.length < bestOpts.length) {
        best = i;
        bestOpts = fit;
        if (fit.length === 1) break;
      }
    }
    const next = new Set(done).add(best);
    for (const o of bestOpts) {
      chosen[best] = o.p;
      search(next, or(taken, o.m));
      if (count >= limit) return;
    }
    chosen[best] = null;
  };
  search(new Set(), used);
  return { count, paths: first, nodes };
}

/** True when the tiles not yet used still form one connected piece (no stranded pockets). */
function connected(taken: number, total: number, adj: number[][]): boolean {
  let start = -1;
  let left = 0;
  for (let p = 0; p < total; p++)
    if (!has(taken, p)) {
      left++;
      if (start < 0) start = p;
    }
  if (!left) return true;
  const seen = new Set([start]);
  const todo = [start];
  while (todo.length) {
    const p = todo.pop()!;
    for (const q of adj[p])
      if (!has(taken, q) && !seen.has(q)) {
        seen.add(q);
        todo.push(q);
      }
  }
  return seen.size === left;
}

/**
 * A path through every tile (a Hamiltonian path), by randomized Warnsdorff DFS: the next tile is
 * the one with the fewest free neighbours (ties broken at random), and a step that would split
 * the free tiles in two is refused. Null when the step budget runs out.
 */
export function fullPath(
  rows: number,
  cols: number,
  random: () => number,
  budget = 20000,
): Path | null {
  const total = rows * cols;
  const adj = neighbors(rows, cols);
  const full = 2 ** total - 1;
  let steps = 0;
  const path: Path = [];
  const dfs = (at: number, mask: number): boolean => {
    if (++steps > budget) return false;
    if (mask === full) return true;
    const free = (q: number) => adj[q].filter((z) => !has(mask, z)).length;
    const choices = shuffle(
      adj[at].filter((q) => !has(mask, q)),
      random,
    ).sort((a, b) => free(a) - free(b));
    for (const q of choices) {
      const next = or(mask, bit(q));
      if (!connected(next, total, adj)) continue;
      path.push(q);
      if (dfs(q, next)) return true;
      path.pop();
    }
    return false;
  };
  for (const start of shuffle(
    Array.from({ length: total }, (_, i) => i),
    random,
  )) {
    path.length = 0;
    path.push(start);
    if (dfs(start, bit(start))) return path;
    if (steps > budget) break;
  }
  return null;
}

export type Built = { grid: Grid; words: string[]; paths: Path[]; nodes: number };

/**
 * Writes the words along one full path (in a random order, each forwards or backwards) and keeps
 * the grid only if the solver proves exactly one cover. Returns null when this attempt fails.
 */
export function buildOnce(
  rows: number,
  cols: number,
  words: string[],
  random: () => number,
): Built | null {
  const total = rows * cols;
  if (total > MAX_TILES) throw new Error("grid_too_large");
  if (words.reduce((s, w) => s + w.length, 0) !== total) throw new Error("lengths_must_fill");
  const path = fullPath(rows, cols, random);
  if (!path) return null;
  const letters = Array<string>(total).fill("");
  let cursor = 0;
  for (const i of shuffle(
    words.map((_, i) => i),
    random,
  )) {
    let segment = path.slice(cursor, cursor + words[i].length);
    if (random() < 0.5) segment = segment.reverse();
    segment.forEach((cell, k) => (letters[cell] = words[i][k]));
    cursor += words[i].length;
  }
  const grid = { rows, cols, letters: letters.join("") };
  const result = covers(grid, words, 0, 2);
  // The solver's answer is kept, not the constructor's: the proof is what counts.
  if (result.count !== 1 || !result.paths) return null;
  return { grid, words, paths: result.paths, nodes: result.nodes };
}

// ---- checking a player's move ------------------------------------------------------------------

export type MoveResult =
  | { kind: "locked"; word: string; index: number }
  | { kind: "blocks"; word: string }
  | { kind: "other_word"; word: string }
  | { kind: "not_word"; word: string }
  | { kind: "invalid" };

/**
 * What a traced path means: a target word whose path still lets the whole grid be covered
 * ("locked"), a target word whose path makes finishing impossible ("blocks"), a real word that is
 * not one of the puzzle's ("other_word", given the `dictionary`), or nothing.
 */
export function checkMove(
  grid: Grid,
  words: string[],
  solved: Set<number>,
  usedTiles: number,
  path: Path,
  dictionary: ReadonlySet<string> = new Set(),
): MoveResult {
  if (path.length < 2 || new Set(path).size !== path.length) return { kind: "invalid" };
  if (path.some((p) => p < 0 || p >= grid.letters.length || has(usedTiles, p)))
    return { kind: "invalid" };
  for (let i = 1; i < path.length; i++)
    if (!adjacent(grid.cols, path[i - 1], path[i])) return { kind: "invalid" };
  const word = path.map((p) => grid.letters[p]).join("");
  const index = words.findIndex((w, i) => w === word && !solved.has(i));
  if (index < 0)
    return dictionary.has(word) ? { kind: "other_word", word } : { kind: "not_word", word };
  const left = words.filter((_, i) => i !== index && !solved.has(i));
  const after = or(usedTiles, maskOf(path));
  if (left.length && covers(grid, left, after, 1).count === 0) return { kind: "blocks", word };
  if (!left.length && after !== 2 ** grid.letters.length - 1) return { kind: "blocks", word };
  return { kind: "locked", word, index };
}

// ---- measuring a puzzle --------------------------------------------------------------------------

/** How many times a path changes direction. */
export function turns(path: Path): number {
  let n = 0;
  for (let i = 2; i < path.length; i++)
    if (path[i - 1] - path[i - 2] !== path[i] - path[i - 1]) n++;
  return n;
}

/** Other words from a list that can be traced somewhere on the grid (they may mislead). */
export function hiddenWords(grid: Grid, list: Iterable<string>, exclude: Set<string>): string[] {
  const out: string[] = [];
  for (const w of list) {
    if (exclude.has(w) || w.length < 3 || w.length > grid.letters.length) continue;
    if (pathsFor(grid, w, 0, 5).length) out.push(w);
  }
  return out;
}

export type Difficulty = {
  score: number;
  lexical: number;
  turns: number;
  branching: number;
  routes: number;
  effort: number;
};

/**
 * The research report's first difficulty model (weights are hypotheses, to be refitted with
 * players' times, errors, hints and quits): unfamiliar words, turning paths, how many letters
 * offer a choice at each step, how many routes each word has before the others are fixed, and
 * how hard the solver had to work. Each part is 0–1; the score is 0–100.
 */
export function difficulty(built: Built, levelOf: (word: string) => number): Difficulty {
  const { grid, words, paths, nodes } = built;
  const lexical = words.reduce((s, w) => s + levelOf(w), 0) / words.length / 5;
  const turnShare =
    paths.reduce((s, p) => s + turns(p) / Math.max(1, p.length - 2), 0) / paths.length;
  // Branching: along each answer path, how many neighbouring tiles carry the next letter.
  const adj = neighbors(grid.rows, grid.cols);
  let choice = 0;
  let steps = 0;
  paths.forEach((p, i) => {
    for (let k = 0; k < p.length - 1; k++) {
      const next = words[i][k + 1];
      choice += adj[p[k]].filter((q) => grid.letters[q] === next).length - 1;
      steps++;
    }
  });
  const branching = Math.min(1, choice / Math.max(1, steps));
  const routes = Math.min(
    1,
    (words.reduce((s, w) => s + pathsFor(grid, w).length, 0) / words.length - 1) / 3,
  );
  const effort = Math.min(1, Math.log2(Math.max(1, nodes)) / 8);
  const score =
    100 * (0.3 * lexical + 0.18 * turnShare + 0.2 * branching + 0.12 * routes + 0.2 * effort);
  return {
    score: Math.round(score * 10) / 10,
    lexical: round(lexical),
    turns: round(turnShare),
    branching: round(branching),
    routes: round(routes),
    effort: round(effort),
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
