// Preparing a library book for reading (admins only, in their own browser; nothing runs on a
// timer or on the server). The PDF is opened in parts (see openPdfInParts), and page by page, in
// one pass: drawn once (2200 px on a computer, 1400 px on an iPad or phone, to spare memory) and
// saved in every size the reader uses — 160 px (scrubber, previews), 900 px (phones), 1400 px
// (the original size) and 2200 px (zoom, when drawn that large) — as WebP (through WebAssembly
// encoders in up to three workers where the browser cannot make WebP, as Safari; JPEG if that
// fails too). A page's sizes are encoded at the same time, and the next page is drawn meanwhile;
// with a ~25-byte ThumbHash and the page's main colour for an instant blurred placeholder, and its
// words with their places. Rows are written 25 at a time. When every page is in, one manifest per
// book (sizes, previews, the PDF's outline, the reading direction) is written and
// books.prepared_at is set, so readers can open the book.
//
// Stopping and starting again picks up the missing pages; a book prepared before the sizes
// existed is "upgraded" the same way (only its pages without the new sizes are drawn again).
// On a database without the sizes migration, only the original size is made, as before.
//
// The job lives in this module (not in a dialog), so closing the editor does not stop it, and any
// screen showing the book sees its progress (usePrepareJobs).
import { useSyncExternalStore } from "react";
import { rgbaToThumbHash, thumbHashToAverageRGBA } from "thumbhash";
import { supabase } from "@/integrations/supabase/legacy-client";
import {
  PAGE_LIMITS,
  TIERS,
  bytesToBase64,
  cleanOutline,
  hexColor,
  manifestEntry,
  missingPages,
  pageTextFromItems,
  prepareRate,
  tierPath,
  type Tier,
} from "@/lib/books-reader";

export const PAGES_BUCKET = "book-pages";
const NOT_APPLIED = /could not find|does not exist|schema cache|PGRST20[0-9]|42883|42P01|42703/i;

export type ReaderState = {
  pageCount: number | null;
  preparedAt: string | null;
  /** Pages already written (only counted while preparing is unfinished). */
  done: number;
  /** Prepared with every size and a manifest (false: "upgrade" makes the missing sizes). */
  complete: boolean;
};

/** Each book's reader state, or null when the reader migration is not in the database yet. */
export async function loadReaderStates(): Promise<Map<string, ReaderState> | null> {
  const { data, error } = await supabase.from("books").select("id, page_count, prepared_at");
  if (error) {
    if (NOT_APPLIED.test(`${error.code ?? ""} ${error.message ?? ""}`)) return null;
    throw new Error(error.message);
  }
  const map = new Map<string, ReaderState>();
  for (const row of (data ?? []) as {
    id: string;
    page_count: number | null;
    prepared_at: string | null;
  }[])
    map.set(row.id, {
      pageCount: row.page_count,
      preparedAt: row.prepared_at,
      done: 0,
      complete: true,
    });
  // Books prepared before the sizes existed have no manifest yet.
  const manifests = await supabase.from("book_manifests").select("book_id");
  if (!manifests.error) {
    const have = new Set((manifests.data ?? []).map((row: { book_id: string }) => row.book_id));
    for (const [id, state] of map) state.complete = !state.preparedAt || have.has(id);
  }
  const unfinished = [...map].filter(([, s]) => s.pageCount && !s.preparedAt).map(([id]) => id);
  if (unfinished.length) {
    const counts = await Promise.all(
      unfinished.map((id) =>
        supabase
          .from("book_pages")
          .select("page", { count: "exact", head: true })
          .eq("book_id", id),
      ),
    );
    unfinished.forEach((id, i) => {
      const state = map.get(id);
      if (state) state.done = counts[i].count ?? 0;
    });
  }
  return map;
}

export type PrepareJob = {
  bookId: string;
  stage: "opening" | "pages" | "finishing" | "done" | "stopped" | "failed";
  done: number;
  total: number;
  /** Pages with no words (scanned pictures): shown as pictures only. */
  scanned: number;
  message: string;
  /** Pages per second over the last 30 pages, and the seconds left (null at first). */
  perSecond: number | null;
  secondsLeft: number | null;
};

