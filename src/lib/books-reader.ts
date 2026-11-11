// The book reader's pure parts, shared by the admin's preparation (browser), the reader (browser)
// and the server's checks. Tested with node (books-reader.test.ts).
//
// A prepared page is a picture plus its words: every piece of text pdf.js finds, with where it sits
// on the page as parts of the page's width and height (0 to 1), so the reader can lay the words over
// the picture at any size. The page's text is those pieces in the same order, which is also the
// order the browser reads them back when the reader selects across several of them.
import { MAX_SELECTION_CHARS } from "./study/study-limits.ts";
import type { SelectionKind } from "./study/study-actions.ts";

/** [text, left, top, width, height]; the four numbers are parts of the page (0 to 1). */
export type PageRun = [string, number, number, number, number];

/** The parts of a pdf.js text item that are used here. */
export type TextItemLike = {
  str?: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
};

/** The parts of a pdf.js viewport that are used here. */
export type ViewportLike = { width: number; height: number; scale: number; transform: number[] };

export const PAGE_LIMITS = { text: 60000, runs: 4000, pages: 5000 } as const;
/** The picture's width in pixels: sharp on a tablet at full width, ~100–250 KB as WebP. */
export const PAGE_IMAGE_WIDTH = 1400;
/** How far around the selection the page's text is given to Rita as context. */
export const BOOK_CONTEXT_CHARS = 2400;

/** pdf.js' Util.transform: the product of two [a, b, c, d, e, f] matrices. */
function multiply(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

const round = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100000) / 100000;

/**
 * The page's words and their places, from pdf.js' getTextContent() items and the viewport the
 * page is drawn with. Turned (rotated) text is left out of both, so the text always matches what
 * the reader can select.
 */
