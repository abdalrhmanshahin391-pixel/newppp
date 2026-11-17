import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { CurriculumRow } from "@/lib/rita-curriculum.functions";
import { pdfFileFor, errorText } from "./book-utils";

/** Render one source page on demand. Never downloads a PDF until its preview is opened. */
export function BookPagePreview({
  book,
  cache,
  page,
  onPage,
}: {
  book: CurriculumRow;
  cache: Map<string, File>;
  page: number;
  onPage: (page: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const [{ loadPdfForRender }, file] = await Promise.all([
          import("@/lib/pdf-page-render"),
          pdfFileFor(book, cache),
        ]);
        if (cancelled) return;
        const doc = await loadPdfForRender(file);
        const pdfPage = await doc.getPage(page);
        if (cancelled || !canvas.current) return;
        const target = document.createElement("canvas");
        const scale =
          (Math.min(2, window.devicePixelRatio || 1) * Math.max(120, width - 24)) /
          pdfPage.getViewport({ scale: 1 }).width;
        const viewport = pdfPage.getViewport({ scale });
        target.width = Math.ceil(viewport.width);
        target.height = Math.ceil(viewport.height);
        const context = target.getContext("2d");
        if (!context) throw new Error("تعذّر عرض الصفحة.");
        const task = pdfPage.render({ canvasContext: context, viewport });
        cancelRender = () => task.cancel();
        await task.promise;
        if (!cancelled && canvas.current) {
          canvas.current.width = target.width;
          canvas.current.height = target.height;
          canvas.current.getContext("2d")?.drawImage(target, 0, 0);
        }
      } catch (cause) {
        if (!cancelled) setError(errorText(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [book, cache, page, retry, width]);
  return (
    <section className="pc-pdf" aria-label="معاينة كتاب المنهج">
      <div className="pc-pdf-toolbar" data-workspace-transient>
        <button
          className="rita-btn rita-btn-icon"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="الصفحة السابقة"
        >
          <ChevronRight size={18} />
        </button>
        <label>
          صفحة{" "}
          <input
            aria-label="رقم صفحة الكتاب"
            type="number"
            min={1}
            max={book.page_count}
            value={page}
            onChange={(event) => {
              const n = Number(event.target.value);
              if (n >= 1 && n <= book.page_count) onPage(n);
            }}
          />{" "}
          من {book.page_count}
        </label>
        <button
          className="rita-btn rita-btn-icon"
          disabled={page >= book.page_count}
          onClick={() => onPage(page + 1)}
          aria-label="الصفحة التالية"
        >
          <ChevronLeft size={18} />
        </button>
      </div>
      <div ref={frame} className="pc-pdf-page" aria-busy={loading}>
        {loading && (
          <p role="status">
            <Loader2 className="animate-spin" size={18} /> تحميل الصفحة…
          </p>
        )}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button className="rita-btn rita-btn-soft" onClick={() => setRetry((n) => n + 1)}>
              أعد المحاولة
            </button>
          </div>
        )}
        <canvas
          ref={canvas}
          hidden={Boolean(error) || loading}
          aria-label={`معاينة الصفحة ${page} من ${book.title_ar || book.title}`}
        />
      </div>
    </section>
  );
}