// ---- the job store -----------------------------------------------------------------------------

const jobs = new Map<string, PrepareJob>();
const stops = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let snapshot: ReadonlyMap<string, PrepareJob> = new Map();

function publish(job: PrepareJob) {
  jobs.set(job.bookId, job);
  snapshot = new Map(jobs);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every job this visit started (running or finished). */
export function usePrepareJobs(): ReadonlyMap<string, PrepareJob> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

export function isRunning(job: PrepareJob | undefined): boolean {
  return Boolean(
    job && (job.stage === "opening" || job.stage === "pages" || job.stage === "finishing"),
  );
}

/** Asks a running job to stop after the page it is on. */
export function stopPreparing(bookId: string) {
  stops.get(bookId)?.abort();
}

// ---- drawing one page ---------------------------------------------------------------------------

const MAX_PICTURE_BYTES = 4.5 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** iPads and phones draw at 1400 px (no zoom size): a 2200 px page takes ~25 MB while drawn. */
function smallDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod|Android/i.test(ua) ||
    (/Macintosh/i.test(ua) && Number((navigator as { maxTouchPoints?: number }).maxTouchPoints) > 1)
  );
}

// The WebAssembly WebP encoder, in a few workers (made on first need), so a page's sizes are
// encoded at the same time and the next page is drawn meanwhile.
type Encoder = { worker: Worker; busy: number };
let encoders: Encoder[] = [];
let workerBroken = false;
let jobId = 0;
const waiting = new Map<number, (out: ArrayBuffer | null) => void>();

function poolSize(): number {
  const cores = Number(typeof navigator === "undefined" ? 0 : navigator.hardwareConcurrency) || 4;
  return Math.max(1, Math.min(3, cores - 1));
}

function giveUpOnWorkers() {
  workerBroken = true;
  for (const done of waiting.values()) done(null);
  waiting.clear();
  for (const { worker } of encoders) worker.terminate();
  encoders = [];
}

/** The least busy encoder, adding one while there are fewer than poolSize(). */
function freeEncoder(): Encoder {
  const idle = encoders.find((e) => e.busy === 0);
  if (idle) return idle;
  if (encoders.length < poolSize()) {
    const worker = new Worker(new URL("./webp-encode.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<{ id: number; out?: ArrayBuffer; error?: string }>) => {
      waiting.get(event.data.id)?.(event.data.out ?? null);
      waiting.delete(event.data.id);
    };
    worker.onerror = giveUpOnWorkers;
    const made = { worker, busy: 0 };
    encoders.push(made);
    return made;
  }
  return encoders.reduce((a, b) => (b.busy < a.busy ? b : a));
}

function wasmWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  if (workerBroken) return Promise.resolve(null);
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const encoder = freeEncoder();
    const id = ++jobId;
    encoder.busy += 1;
    return new Promise((resolve) => {
      // A worker that never answers (its WebAssembly would not load) must not stall the book:
      // after 30 s the page is made the other way and the workers are not used again.
      const stuck = window.setTimeout(() => {
        waiting.delete(id);
        giveUpOnWorkers();
        resolve(null);
      }, 30_000);
      waiting.set(id, (out) => {
        window.clearTimeout(stuck);
        encoder.busy = Math.max(0, encoder.busy - 1);
        resolve(out ? new Blob([out], { type: "image/webp" }) : null);
      });
      encoder.worker.postMessage(
        { id, width: canvas.width, height: canvas.height, data: pixels.data.buffer, quality },
        [pixels.data.buffer],
      );
    });
  } catch {
    giveUpOnWorkers();
    return Promise.resolve(null);
  }
}

/** For tests: "uzyra-force-wasm-webp" in localStorage makes Chrome use the Safari path. */
function forceWasm(): boolean {
  try {
    return window.localStorage.getItem("uzyra-force-wasm-webp") === "1";
  } catch {
    return false;
  }
}

