// A reader's own private PDF as a page source for the full book reader (BookReader): the same
// screen as a library book (Uzyra on one side, the page on the other, slides, the circle), with
// the pages drawn here on the device from the PDF instead of read from prepared pictures. The
// file is opened in parts from a signed link, so only the pages being read are downloaded, and
// pages are drawn one at a time so a tablet never draws a dozen at once. Bookmarks and the
// reading place stay on this device; nothing about the book is stored on the server.
import type { BookManifest, PageHit, PageView, PageWords } from "@/lib/book-reader-data";
import {
  cleanOutline,
  matchForm,
  pageTextFromItems,
  type ManifestPage,
  type TextItemLike,
  type ViewportLike,
} from "@/lib/books-reader";
import { drawWidth, placeKey, snippetAround, textDirection, type UserBook } from "@/lib/user-books";
import { openMyBook, type OpenStage, type PdfDoc } from "./my-book-pdf";

/** What `?debug=1` shows on the reader: where the time went, measured on this device. */
export type MyBookDebug = {
  /** pdf.js on its own worker thread, or on the page itself (slower; it can stall the screen). */
  mode: "worker" | "page" | "?";
  from: "device" | "network";
  /** The server answers parts of the file (206), the whole file (200), or the check failed. */
  parts: string;
  /** Milliseconds: the file opened; the first page drawn; its words read. */
  openMs: number;
  firstPageMs: number | null;
  /** Selectable words found on each page read so far. */
  words: Record<number, number>;
  /** The page drawings that took longest, in milliseconds. */
  slowestDrawMs: number;
};

export type MyBookSource = {
  /** Every page's size (the first page's for all; the true one comes with each page) and outline. */
  manifest: BookManifest;
  total: number;
  /** The page drawn at about `need` pixels wide, as a picture address kept until `release`. */
  view(page: number, need: number): Promise<PageView>;
  words(page: number): Promise<PageWords>;
  search(query: string, signal?: AbortSignal): Promise<PageHit[]>;
  bookmarks(): number[];
  setBookmark(page: number, on: boolean): void;
  savePlace(page: number): void;
  /** The picture of `path` is no longer cached by the reader: its address can go. */
  release(path: string): void;
  close(): void;
  /** The book's outline, read after the first page is on screen (an outline can be long). */
  outlineLater: Promise<BookManifest["outline"]>;
  debug: MyBookDebug;
};

/** Search reads at most this many pages (a private book is at most 50 MB). */
const SEARCH_PAGES = 800;
const SEARCH_HITS = 60;

export function marksKey(bookId: string) {
  return `uzyra-my-book-marks:${bookId}`;
}

