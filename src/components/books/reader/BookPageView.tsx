// One book page: its picture, and over it the page's words in see-through text, each piece where
// it sits on the picture, so the reader selects real text (the way pdf.js lays its text layer).
// Sizes are parts of the page box (container units), so zooming or turning the tablet needs no
// work. Each piece is stretched to the width of its words on the picture, measured once per page
// with the browser's own layout (so Safari and Chrome both line up).
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import type { ReaderPage } from "@/lib/book-reader-data";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const BookPageView = forwardRef<
  HTMLDivElement,
  {
    page: ReaderPage | null;
    /** The page's shape while it loads (from the previous page). */
    ratio: number;
    width: number;
    /** The page shown is the previous one, kept while the next arrives. */
    stale: boolean;
    loading: boolean;
    failed: string;
    onRetry: () => void;
  }
>(function BookPageView({ page, ratio, width, stale, loading, failed, onRetry }, textRef) {
  const [shown, setShown] = useState("");
  // The last picture that finished loading stays under the next one until it is in.
  const [under, setUnder] = useState<{ url: string; ratio: number } | null>(null);
  const layer = useRef<HTMLDivElement | null>(null);
  const pageRatio = page ? page.height / page.width : ratio;
  const height = width * pageRatio;

  const pieces = useMemo(
    () =>
      page
        ? page.runs.map(([text, left, top, w, h], index) => ({ key: index, text, left, top, w, h }))
        : [],
    [page],
  );

  // Each piece's natural width at this size, then the stretch that makes it cover its words. The
  // stretch does not change with zoom (the font grows with the page), so this runs once per page.
  useIsoLayoutEffect(() => {
    const el = layer.current;
    if (!el || !page || !width) return;
    const spans = Array.from(el.children).filter(
      (child): child is HTMLSpanElement => child.tagName === "SPAN",
    );
    for (const span of spans) span.style.transform = "";
    const boxWidth = el.getBoundingClientRect().width;
    const natural = spans.map((span) => span.getBoundingClientRect().width);
    spans.forEach((span, index) => {
      const target = (pieces[index]?.w ?? 0) * boxWidth;
      const stretch = natural[index] > 0 && target > 0 ? target / natural[index] : 1;
      span.style.transform = `scaleX(${stretch.toFixed(4)})`;
    });
    // Measured at one width only; a later zoom keeps the same stretch.
  }, [page, pieces]);

  // While selecting, a blank layer under the words keeps the selection from jumping when the
  // pointer crosses the gaps between lines (pdf.js' "endOfContent").
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const start = () => el.classList.add("is-selecting");
    const stop = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !el.contains(selection.anchorNode))
        el.classList.remove("is-selecting");
      else window.setTimeout(() => el.classList.remove("is-selecting"), 0);
    };
    const onChange = () => {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed && el.contains(selection.anchorNode)) start();
    };
    el.addEventListener("pointerdown", start);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    document.addEventListener("selectionchange", onChange);
    return () => {
      el.removeEventListener("pointerdown", start);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [page]);

  const ready = Boolean(page && shown === page.url);
  const keepUnder =
    under && page && under.url !== page.url && Math.abs(under.ratio - pageRatio) < 0.02;

  return (
    <div
      className="bkr-page"
      style={{ width, height }}
      data-loaded={ready ? "" : undefined}
      data-stale={stale ? "" : undefined}
    >
      {keepUnder && (
        <img src={under.url} alt="" className="bkr-picture is-under" draggable={false} />
      )}
      {page && (
        <img
          key={page.url}
          src={page.url}
          alt=""
          className="bkr-picture"
          decoding="async"
          draggable={false}
          onLoad={() => {
            setShown(page.url);
            setUnder({ url: page.url, ratio: pageRatio });
          }}
        />
      )}
      {page && (
        <div
          ref={(node) => {
            layer.current = node;
            if (typeof textRef === "function") textRef(node);
            else if (textRef) textRef.current = node;
          }}
          className="bkr-text"
          dir="ltr"
          lang="und"
          data-book-text=""
        >
          {pieces.map((piece) => (
            <span
              key={piece.key}
              style={{
                left: `${piece.left * 100}%`,
                top: `${piece.top * 100}%`,
                fontSize: `${piece.h * 100}cqh`,
              }}
            >
              {piece.text}
            </span>
          ))}
          <div className="bkr-end" />
        </div>
      )}
      {page && !page.hasText && ready && <p className="bkr-badge">صفحة صورة بدون نص، ما بتنحدد</p>}
      {((loading && !keepUnder) || (page && !ready && !keepUnder) || stale) && !failed && (
        <div className="bkr-wait" role="status" aria-label="جاري تحميل الصفحة">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <div className="bkr-wait is-failed" role="alert">
          <ImageOff size={22} aria-hidden="true" />
          <p>{failed}</p>
          <button type="button" className="rita-btn rita-btn-soft rita-btn-sm" onClick={onRetry}>
            جرّب مرة ثانية
          </button>
        </div>
      )}
    </div>
  );
});