/** Whether this browser's canvas makes WebP (null until the first page tells). */
let nativeWebp: boolean | null = null;

/** One size as WebP (the canvas's own, else WebAssembly), or JPEG when neither works. */
async function encode(
  canvas: HTMLCanvasElement,
  quality: number,
  allowJpeg: boolean,
): Promise<{ blob: Blob; type: "webp" | "jpeg" } | null> {
  for (const q of [quality, quality - 0.15, quality - 0.3]) {
    // Safari answers "image/webp" with a PNG: after the first try it is not asked again (making
    // that PNG cost as much as the WebP itself).
    let webp = nativeWebp === false || forceWasm() ? null : await toBlob(canvas, "image/webp", q);
    if (webp) nativeWebp ??= webp.type === "image/webp";
    if (!webp || webp.type !== "image/webp") webp = await wasmWebp(canvas, q);
    if (!webp) break;
    if (webp.size <= MAX_PICTURE_BYTES) return { blob: webp, type: "webp" };
  }
  if (!allowJpeg) return null;
  for (const q of [0.82, 0.65, 0.5, 0.35]) {
    const jpeg = await toBlob(canvas, "image/jpeg", q);
    if (jpeg && jpeg.type === "image/jpeg" && jpeg.size <= MAX_PICTURE_BYTES)
      return { blob: jpeg, type: "jpeg" };
  }
  return null;
}

function scaled(source: HTMLCanvasElement, width: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round((source.height * canvas.width) / source.width));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the pages.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function free(...canvases: (HTMLCanvasElement | null)[]) {
  // Safari keeps a canvas's memory until its size is set to nothing.
  for (const canvas of canvases) {
    if (!canvas) continue;
    canvas.width = 0;
    canvas.height = 0;
  }
}

type Pictures = { type: "webp" | "jpeg"; pictures: Partial<Record<Tier, Blob>> };

type Drawn = {
  /** The 1400 px picture's size (the size readers' pages are measured in). */
  width: number;
  height: number;
  /** The sizes, still being encoded (the next page is drawn meanwhile). */
  finish: Promise<Pictures>;
  thumbhash: string | null;
  color: string | null;
  text: string;
  runs: ReturnType<typeof pageTextFromItems>["runs"];
};

/** Every size at once: the original decides the type, and the others must match it. */
async function encodeAll(
  pageNumber: number,
  std: HTMLCanvasElement,
  extras: [Tier, HTMLCanvasElement][],
): Promise<Pictures> {
  const [main, ...others] = await Promise.all([
    encode(std, TIERS.std.quality, true),
    ...extras.map(([tier, canvas]) => encode(canvas, TIERS[tier].quality, true)),
  ]);
  if (!main) throw new Error(`Page ${pageNumber} could not be turned into a picture.`);
  const pictures: Partial<Record<Tier, Blob>> = { std: main.blob };
  extras.forEach(([tier], i) => {
    const out = others[i];
    if (out && out.type === main.type) pictures[tier] = out.blob;
  });
  return { type: main.type, pictures };
}