export function readPlace(bookId: string): number | null {
  try {
    const n = Number(window.localStorage.getItem(placeKey(bookId)));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

type OutlineNode = { title?: string; dest?: unknown; items?: OutlineNode[] };

async function readOutline(doc: PdfDoc, total: number): Promise<[string, number, number][]> {
  const nodes = ((await doc.getOutline().catch(() => null)) ?? []) as OutlineNode[];
  const flat: { title: string; page: number | null; level: number }[] = [];
  const walk = async (list: OutlineNode[], level: number) => {
    for (const node of list) {
      if (flat.length >= 300) return;
      let page: number | null = null;
      try {
        const dest =
          typeof node.dest === "string" ? await doc.getDestination(node.dest) : node.dest;
        const ref = Array.isArray(dest) ? dest[0] : null;
        if (ref && typeof ref === "object") page = (await doc.getPageIndex(ref)) + 1;
        else if (typeof ref === "number") page = ref + 1;
      } catch {
        page = null;
      }
      flat.push({ title: String(node.title ?? ""), page, level });
      if (node.items?.length && level < 3) await walk(node.items, level + 1);
    }
  };
  await walk(nodes, 0);
  return cleanOutline(flat, total);
}

/** The widest page drawing when pdf.js runs on the page itself (smaller drawings stall less). */
const PAGE_MODE_MAX_WIDTH = 1100;

/** Opens the book; throws when the file cannot be read. */
export async function openMyBookSource(
  book: UserBook,
  {
    onStage,
    debug: measure = false,
  }: { onStage?: (stage: OpenStage) => void; debug?: boolean } = {},
): Promise<MyBookSource> {
  const began = performance.now();
  const { doc, from, link }: { doc: PdfDoc; from: "device" | "network"; link: string | null } =
    await openMyBook(book, onStage);
  const { pdfMode } = await import("@/lib/pdf-page-render");
  const onPage = pdfMode() === "page";
  const debug: MyBookDebug = {
    mode: pdfMode() ?? "?",
    from,
    parts: from === "device" ? "device copy" : "…",
    openMs: Math.round(performance.now() - began),
    firstPageMs: null,
    words: {},
    slowestDrawMs: 0,
  };
  if (measure && link)
    void fetch(link, { headers: { Range: "bytes=0-1" } })
      .then((r) => {
        debug.parts = `${r.status}${r.headers.get("content-range") ? " +range" : ""}`;
        return r.body?.cancel();
      })
      .catch(() => {
        debug.parts = "check failed";
      });
  const total = Math.max(1, Number(doc.numPages) || 1);
  const first = await doc.getPage(1);
  const base = first.getViewport({ scale: 1 });

  const words = new Map<number, Promise<PageWords>>();
  const readWords = (page: number): Promise<PageWords> => {
    const have = words.get(page);
    if (have) return have;
    const job = (async () => {
      const pdfPage = await doc.getPage(page);
      const viewport = pdfPage.getViewport({ scale: 1 }) as ViewportLike;
      const content = await pdfPage.getTextContent();
      const { text, runs } = pageTextFromItems(content.items as TextItemLike[], viewport);
      debug.words[page] = runs.length;
      return { page, text, runs };
    })();
    words.set(page, job);
    job.catch(() => words.delete(page));
    // Only the words of recent pages stay in memory.
    if (words.size > 60) words.delete(words.keys().next().value as number);
    return job;
  };

  // The first page's words decide the book's direction; a slow page does not hold the book up.
  const firstWords = await Promise.race([
    readWords(1).catch(() => null),
    new Promise<null>((done) => setTimeout(() => done(null), 1500)),
  ]);
  const shape: Omit<ManifestPage, "page"> = {
    width: base.width,
    height: base.height,
    hasText: true,
    type: "jpeg",
    tiers: [],
    thumbhash: null,
    color: null,
  };
  const manifest: BookManifest = {
    pages: Array.from({ length: total }, (_, i) => ({ page: i + 1, ...shape })),
    outline: [],
    dir: textDirection(firstWords?.text ?? ""),
  };
  let firstShown: () => void = () => undefined;
  const shown = new Promise<void>((done) => (firstShown = done));
  const outlineLater = shown
    .then(() => readOutline(doc, total))
    .catch(() => [] as BookManifest["outline"]);
  // Read from the network: once the first page is on screen and things are quiet, a copy of the
  // whole file is kept on this device, so the next visit opens from here.
  if (from === "network" && link)
    void shown.then(() =>
      setTimeout(() => {
        void import("./my-book-file").then(({ keepMyBookFileFrom }) =>
          keepMyBookFileFrom(book, link),
        );
      }, 2500),
    );

  // One page is drawn at a time; the reader asks for the page on screen first.
  let queue: Promise<unknown> = Promise.resolve();
  const urls = new Map<string, string>();
  const drawing = new Map<string, Promise<PageView>>();
  let closed = false;

  const view = (page: number, need: number): Promise<PageView> => {
    const width = onPage ? Math.min(PAGE_MODE_MAX_WIDTH, drawWidth(need)) : drawWidth(need);
    const path = `mine/${book.id}/${page}/${width}`;
    const running = drawing.get(path);
    if (running) return running;
    // The page's words (needed anyway to select on it) say whether it has any text at all. They
    // are read beside the drawing, never holding the next page's drawing up.
    const text = readWords(page).catch(() => null);
    const hasText = async () => {
      const found = await Promise.race([
        text,
        new Promise<"slow">((done) => setTimeout(() => done("slow"), 1200)),
      ]);
      return found === "slow" || found === null || found.runs.length > 0;
    };
    const drawn = queue.then(async (): Promise<Omit<PageView, "hasText">> => {
      if (closed) throw new Error("closed");
      // On the page itself, a breath between drawings lets taps and selection through.
      if (onPage) await new Promise((done) => setTimeout(done, 16));
      const started = performance.now();
      const pdfPage = await doc.getPage(page);
      const size = pdfPage.getViewport({ scale: 1 });
      const known = urls.get(path);
      const meta = { page, width: size.width, height: size.height, imagePath: path };
      if (known) return { ...meta, url: known };
      const viewport = pdfPage.getViewport({ scale: width / size.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no_canvas");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await pdfPage.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((done) =>
        canvas.toBlob(done, "image/jpeg", 0.88),
      );
      // The canvas' memory goes at once (tablets keep only a little for canvases).
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) throw new Error("no_picture");
      const url = URL.createObjectURL(blob);
      urls.set(path, url);
      debug.slowestDrawMs = Math.max(debug.slowestDrawMs, Math.round(performance.now() - started));
      if (debug.firstPageMs === null) {
        debug.firstPageMs = Math.round(performance.now() - began);
        firstShown();
      }
      return { ...meta, url };
    });
    queue = drawn.catch(() => undefined);
    const job = drawn.then(async (picture) => ({ ...picture, hasText: await hasText() }));
    drawing.set(path, job);
    void job.finally(() => drawing.delete(path)).catch(() => undefined);
    return job;
  };

  const search = async (query: string, signal?: AbortSignal): Promise<PageHit[]> => {
    const wanted = matchForm(query).trim();
    if (!wanted) return [];
    const hits: PageHit[] = [];
    for (let page = 1; page <= Math.min(total, SEARCH_PAGES); page++) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      const { text } = await readWords(page).catch(() => ({ text: "" }));
      const at = text.toLowerCase().indexOf(query.trim().toLowerCase());
      if (at >= 0) hits.push({ page, snippet: snippetAround(text, at, query.trim().length) });
      if (hits.length >= SEARCH_HITS) break;
    }
    return hits;
  };

  const readMarks = (): number[] => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(marksKey(book.id)) ?? "[]");
      return Array.isArray(saved)
        ? [...new Set(saved.filter((n) => Number.isInteger(n) && n >= 1 && n <= total))].sort(
            (a, b) => a - b,
          )
        : [];
    } catch {
      return [];
    }
  };

  return {
    manifest,
    total,
    view,
    words: readWords,
    search,
    bookmarks: readMarks,
    setBookmark(page, on) {
      const now = readMarks().filter((n) => n !== page);
      const next = on ? [...now, page].sort((a, b) => a - b) : now;
      window.localStorage.setItem(marksKey(book.id), JSON.stringify(next));
    },
    savePlace(page) {
      try {
        window.localStorage.setItem(placeKey(book.id), String(page));
      } catch {
        /* kept for this visit only */
      }
    },
    release(path) {
      const url = urls.get(path);
      if (!url) return;
      urls.delete(path);
      // The reader's picture cache may still be decoding from it for a moment.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
    outlineLater,
    debug,
    close() {
      closed = true;
      firstShown();
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
      void doc.destroy?.();
    },
  };
}