export function pageTextFromItems(
  items: TextItemLike[],
  viewport: ViewportLike,
): { text: string; runs: PageRun[] } {
  const runs: PageRun[] = [];
  const parts: string[] = [];
  let length = 0;
  for (const item of items) {
    const str = String(item.str ?? "").replace(/\s+/g, " ");
    if (!str.trim()) {
      if (item.hasEOL && parts.length) parts.push("\n");
      continue;
    }
    if (!Array.isArray(item.transform) || item.transform.length < 6) continue;
    const tx = multiply(viewport.transform, item.transform);
    // Only text that runs left to right on the page (no turned or vertical text).
    if (Math.abs(tx[1]) > 0.01 * Math.abs(tx[0]) || tx[0] <= 0) continue;
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const width = Math.max(0, Number(item.width ?? 0)) * viewport.scale;
    if (!fontHeight || !width) continue;
    if (runs.length >= PAGE_LIMITS.runs || length + str.length > PAGE_LIMITS.text) break;
    // The baseline is at tx[5]; most fonts rise about 0.8 of their size above it (as pdf.js does).
    const top = tx[5] - fontHeight * 0.8;
    runs.push([
      str,
      round(tx[4] / viewport.width),
      round(top / viewport.height),
      round(width / viewport.width),
      round(fontHeight / viewport.height),
    ]);
    parts.push(str);
    length += str.length + 1;
    parts.push(item.hasEOL ? "\n" : " ");
  }
  const text = parts
    .join("")
    .split("\n")
    .map((line) => line.replace(/ +/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { text, runs };
}

/** Reads back the runs saved in book_pages, dropping anything that is not a run. */
export function readRuns(value: unknown): PageRun[] {
  if (!Array.isArray(value)) return [];
  const out: PageRun[] = [];
  for (const run of value) {
    if (!Array.isArray(run) || run.length < 5 || typeof run[0] !== "string") continue;
    const numbers = run.slice(1, 5).map(Number);
    if (numbers.some((n) => !Number.isFinite(n))) continue;
    out.push([run[0], numbers[0], numbers[1], numbers[2], numbers[3]]);
  }
  return out;
}

/** For "is this selection on the page": one form, no spaces, no soft hyphens, lower case. */
export function matchForm(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u00AD\u200B-\u200F\u2028\u2029\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Whether the reader's selection is really on the page (spaces and line breaks do not count). */
export function selectionOnPage(selection: string, pageText: string): boolean {
  const wanted = matchForm(selection);
  return wanted.length > 0 && matchForm(pageText).includes(wanted);
}

/**
 * The selection as the page writes it (the page's own text, never the browser's), and the page's
 * text around it for Rita. Null when the selection is not on the page.
 */
export function pageQuote(
  selection: string,
  pageText: string,
  maxContext = BOOK_CONTEXT_CHARS,
): { quote: string; context: string } | null {
  const wanted = matchForm(selection);
  if (!wanted) return null;
  // The page's text without spaces, and where each of its letters is in the page's text.
  const positions: number[] = [];
  let compact = "";
  for (let i = 0; i < pageText.length; i++) {
    const piece = matchForm(pageText[i]);
    for (let k = 0; k < piece.length; k++) positions.push(i);
    compact += piece;
  }
  const at = compact.indexOf(wanted);
  if (at < 0) return null;
  const start = positions[at];
  const end = positions[at + wanted.length - 1] + 1;
  const quote = pageText.slice(start, end).replace(/\s+/g, " ").trim();
  const room = Math.max(0, maxContext - quote.length);
  // Half the room before the selection and the rest after; room one side does not use goes to the other.
  const span = end - start + room;
  let from = Math.max(0, start - Math.floor(room / 2));
  const to = Math.min(pageText.length, from + span);
  from = Math.max(0, Math.min(from, to - span));
  return { quote, context: pageText.slice(from, to).trim() };
}

const LETTER = /\p{L}/u;
const LATIN = /[A-Za-zÀ-ÿ]/;

/** What kind of piece of a page the reader selected (decides which circle actions fit). */
export function bookSelectionKind(exact: string): SelectionKind {
  const text = exact.replace(/\s+/g, " ").trim();
  if (!text || !LETTER.test(text)) return "non_text";
  if (text.length > MAX_SELECTION_CHARS) return "too_long";
  if (!LATIN.test(text)) return "arabic_only";
  const words = text.split(" ").filter((word) => LETTER.test(word)).length;
  if (words <= 1) return "word";
  if (words <= 6 && !/[.!?؟]["'”’)]?$/.test(text)) return "phrase";
  return "sentence";
}

/** The page the reader asked for, kept inside the book. */
export function clampPage(page: unknown, pageCount: number): number {
  const n = Math.floor(Number(page));
  const last = Math.max(1, Math.floor(pageCount) || 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, last);
}

/** Where a page's picture lives in the book-pages bucket. */
export function pageImagePath(bookId: string, page: number, type: "webp" | "jpeg"): string {
  return `${bookId}/${page}.${type === "webp" ? "webp" : "jpg"}`;
}

/** The pages still missing, in order (preparing again after a stop picks up from here). */
export function missingPages(pageCount: number, done: Iterable<number>): number[] {
  const have = new Set(done);
  const out: number[] = [];
  for (let page = 1; page <= pageCount; page++) if (!have.has(page)) out.push(page);
  return out;
}

// ---- Loading pages fast (the reader) -----------------------------------------------------------
// Light page info comes in blocks of 40 pages, picture links are signed in batches and reused for
// hours, and pictures are fetched ahead in the reading direction once the reader settles.

/** Pages per block of light page info (size and picture path), read in one request. */
export const META_BLOCK = 40;
/** A signed picture link lasts this long… */
export const LINK_LIFETIME_S = 6 * 3600;
/** …and is signed again this long before it ends. */
export const LINK_MARGIN_MS = 10 * 60 * 1000;
/** Most paths signed in one call. */
export const SIGN_BATCH = 50;
/** Heavy work (the full picture, the words) waits until the page has stayed this long. */
export const SETTLE_MS = 150;

/** Which block of light page info holds a page, and the pages of a block. */
export function metaBlock(page: number): number {
  return Math.floor((Math.max(1, page) - 1) / META_BLOCK);
}
export function blockPages(block: number, total: number): [number, number] {
  const from = block * META_BLOCK + 1;
  return [from, Math.min(total, from + META_BLOCK - 1)];
}

export type LinkEntry = { url: string; exp: number };

/** The paths that need a new link: never signed, or ending within the margin. No repeats. */
export function linksToSign(
  paths: string[],
  cache: Record<string, LinkEntry | undefined>,
  now: number,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const path of paths) {
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const entry = cache[path];
    if (!entry || entry.exp - LINK_MARGIN_MS <= now) out.push(path);
  }
  return out;
}

/** Drops links that have ended, so the stored list never grows without end. */
export function pruneLinks(
  cache: Record<string, LinkEntry>,
  now: number,
  max = 2000,
): Record<string, LinkEntry> {
  const live = Object.entries(cache)
    .filter(([, entry]) => entry && entry.exp - LINK_MARGIN_MS > now)
    .sort((a, b) => b[1].exp - a[1].exp)
    .slice(0, max);
  return Object.fromEntries(live);
}

/** The pages whose links are signed together with this one: 30 ahead and 10 behind. */
export function signWindow(page: number, total: number, dir: 1 | -1): number[] {
  const out: number[] = [];
  for (let step = -10; step <= 30; step++) {
    const n = page + step * dir;
    if (n >= 1 && n <= total) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/**
 * How many pictures to fetch ahead: 3 normally, 5 while skimming (the last three turns came
 * less than 8 s apart), 1 on a slow connection (the last picture took over 1.5 s).
 */
export function aheadCount(turns: number[], lastPictureMs: number | null): number {
  if (lastPictureMs !== null && lastPictureMs > 1500) return 1;
  const recent = turns.slice(-4);
  if (recent.length >= 4 && recent.every((t, i) => i === 0 || t - recent[i - 1] < 8000)) return 5;
  return 3;
}

/** What to fetch around a settled page: pictures ahead and one behind, words two ahead and one behind. */
export function prefetchPlan(
  page: number,
  dir: 1 | -1,
  total: number,
  ahead: number,
): { pictures: number[]; words: number[] } {
  const inside = (n: number) => n >= 1 && n <= total;
  const pictures: number[] = [];
  for (let i = 1; i <= ahead; i++) if (inside(page + i * dir)) pictures.push(page + i * dir);
  if (inside(page - dir)) pictures.push(page - dir);
  const words = [page + dir, page + 2 * dir, page - dir].filter(inside);
  return { pictures, words };
}