/** Draws the page in every size and reads its words; the sizes finish encoding afterwards. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function drawPage(doc: any, pageNumber: number, withTiers: boolean): Promise<Drawn> {
  const page = await doc.getPage(pageNumber);
  let big: HTMLCanvasElement | null = null;
  let std: HTMLCanvasElement | null = null;
  let mid: HTMLCanvasElement | null = null;
  let thumb: HTMLCanvasElement | null = null;
  const release = () => free(big, std !== big ? std : null, mid, thumb);
  try {
    const base = page.getViewport({ scale: 1 });
    const drawWidth = withTiers && !smallDevice() ? TIERS.zoom.width : TIERS.std.width;
    const scale = Math.min(6, Math.max(0.5, drawWidth / base.width));
    const viewport = page.getViewport({ scale });
    big = document.createElement("canvas");
    big.width = Math.ceil(viewport.width);
    big.height = Math.ceil(viewport.height);
    const ctx = big.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw the pages.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, big.width, big.height);
    await page.render({ canvasContext: ctx, viewport, canvas: big }).promise;

    std = big.width > TIERS.std.width + 2 ? scaled(big, TIERS.std.width) : big;
    const extras: [Tier, HTMLCanvasElement][] = [];
    let thumbhash: string | null = null;
    let color: string | null = null;
    if (withTiers) {
      if (big !== std) extras.push(["zoom", big]);
      mid = scaled(std, TIERS.mid.width);
      thumb = scaled(mid, TIERS.thumb.width);
      extras.push(["mid", mid], ["thumb", thumb]);
      // ThumbHash wants at most 100 px on a side.
      const tiny = scaled(
        thumb,
        Math.min(100, Math.round((100 * thumb.width) / Math.max(thumb.width, thumb.height))),
      );
      const tctx = tiny.getContext("2d");
      if (tctx) {
        const px = tctx.getImageData(0, 0, tiny.width, tiny.height);
        const hash = rgbaToThumbHash(tiny.width, tiny.height, px.data);
        thumbhash = bytesToBase64(hash);
        const avg = thumbHashToAverageRGBA(hash);
        color = hexColor(avg.r, avg.g, avg.b);
      }
      free(tiny);
    }
    const width = std.width;
    const height = std.height;
    // The canvases are let go once every size is made.
    const finish = encodeAll(pageNumber, std, extras);
    void finish.then(release, release);

    try {
      // Words are measured on the page itself, so they fit every size.
      const content = await page.getTextContent({ includeMarkedContent: false });
      const words = pageTextFromItems(
        content.items ?? [],
        page.getViewport({ scale: width / base.width }),
      );
      return { width, height, finish, thumbhash, color, ...words };
    } catch (error) {
      await finish.catch(() => null);
      throw error;
    } finally {
      page.cleanup?.();
    }
  } catch (error) {
    release();
    page.cleanup?.();
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readOutline(doc: any, total: number): Promise<[string, number, number][]> {
  try {
    const outline = await doc.getOutline();
    if (!outline?.length) return [];
    const flat: { title: string; page: number | null; level: number }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = async (items: any[], level: number) => {
      for (const item of items) {
        if (flat.length >= 2000) return;
        let page: number | null = null;
        try {
          const dest =
            typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
          if (Array.isArray(dest) && dest[0]) page = (await doc.getPageIndex(dest[0])) + 1;
        } catch {
          page = null;
        }
        flat.push({ title: String(item.title ?? ""), page, level });
        if (item.items?.length) await walk(item.items, level + 1);
      }
    };
    await walk(outline, 0);
    return cleanOutline(flat, total);
  } catch {
    return [];
  }
}

// ---- the job -------------------------------------------------------------------------------------

async function clearPages(bookId: string) {
  const { error } = await supabase.from("book_pages").delete().eq("book_id", bookId);
  if (error) throw new Error(error.message);
  await supabase.from("book_manifests").delete().eq("book_id", bookId);
  // The pictures, in the book's folder and its size folders, a thousand at a time.
  for (const folder of [bookId, `${bookId}/t`, `${bookId}/m`, `${bookId}/z`]) {
    for (;;) {
      const { data, error: listError } = await supabase.storage
        .from(PAGES_BUCKET)
        .list(folder, { limit: 1000 });
      const files = (data ?? []).filter((item) => item.id);
      if (listError || !files.length) break;
      const { error: removeError } = await supabase.storage
        .from(PAGES_BUCKET)
        .remove(files.map((item) => `${folder}/${item.name}`));
      if (removeError) break;
    }
  }
}

/** Whether the database has the picture sizes (migration 20261115120000). */
async function hasTiers(): Promise<boolean> {
  const { error } = await supabase.from("book_pages").select("thumb_path").limit(0);
  return !error;
}

