import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { failureSummary, readPages } from "@/lib/page-reading";
import { nextWindow } from "@/lib/rita-curriculum";
import {
  adminCheckVisionKey,
  adminReadCurriculumWindow,
  adminSaveCurriculumPages,
  adminTranscribeCurriculumPages,
  type CurriculumRow,
} from "@/lib/rita-curriculum.functions";
import { errorText, pdfFileFor } from "./book-utils";

export type ReadError = { hint: string; raw: string };

/**
 * Reads a whole book with one button. In order: takes any text the PDF still holds for pages that
 * have none saved, reads scanned pages with the AI one by one (with a key check first, a time limit
 * and a retry per page), then writes the reading summary of each ten pages. It runs in this tab
 * (scanned pages are drawn here), keeps the screen awake, can be stopped, and picks up where it
 * stopped. Every failure stays on screen with its reason.
 */
export function useBookReader({
  book,
  missingText,
  pdfCache,
  onChanged,
}: {
  book: CurriculumRow;
  missingText: number[];
  pdfCache: Map<string, File>;
  onChanged: () => Promise<void>;
}) {
  const readFn = useServerFn(adminReadCurriculumWindow);
  const transcribeFn = useServerFn(adminTranscribeCurriculumPages);
  const checkKeyFn = useServerFn(adminCheckVisionKey);
  const savePagesFn = useServerFn(adminSaveCurriculumPages);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<ReadError | null>(null);
  const cancel = useRef(false);
  const extracted = useRef(false);

  // The loop needs the freshest book and gaps, not the ones from when it started.
  const bookRef = useRef(book);
  bookRef.current = book;
  const missingRef = useRef(missingText);
  missingRef.current = missingText;

  // A sleeping iPad pauses the tab and the reading stalls: keep the screen on while it runs.
  useEffect(() => {
    if (!running || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const acquire = () => {
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (released) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [running]);

  /** Pages with no saved text get another go at the PDF's own text layer (fast, no AI). */
  const extractMissing = useCallback(async () => {
    const bookNow = bookRef.current;
    const pages = missingRef.current.filter((page) => page <= bookNow.page_count);
    if (!pages.length || extracted.current) return;
    extracted.current = true;
    setStatus("أخذ النص من ملف الكتاب…");
    const { loadPdfForText, getPageText } = await import("@/lib/pdf-page-render");
    const doc = await loadPdfForText(await pdfFileFor(bookNow, pdfCache));
    let batch: { page_no: number; text: string; has_text_layer: boolean }[] = [];
    for (const page of pages) {
      if (cancel.current) return;
      const text = (await getPageText(doc, page)).slice(0, 20_000);
      batch.push({ page_no: page, text, has_text_layer: text.trim().length >= 20 });
      if (batch.length === 20) {
        await savePagesFn({ data: { curriculumId: bookNow.id, pages: batch } });
        batch = [];
      }
    }
    if (batch.length) await savePagesFn({ data: { curriculumId: bookNow.id, pages: batch } });
    await onChanged();
  }, [onChanged, pdfCache, savePagesFn]);

  /** One ten-page window: its scanned pages first, then the summary. Returns the new cursor. */
  const readWindow = useCallback(
    async (from: number, to: number, total: number): Promise<number> => {
      const bookNow = bookRef.current;
      const scanned = missingRef.current.filter((page) => page >= from && page <= to);
      if (scanned.length) {
        const keyCheck = await checkKeyFn();
        // A refused test picture says nothing about the key: go on and let the real pages decide.
        if (!keyCheck.ok && !keyCheck.imageProblem) {
          throw new Error(
            `مفتاح OpenAI ما بيقرأ الصور هلأ (النموذج ${keyCheck.model}): ${keyCheck.error ?? "سبب غير معروف"}`,
          );
        }
        const { loadPdfForRender, renderPageToJpegBase64 } = await import("@/lib/pdf-page-render");
        const doc = await loadPdfForRender(await pdfFileFor(bookNow, pdfCache));
        const outcomes = await readPages(
          scanned,
          async (page) => {
            const jpegBase64 = await renderPageToJpegBase64(doc, page, {
              targetWidth: 1200,
              quality: 0.72,
            });
            const outcome = await transcribeFn({
              data: { curriculumId: bookNow.id, pages: [{ page_no: page, jpegBase64 }] },
            });
            return outcome.stillMissing.length
              ? {
                  ok: false,
                  reason: outcome.failures[0] ?? "The AI returned nothing for this page.",
                }
              : { ok: true };
          },
          {
            timeoutMs: 90_000,
            retries: 1,
            shouldStop: () => cancel.current,
            onProgress: ({ page, attempt }) =>
              setStatus(
                `قراءة صفحة ممسوحة: ص${page} من ${total}${attempt > 1 ? ` · محاولة ${attempt}` : ""}`,
              ),
          },
        );
        const failed = outcomes.filter((outcome) => !outcome.ok);
        if (failed.length) {
          throw new Error(`ما انقرأت ${failed.length} صفحة: ${failureSummary(outcomes)}`);
        }
      }
      setStatus(`كتابة ملخص الصفحات ${from}–${to} من ${total}…`);
      const result = await readFn({ data: { curriculumId: bookNow.id, from, to } });
      return result.readCursor;
    },
    [checkKeyFn, pdfCache, readFn, transcribeFn],
  );

  const readWholeBook = useCallback(async () => {
    if (running) return;
    cancel.current = false;
    setRunning(true);
    setError(null);
    try {
      await extractMissing();
      let cursor = bookRef.current.read_cursor;
      const total = bookRef.current.page_count;
      while (!cancel.current) {
        const window = nextWindow({ page_count: total, read_cursor: cursor });
        if (!window) break;
        const advanced = await readWindow(window.from, window.to, total);
        await onChanged();
        if (advanced <= cursor) break; // safety: the cursor did not move
        cursor = advanced;
      }
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause ?? "");
      const hint = errorText(cause);
      setError({ hint, raw: raw === hint ? "" : raw.slice(0, 400) });
    } finally {
      setRunning(false);
      setStatus("");
      await onChanged();
    }
  }, [extractMissing, onChanged, readWindow, running]);

  /** Reads one chosen window (advanced tools). */
  const readOneWindow = useCallback(
    async (from: number, to: number) => {
      if (running) return;
      cancel.current = false;
      setRunning(true);
      setError(null);
      try {
        await readWindow(from, to, bookRef.current.page_count);
      } catch (cause) {
        setError({ hint: errorText(cause), raw: "" });
      } finally {
        setRunning(false);
        setStatus("");
        await onChanged();
      }
    },
    [onChanged, readWindow, running],
  );

  return {
    running,
    status,
    error,
    clearError: () => setError(null),
    readWholeBook,
    readOneWindow,
    stop: () => {
      cancel.current = true;
      setStatus("بنوقّف بعد الصفحة الحالية…");
    },
  };
}
