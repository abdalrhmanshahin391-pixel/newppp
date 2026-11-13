// Pairs ("اقرن"): match each card's front with its back, against the clock. The rules live here,
// with no React and no DOM, so they are tested on their own:
//   - the pool: the learner's cards with text on both sides, each pair once, shuffled;
//   - the board: five rows, fronts in one column and backs in the other, each column shuffled;
//   - a match is right when the back belongs to the front (two cards with the same back are
//     both right: the learner cannot tell them apart, so neither is a mistake);
//   - a right match leaves, and the next card from the pool takes the two empty places;
//   - time: 60 s to start, +2 s for a right match, -2 s for a wrong one, never above 90 s;
//   - points: 10 a match, 15 from three in a row, 20 from five in a row.

export type PairCard = { id: string; front: string; back: string };
export type SourceCard = { id?: string; front?: unknown; back?: unknown };

export const ROWS = 5;
export const MIN_CARDS = 5;
export const START_MS = 60_000;
export const BONUS_MS = 2_000;
export const PENALTY_MS = 2_000;
export const MAX_MS = 90_000;

/** Card text as shown: spaces tidied, at most 160 characters. */
export function cardText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

/** Text compared for "the same answer": case, marks and punctuation do not count. */
export function sameText(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ًͯ-ٰٟ]/g, "")
      .toLowerCase()
      .replace(/[.,;:!?()"'«»،؛؟\-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The cards a game plays with: text on both sides (picture-only cards are left out and
 * counted), the same front and back only once, in a random order.
 */
export function buildPool(
  cards: readonly SourceCard[],
  random: () => number = Math.random,
): { pool: PairCard[]; skipped: number } {
  const pool: PairCard[] = [];
  let skipped = 0;
  for (const [i, card] of cards.entries()) {
    const front = cardText(card.front);
    const back = cardText(card.back);
    if (!front || !back) {
      skipped += 1;
      continue;
    }
    if (pool.some((p) => sameText(p.front, front) && sameText(p.back, back))) continue;
    pool.push({ id: typeof card.id === "string" && card.id ? card.id : `card-${i}`, front, back });
  }
  return { pool: shuffle(pool, random), skipped };
}

/** Is `back` (a card's back side) the answer to `front` (a card's front side)? */
export function isMatch(front: PairCard, back: PairCard): boolean {
  return front.id === back.id || sameText(front.back, back.back);
}

export type Board = {
  /** Fronts, one per row (null once the pool is used up). */
  left: (PairCard | null)[];
  /** Backs, one per row, in another order. */
  right: (PairCard | null)[];
  /** Cards still waiting to come on the board. */
  queue: PairCard[];
};

export function deal(pool: readonly PairCard[], random: () => number = Math.random): Board {
  const first = pool.slice(0, ROWS);
  const pad = <T>(list: T[]) => [...list, ...Array(ROWS - list.length).fill(null)] as (T | null)[];
  let right = shuffle(first, random);
  // A board where every front sits next to its own back is too easy: shuffle again.
  for (let tries = 0; tries < 6 && first.length > 1; tries++) {
    if (right.every((c, i) => c.id !== first[i].id)) break;
    right = shuffle(first, random);
  }
  return { left: pad(first), right: pad(right), queue: pool.slice(ROWS) };
}

/**
 * After a right match at row `li` (front) and row `ri` (back): both leave, and the next card's
 * front and back take the empty places. When the two places are on the same row the new back
 * swaps with another row's back, so a new pair never sits side by side.
 */
export function refill(
  board: Board,
  li: number,
  ri: number,
  random: () => number = Math.random,
): Board {
  const left = [...board.left];
  const right = [...board.right];
  const [next, ...queue] = board.queue;
  left[li] = next ?? null;
  right[ri] = next ?? null;
  if (next && li === ri) {
    const others = right.map((c, i) => (c && i !== ri ? i : -1)).filter((i) => i >= 0);
    if (others.length) {
      const swap = others[Math.floor(random() * others.length)];
      [right[ri], right[swap]] = [right[swap], right[ri]];
    }
  }
  return { left, right, queue };
}

export const boardEmpty = (board: Board) => board.left.every((c) => !c);

/** Points for a right match when it makes `streak` right matches in a row. */
export function pointsFor(streak: number): number {
  return streak >= 5 ? 20 : streak >= 3 ? 15 : 10;
}

/** Time left after a match: more for a right one, less for a wrong one, within 0..MAX_MS. */
export function timeAfter(msLeft: number, right: boolean): number {
  return Math.min(MAX_MS, Math.max(0, msLeft + (right ? BONUS_MS : -PENALTY_MS)));
}

/** "Calm" above 30 %, "hurry" above 10 %, "last" below (the bar's colour). */
export function timeTone(msLeft: number): "calm" | "hurry" | "last" {
  const share = msLeft / START_MS;
  return share > 0.3 ? "calm" : share > 0.1 ? "hurry" : "last";
}

export function accuracy(right: number, wrong: number): number {
  return right + wrong === 0 ? 100 : Math.round((right / (right + wrong)) * 100);
}
