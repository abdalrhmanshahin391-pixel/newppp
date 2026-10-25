import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { failureSummary, isFatalReason, readPages, unresolvedIn } from "@/lib/page-reading";
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
/** A page that is not settled yet: the AI would not read it, or kept failing. It stays on screen until the admin decides. */
export type PageProblem = { page_no: number; kind: "refused" | "failed"; reason: string };
/** A page that was settled with a remark: blank (nothing to read) or cut (very long). */
export type PageRemark = { page_no: number; kind: "blank" | "cut"; reason: string };

const MAX_PICTURE_CHARS = 1_200_000;

/**
 * Reads a whole book with one button, in two passes. Pass 1 gets the text of every page that has
 * none: first from the PDF itself, then by reading the page picture with the AI, one page at a time
 * (key check first, time limit, a retry). Pass 2 writes the summary of each ten pages. One page
 * never stops the others: a page the AI will not read becomes a visible "problem" to settle, and the
 * summaries stop only at the window that holds it. It runs in this tab (pages are drawn here), keeps
 * the screen awake, can be stopped, and picks up where it stopped.
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
  const [problems, setProblems] = useState<PageProblem[]>([]);
  const [remarks, setRemarks] = useState<PageRemark[]>([]);
  // Why the PDF's own text could not be taken on this device (empty when there was no error).
  const [textNote, setTextNote] = useState<{ count: number; cause: string } | null>(null);
  const cancel = useRef(false);
  const extracted = useRef(false);
  const problemsRef = useRef<PageProblem[]>([]);
  const remarksRef = useRef<PageRemark[]>([]);

  // The loop needs the freshest book and gaps, not the ones from when it started.
  const bookRef = useRef(book);
  bookRef.current = book;
  const missingRef = useRef(missingText);
  missingRef.current = missingText;

  const setProblemList = (next: PageProblem[]) => {
    problemsRef.current = next;
    setProblems(next);
  };
  const addProblem = (problem: PageProblem) =>
    setProblemList(
      [...problemsRef.current.filter((item) => item.page_no !== problem.page_no), problem].sort(
        (a, b) => a.page_no - b.page_no,
      ),
    );
  const resolvePage = useCallback((page: number) => {
    const next = problemsRef.current.filter((item) => item.page_no !== page);
    problemsRef.current = next;
    setProblems(next);
  }, []);
  const addRemark = (remark: PageRemark) => {
    remarksRef.current = [
      ...remarksRef.current.filter((item) => item.page_no !== remark.page_no),
      remark,
    ].sort((a, b) => a.page_no - b.page_no);
    setRemarks(remarksRef.current);
  };

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

  /**
   * Pages with no saved text get another go at the PDF's own text layer (fast, no AI). Returns the
   * pages that still have no text, and remembers why the device could not read the file's text.
   */
  const extractMissing = useCallback(
    async (pending: number[]): Promise<number[]> => {
      const bookNow = bookRef.current;
      const pages = pending.filter((page) => page <= bookNow.page_count);
      if (!pages.length || extracted.current) return pages;
      extracted.current = true;
      setStatus("أخذ النص من ملف الكتاب…");
      const { loadPdfForText, getPageTextDetailed } = await import("@/lib/pdf-page-render");
      const doc = await loadPdfForText(await pdfFileFor(bookNow, pdfCache));
      const empty: number[] = [];
      let errors = 0;
      let firstError = "";
      let batch: { page_no: number; text: string; has_text_layer: boolean }[] = [];
      for (const page of pages) {
        if (cancel.current) return pages.filter((item) => !batch.some((b) => b.page_no === item));
        const result = await getPageTextDetailed(doc, page);
        const text = result.text.slice(0, 20_000);
        if (result.error) {
          errors += 1;
          firstError ||= result.error;
        }
        if (text.trim().length < 20) empty.push(page);
        batch.push({ page_no: page, text, has_text_layer: text.trim().length >= 20 });
        if (batch.length === 20) {
          await savePagesFn({ data: { curriculumId: bookNow.id, pages: batch } });
          batch = [];
        }
      }
      if (batch.length) await savePagesFn({ data: { curriculumId: bookNow.id, pages: batch } });
      if (errors) {
        setTextNote({ count: errors, cause: firstError });
      }
      return empty;
    },
    [pdfCache, savePagesFn],
  );

  /**
   * Gets the text of these pages by reading their pictures. Every page ends settled or listed as a
   * problem. Only a failure no retry can fix (the key, the credit, the model) throws and stops the run.
   */
  const transcribeMissing = useCallback(
    async (pages: number[]) => {
      if (!pages.length) return;
      const bookNow = bookRef.current;
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
        pages,
        async (page) => {
          const jpegBase64 = await renderPageToJpegBase64(doc, page, {
            targetWidth: 1200,
            quality: 0.72,
            maxChars: MAX_PICTURE_CHARS,
          });
          const outcome = await transcribeFn({
            data: { curriculumId: bookNow.id, pages: [{ page_no: page, jpegBase64 }] },
          });
          const note = (outcome.notes ?? []).find((item) => item.page_no === page);
          // The AI looked and would not read it: no point asking again the same way. It is listed.
          if (note?.kind === "refused") {
            addProblem({ page_no: page, kind: "refused", reason: note.reason });
            return { ok: true };
          }
          if (outcome.stillMissing.length) {
            return {
              ok: false,
              reason: outcome.failures[0] ?? "The AI returned nothing for this page.",
            };
          }
          resolvePage(page);
          if (note) addRemark({ page_no: page, kind: note.kind, reason: note.reason });
          return { ok: true };
        },
        {
          timeoutMs: 90_000,
          retries: 1,
          shouldStop: () => cancel.current,
          onProgress: ({ page, index, total, attempt }) =>
            setStatus(
              `قراءة صفحة ممسوحة: ص${page} (${index + 1} من ${total})${attempt > 1 ? ` · محاولة ${attempt}` : ""}`,
            ),
        },
      );
      const failed = outcomes.filter((outcome) => !outcome.ok && outcome.attempts > 0);
      const fatal = failed.filter((outcome) => isFatalReason(outcome.reason));
      if (fatal.length) throw new Error(failureSummary(fatal));
      for (const outcome of failed) {
        addProblem({ page_no: outcome.page, kind: "failed", reason: outcome.reason });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkKeyFn, pdfCache, transcribeFn, resolvePage],
  );

  const resetRun = () => {
    cancel.current = false;
    remarksRef.current = [];
    setRemarks([]);
    setTextNote(null);
    setError(null);
    setRunning(true);
  };

  const endRun = async () => {
    setRunning(false);
    setStatus("");
    await onChanged();
  };

  const failWith = (cause: unknown) => {
    const raw = cause instanceof Error ? cause.message : String(cause ?? "");
    const hint = errorText(cause);
    setError({ hint, raw: raw === hint ? "" : raw.slice(0, 400) });
  };

  /** Pass 2 for one window: its summary. Returns the new cursor, or null when a page is still open. */
  const summarize = useCallback(
    async (from: number, to: number, total: number): Promise<number | null> => {
      if (
        unresolvedIn(
          problemsRef.current.map((item) => item.page_no),
          from,
          to,
        ).length
      )
        return null;
      setStatus(`كتابة ملخص الصفحات ${from}–${to} من ${total}…`);
      const result = await readFn({ data: { curriculumId: bookRef.current.id, from, to } });
      return result.readCursor;
    },
    [readFn],
  );

  const readWholeBook = useCallback(async () => {
    if (running) return;
    resetRun();
    try {
      const empty = await extractMissing(missingRef.current);
      await transcribeMissing(empty);
      await onChanged();
      let cursor = bookRef.current.read_cursor;
      const total = bookRef.current.page_count;
      while (!cancel.current) {
        const window = nextWindow({ page_count: total, read_cursor: cursor });
        if (!window) break;
        const advanced = await summarize(window.from, window.to, total);
        if (advanced === null) break; // an open page holds this window: the panel says which
        await onChanged();
        if (advanced <= cursor) break; // safety: the cursor did not move
        cursor = advanced;
      }
    } catch (cause) {
      failWith(cause);
    } finally {
      await endRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractMissing, onChanged, running, summarize, transcribeMissing]);

  /** Reads one chosen window. Resolves true when its summary was written. */
  const readOneWindow = useCallback(
    async (from: number, to: number): Promise<boolean> => {
      if (running) return false;
      resetRun();
      let ok = false;
      try {
        const inWindow = missingRef.current.filter((page) => page >= from && page <= to);
        const empty = await extractMissing(inWindow);
        await transcribeMissing(empty);
        await onChanged();
        ok = (await summarize(from, to, bookRef.current.page_count)) !== null;
      } catch (cause) {
        failWith(cause);
      } finally {
        await endRun();
      }
      return ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extractMissing, onChanged, running, summarize, transcribeMissing],
  );

  /** Tries one open page again. */
  const retryPage = useCallback(
    async (page: number) => {
      if (running) return;
      resetRun();
      try {
        await transcribeMissing([page]);
      } catch (cause) {
        failWith(cause);
      } finally {
        await endRun();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChanged, running, transcribeMissing],
  );

  /** A small picture of a page, so the admin can see what the AI was given. */
  const previewPage = useCallback(
    async (page: number): Promise<string> => {
      const { loadPdfForRender, renderPageToJpegBase64 } = await import("@/lib/pdf-page-render");
      const doc = await loadPdfForRender(await pdfFileFor(bookRef.current, pdfCache));
      const base64 = await renderPageToJpegBase64(doc, page, { targetWidth: 640, quality: 0.6 });
      return `data:image/jpeg;base64,${base64}`;
    },
    [pdfCache],
  );

  return {
    running,
    status,
    error,
    problems,
    remarks,
    textNote,
    clearError: () => setError(null),
    readWholeBook,
    readOneWindow,
    retryPage,
    previewPage,
    resolvePage,
    stop: () => {
      cancel.current = true;
      setStatus("بنوقّف بعد الصفحة الحالية…");
    },
  };
}
