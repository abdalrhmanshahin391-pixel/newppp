// Preparing a library book for reading (admins only, in their own browser; nothing runs on a
// timer or on the server). The PDF is opened in parts (see openPdfInParts), and page by page:
// drawn to a light picture (WebP, or JPEG where the browser cannot make WebP), its words read with
// their places (books-reader.ts), the picture uploaded to "book-pages/<book>/<page>.<ext>" and the
// page's row written to book_pages. Stopping and starting again picks up the missing pages. When
// every page is in, books.prepared_at is set and readers can open the book.
//
// The job lives in this module (not in a dialog), so closing the editor does not stop it, and any
// screen showing the book sees its progress (usePrepareJob).
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/legacy-client";
import {
  PAGE_IMAGE_WIDTH,
  PAGE_LIMITS,
  missingPages,
  pageImagePath,
  pageTextFromItems,
} from "@/lib/books-reader";

export const PAGES_BUCKET = "book-pages";
const MAX_PICTURE_BYTES = 4.5 * 1024 * 1024;
const NOT_APPLIED = /could not find|does not exist|schema cache|PGRST20[0-9]|42883|42P01|42703/i;

export type ReaderState = {
  pageCount: number | null;
  preparedAt: string | null;
  /** Pages already written (only counted while preparing is unfinished). */
  done: number;
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
    map.set(row.id, { pageCount: row.page_count, preparedAt: row.prepared_at, done: 0 });
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

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** The page as a picture (WebP where the browser can make it, JPEG otherwise) and its words. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function drawPage(doc: any, pageNumber: number) {
  const page = await doc.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, Math.max(0.5, PAGE_IMAGE_WIDTH / base.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw the pages.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    let picture: Blob | null = null;
    let type: "webp" | "jpeg" = "webp";
    for (const quality of [0.8, 0.65, 0.5]) {
      const webp = await toBlob(canvas, "image/webp", quality);
      if (!webp || webp.type !== "image/webp") break; // Safari makes PNG instead: use JPEG
      if (webp.size <= MAX_PICTURE_BYTES) {
        picture = webp;
        break;
      }
    }
    if (!picture) {
      type = "jpeg";
      for (const quality of [0.82, 0.65, 0.5, 0.35]) {
        const jpeg = await toBlob(canvas, "image/jpeg", quality);
        if (jpeg && jpeg.type === "image/jpeg" && jpeg.size <= MAX_PICTURE_BYTES) {
          picture = jpeg;
          break;
        }
      }
    }
    const width = canvas.width;
    const height = canvas.height;
    canvas.width = 0; // let the browser free the memory now
    canvas.height = 0;
    if (!picture) throw new Error(`Page ${pageNumber} could not be turned into a picture.`);

    const content = await page.getTextContent({ includeMarkedContent: false });
    const words = pageTextFromItems(content.items ?? [], viewport);
    return { picture, type, width, height, ...words };
  } finally {
    page.cleanup?.();
  }
}

// ---- the job -------------------------------------------------------------------------------------

async function clearPages(bookId: string) {
  const { error } = await supabase.from("book_pages").delete().eq("book_id", bookId);
  if (error) throw new Error(error.message);
  // The pictures: listed and removed a thousand at a time.
  for (;;) {
    const { data, error: listError } = await supabase.storage
      .from(PAGES_BUCKET)
      .list(bookId, { limit: 1000 });
    if (listError || !data?.length) return;
    const { error: removeError } = await supabase.storage
      .from(PAGES_BUCKET)
      .remove(data.map((item) => `${bookId}/${item.name}`));
    if (removeError) return;
  }
}

/**
 * Prepares (or finishes preparing) a book. `file` is the PDF on this device when the admin has it
 * (opened in parts, nothing downloaded); otherwise the saved PDF is read through a signed link.
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
  let job: PrepareJob = { bookId, stage: "opening", done: 0, total: 0, scanned: 0, message: "" };
  const update = (patch: Partial<PrepareJob>) => {
    job = { ...job, ...patch };
    publish(job);
  };
  update({});
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
      .select("page_count, prepared_at, file_path")
      .eq("id", bookId)
      .single();
    if (bookError) throw new Error(bookError.message);
    if (book.file_path !== options.filePath)
      throw new Error("تغيّر ملف الكتاب. افتح المحرر مرة ثانية.");
    const fresh = options.again || book.page_count !== total;
    if (fresh) await clearPages(bookId);
    const { error: startError } = await supabase
      .from("books")
      .update({ page_count: total, prepared_at: null })
      .eq("id", bookId);
    if (startError) throw new Error(startError.message);

    const { data: have } = fresh
      ? { data: [] as { page: number; has_text: boolean }[] }
      : await supabase.from("book_pages").select("page, has_text").eq("book_id", bookId);
    const doneRows = (have ?? []) as { page: number; has_text: boolean }[];
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

    // Draw the next page while the last one uploads (at most two uploads at once).
    const uploads = new Set<Promise<void>>();
    let failure: unknown = null;
    for (const pageNumber of todo) {
      if (stop.signal.aborted || failure) break;
      const drawn = await drawPage(doc, pageNumber);
      const path = pageImagePath(bookId, pageNumber, drawn.type);
      const upload = (async () => {
        const { error: uploadError } = await supabase.storage
          .from(PAGES_BUCKET)
          .upload(path, drawn.picture, {
            upsert: true,
            contentType: drawn.type === "webp" ? "image/webp" : "image/jpeg",
            cacheControl: "31536000",
          });
        if (uploadError) throw new Error(uploadError.message);
        const { error: rowError } = await supabase.from("book_pages").upsert({
          book_id: bookId,
          page: pageNumber,
          width: drawn.width,
          height: drawn.height,
          image_path: path,
          text: drawn.text,
          runs: drawn.runs,
        });
        if (rowError) throw new Error(rowError.message);
        update({ done: job.done + 1, scanned: job.scanned + (drawn.text ? 0 : 1) });
      })().catch((error) => {
        failure = failure ?? error;
      });
      uploads.add(upload);
      void upload.finally(() => uploads.delete(upload));
      if (uploads.size >= 2) await Promise.race(uploads);
    }
    await Promise.all(uploads);
    if (failure) throw failure;
    if (stop.signal.aborted) {
      update({ stage: "stopped", message: "وقّفنا. اكبس «كمّل التجهيز» لتكمّل من وين وقفت." });
      return job;
    }

    update({ stage: "finishing" });
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
    stops.delete(bookId);
    try {
      await doc?.destroy?.();
    } catch {
      /* already gone */
    }
  }
}