type PageRow = {
  page: number;
  width: number;
  height: number;
  image_path: string;
  has_text: boolean;
  thumb_path?: string | null;
  mid_path?: string | null;
  zoom_path?: string | null;
  thumbhash?: string | null;
  color?: string | null;
};

/** Every page's light row, in order, a thousand at a time. */
async function allRows(bookId: string, total: number): Promise<PageRow[]> {
  const rows: PageRow[] = [];
  for (let from = 1; from <= total; from += 1000) {
    const { data, error } = await supabase
      .from("book_pages")
      .select(
        "page, width, height, image_path, has_text, thumb_path, mid_path, zoom_path, thumbhash, color",
      )
      .eq("book_id", bookId)
      .gte("page", from)
      .lte("page", Math.min(total, from + 999))
      .order("page");
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as PageRow[]));
  }
  return rows;
}

/** Warns before the tab closes while a book is being prepared. */
function holdTab(on: boolean) {
  if (typeof window === "undefined") return;
  const warn = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = "";
  };
  if (on) window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}

/**
 * Prepares (or finishes, or upgrades) a book. `file` is the PDF on this device when the admin has
 * it (opened in parts, nothing downloaded); otherwise the saved PDF is read through a signed link.
 * With `again`, the old pages are removed first.
 */
export async function prepareBook(options: {
  bookId: string;
  filePath: string;
  file?: File | null;
  again?: boolean;
}): Promise<PrepareJob> {
  const { bookId } = options;
  if (isRunning(jobs.get(bookId))) return jobs.get(bookId)!;
  const stop = new AbortController();
  stops.set(bookId, stop);
  let job: PrepareJob = {
    bookId,
    stage: "opening",
    done: 0,
    total: 0,
    scanned: 0,
    message: "",
    perSecond: null,
    secondsLeft: null,
  };
  const update = (patch: Partial<PrepareJob>) => {
    job = { ...job, ...patch };
    publish(job);
  };
  update({});
  const release = holdTab(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any = null;
  try {
    const { openPdfInParts } = await import("@/lib/pdf-page-render");
    let source: File | string;
    if (options.file) source = options.file;
    else {
      const { data, error } = await supabase.storage
        .from("book-files")
        .createSignedUrl(options.filePath, 3600);
      if (error || !data?.signedUrl) throw new Error("ما قدرت أفتح ملف الكتاب.");
      source = data.signedUrl;
    }
    doc = await openPdfInParts(source);
    const total = Math.min(Number(doc.numPages) || 0, PAGE_LIMITS.pages);
    if (!total) throw new Error("الملف ما فيه صفحات.");

    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("page_count, prepared_at, file_path, language")
      .eq("id", bookId)
      .single();
    if (bookError) throw new Error(bookError.message);
    if (book.file_path !== options.filePath)
      throw new Error("تغيّر ملف الكتاب. افتح المحرر مرة ثانية.");
    const withTiers = await hasTiers();
    const fresh = options.again || book.page_count !== total;
    if (fresh) await clearPages(bookId);
    const { error: startError } = await supabase
      .from("books")
      .update({ page_count: total, prepared_at: null })
      .eq("id", bookId);
    if (startError) throw new Error(startError.message);

    // A page is done when its row is there (with its sizes, on a database that has them).
    let doneRows: { page: number; has_text: boolean }[] = [];
    if (!fresh) {
      const { data: have } = await supabase
        .from("book_pages")
        .select(withTiers ? "page, has_text, thumb_path" : "page, has_text")
        .eq("book_id", bookId);
      doneRows = (
        (have ?? []) as unknown as { page: number; has_text: boolean; thumb_path?: string | null }[]
      ).filter((row) => !withTiers || row.thumb_path);
    }
    const todo = missingPages(
      total,
      doneRows.map((row) => row.page),
    );
    update({
      stage: "pages",
      total,
      done: total - todo.length,
      scanned: doneRows.filter((row) => !row.has_text).length,
    });

    // One page is drawn while the ones before it encode and upload (up to four, two on an iPad);
    // rows are written 25 at a time.
    const uploads = new Set<Promise<void>>();
    const finished: number[] = [];
    let rows: Record<string, unknown>[] = [];
    let failure: unknown = null;
    const flush = async () => {
      if (!rows.length) return;
      const batch = rows;
      rows = [];
      const { error } = await supabase.from("book_pages").upsert(batch);
      if (error) throw new Error(error.message);
    };
    for (const pageNumber of todo) {
      if (stop.signal.aborted || failure) break;
      const drawn = await drawPage(doc, pageNumber, withTiers);
      const upload = (async () => {
        const made = await drawn.finish;
        const paths: Partial<Record<Tier, string>> = {};
        await Promise.all(
          (Object.entries(made.pictures) as [Tier, Blob][]).map(async ([tier, blob]) => {
            const path = tierPath(bookId, pageNumber, tier, made.type);
            const { error } = await supabase.storage.from(PAGES_BUCKET).upload(path, blob, {
              upsert: true,
              contentType: made.type === "webp" ? "image/webp" : "image/jpeg",
              cacheControl: "31536000",
            });
            if (error) throw new Error(error.message);
            paths[tier] = path;
          }),
        );
        rows.push({
          book_id: bookId,
          page: pageNumber,
          width: drawn.width,
          height: drawn.height,
          image_path: paths.std,
          text: drawn.text,
          runs: drawn.runs,
          ...(withTiers
            ? {
                thumb_path: paths.thumb ?? null,
                mid_path: paths.mid ?? null,
                zoom_path: paths.zoom ?? null,
                thumbhash: drawn.thumbhash,
                color: drawn.color,
              }
            : {}),
        });
        if (rows.length >= 25) await flush();
        finished.push(Date.now());
        const rate = prepareRate(finished, todo.length - finished.length);
        update({
          done: job.done + 1,
          scanned: job.scanned + (drawn.text ? 0 : 1),
          perSecond: rate?.perSecond ?? null,
          secondsLeft: rate?.secondsLeft ?? null,
        });
      })().catch((error) => {
        failure = failure ?? error;
      });
      uploads.add(upload);
      void upload.finally(() => uploads.delete(upload));
      // Pages still encoding or uploading: fewer on an iPad or phone, to spare memory.
      if (uploads.size >= (smallDevice() ? 2 : 4)) await Promise.race(uploads);
    }
    await Promise.all(uploads);
    // Rows already uploaded are kept even when stopping, so "continue" skips them.
    await flush();
    if (failure) throw failure;
    if (stop.signal.aborted) {
      update({ stage: "stopped", message: "وقّفنا. اكبس «كمّل التجهيز» لتكمّل من وين وقفت." });
      return job;
    }

    update({ stage: "finishing", secondsLeft: null });
    if (withTiers) {
      const all = await allRows(bookId, total);
      if (all.length !== total) throw new Error("في صفحات ناقصة. اكبس «كمّل التجهيز».");
      const { error: manifestError } = await supabase.from("book_manifests").upsert({
        book_id: bookId,
        pages: all.map(manifestEntry),
        outline: await readOutline(doc, total),
        dir: /^(ar|fa|ur|he)/.test(String(book.language ?? "")) ? "rtl" : "ltr",
        version: 1,
        updated_at: new Date().toISOString(),
      });
      if (manifestError) throw new Error(manifestError.message);
    }
    const { error: doneError } = await supabase
      .from("books")
      .update({ prepared_at: new Date().toISOString() })
      .eq("id", bookId);
    if (doneError) throw new Error(doneError.message);
    update({ stage: "done", message: "" });
    return job;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    update({
      stage: "failed",
      message: NOT_APPLIED.test(message)
        ? "القراءة داخل الموقع بتشتغل بعد تطبيق ملف قاعدة البيانات الجديد."
        : message.slice(0, 300) || "ما زبط التجهيز. جرّب مرة ثانية.",
    });
    return job;
  } finally {
    release?.();
    stops.delete(bookId);
    try {
      await doc?.destroy?.();
    } catch {
      /* already gone */
    }
  }
}
