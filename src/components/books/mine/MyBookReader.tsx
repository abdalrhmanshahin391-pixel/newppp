// Reading one of your own books: one page at a time, drawn in the browser from the PDF (only the
// pages being read are downloaded). Turn with the arrows, a swipe, a tap on the page's side, or
// the slider; the page you stopped at is kept on this device.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { clampPage, placeKey, type UserBook } from "@/lib/user-books";
import { drawPage, openMyBook, type PdfDoc } from "./my-book-pdf";
import "./my-books.css";

type Lang = "en" | "ar";

function readPlace(id: string): number {
  try {
    return Number(window.localStorage.getItem(placeKey(id))) || 1;
  } catch {
    return 1;
  }
}

export function MyBookReader({ book, ui }: { book: UserBook; ui: Lang }) {
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const [doc, setDoc] = useState<PdfDoc>(null);
  const [failed, setFailed] = useState(false);
  const [total, setTotal] = useState(book.page_count ?? 1);
  const [page, setPage] = useState(1);
  const [drawing, setDrawing] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; at: number } | null>(null);

  // Open the book once.
  useEffect(() => {
    let live = true;
    let opened: PdfDoc = null;
    openMyBook(book)
      .then((d) => {
        opened = d;
        if (!live) return void d.destroy?.();
        const pages = Number(d.numPages) || 1;
        setTotal(pages);
        setPage(clampPage(readPlace(book.id), pages));
        setDoc(d);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      void opened?.destroy?.();
    };
  }, [book]);

  // Draw the page that fits the screen, again when the screen changes size.
  const draw = useCallback(async () => {
    const box = stage.current;
    if (!doc || !box || !canvas.current) return;
    setDrawing(true);
    try {
      await drawPage(doc, page, canvas.current, box.clientWidth - 24, box.clientHeight - 24);
    } catch {
      /* a page that cannot be drawn stays blank; the others still work */
    } finally {
      setDrawing(false);
    }
    // The next page is fetched ahead so turning feels instant.
    if (page < total) void doc.getPage(page + 1).catch(() => undefined);
  }, [doc, page, total]);

  useEffect(() => {
    void draw();
  }, [draw]);
  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void draw(), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, [draw]);

  const go = useCallback(
    (next: number) => {
      const target = clampPage(next, total);
      setPage(target);
      try {
        window.localStorage.setItem(placeKey(book.id), String(target));
      } catch {
        /* kept for this visit only */
      }
    },
    [book.id, total],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.tagName === "INPUT") return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        go(page + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(page - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page]);

  return (
    <div className="edith-premium my-reader">
      <header className="my-reader-bar" dir={ui === "ar" ? "rtl" : "ltr"}>
        <Link
          to="/books"
          className="my-reader-back"
          aria-label={t("Back to the library", "رجوع للمكتبة")}
        >
          <ArrowRight size={20} className="ltr:rotate-180" aria-hidden="true" />
        </Link>
        <p className="my-reader-title" dir="auto">
          {book.title}
        </p>
        <p className="my-reader-page" aria-live="polite">
          {t(`${page} of ${total}`, `${page} من ${total}`)}
        </p>
      </header>

      <div
        ref={stage}
        className="my-reader-stage"
        dir="ltr"
        onPointerDown={(event) => {
          swipe.current = { x: event.clientX, y: event.clientY, at: Date.now() };
        }}
        onPointerUp={(event) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return go(page + (dx < 0 ? 1 : -1));
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - start.at < 400) {
            const box = event.currentTarget.getBoundingClientRect();
            const x = (event.clientX - box.left) / box.width;
            if (x > 0.7) go(page + 1);
            else if (x < 0.3) go(page - 1);
          }
        }}
      >
        {failed ? (
          <div className="my-reader-problem" dir={ui === "ar" ? "rtl" : "ltr"}>
            <p>
              {t(
                "The book could not be opened. Check the connection and try again.",
                "ما قدرنا نفتح الكتاب. تأكد من النت وجرّب كمان مرة.",
              )}
            </p>
            <Link to="/books" className="bk-btn">
              {t("Back to the library", "رجوع للمكتبة")}
            </Link>
          </div>
        ) : (
          <>
            <canvas
              ref={canvas}
              className="my-reader-page-canvas"
              aria-label={t(`Page ${page}`, `صفحة ${page}`)}
              role="img"
            />
            {(drawing || !doc) && (
              <Loader2
                size={26}
                className="my-reader-spin animate-spin"
                aria-label={t("Loading", "عم يحمّل")}
              />
            )}
          </>
        )}
        <button
          type="button"
          className="my-reader-turn is-prev"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label={t("Previous page", "الصفحة اللي قبل")}
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="my-reader-turn is-next"
          onClick={() => go(page + 1)}
          disabled={page >= total}
          aria-label={t("Next page", "الصفحة الجاية")}
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>
      </div>

      {total > 1 && (
        <div className="my-reader-slider" dir="ltr">
          <input
            type="range"
            min={1}
            max={total}
            value={page}
            onChange={(event) => go(Number(event.target.value))}
            aria-label={t("Go to page", "روح لصفحة")}
          />
        </div>
      )}
    </div>
  );
}
