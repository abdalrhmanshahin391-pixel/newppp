// One book page: its picture, and over it the page's words in see-through text, each piece where
// it sits on the picture, so the reader selects real text (the way pdf.js lays its text layer).
// Sizes are parts of the page box (container units), so zooming or turning the tablet needs no
// work; only each piece's stretch is measured, once per page.
import { forwardRef, useMemo, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import type { ReaderPage } from "@/lib/book-reader-data";

const FONT = "sans-serif";

let measure: CanvasRenderingContext2D | null = null;
/** How wide the text is at a 100 px font, in this browser's sans-serif. */
function widthAt100(text: string): number {
  if (typeof document === "undefined") return text.length * 50;
  if (!measure) {
    measure = document.createElement("canvas").getContext("2d");
    if (measure) measure.font = `100px ${FONT}`;
  }
  return measure?.measureText(text).width || text.length * 50;
}

export const BookPageView = forwardRef<
  HTMLDivElement,
  {
    page: ReaderPage | null;
    /** The page's shape while it loads (from the previous page). */
    ratio: number;
    width: number;
    loading: boolean;
    failed: string;
    onRetry: () => void;
  }
>(function BookPageView({ page, ratio, width, loading, failed, onRetry }, textRef) {
  const [shown, setShown] = useState("");
  const pageRatio = page ? page.height / page.width : ratio;
  const height = width * pageRatio;

  // Each piece is stretched sideways to cover its words on the picture exactly.
  const pieces = useMemo(() => {
    if (!page) return [];
    const aspect = page.width / page.height;
    return page.runs.map(([text, left, top, w, h], index) => {
      const natural = (widthAt100(text) / 100) * h; // in page heights
      const stretch = natural > 0 ? (w * aspect) / natural : 1;
      return { key: index, text, left, top, h, stretch };
    });
  }, [page]);

  return (
    <div
      className="bkr-page"
      style={{ width, height }}
      data-loaded={page && shown === page.url ? "" : undefined}
    >
      {page && (
        <img
          key={page.url}
          src={page.url}
          alt=""
          className="bkr-picture"
          decoding="async"
          draggable={false}
          onLoad={() => setShown(page.url)}
        />
      )}
      {page && (
        <div ref={textRef} className="bkr-text" dir="ltr" lang="und" data-book-text="">
          {pieces.map((piece) => (
            <span
              key={piece.key}
              style={{
                left: `${piece.left * 100}%`,
                top: `${piece.top * 100}%`,
                fontSize: `${piece.h * 100}cqh`,
                transform: `scaleX(${piece.stretch.toFixed(4)})`,
              }}
            >
              {piece.text}
            </span>
          ))}
        </div>
      )}
      {(loading || (page && shown !== page.url)) && !failed && (
        <div className="bkr-wait" role="status" aria-label="جاري تحميل الصفحة">
          <Loader2 size={22} className="animate-spin" aria-hidden="true" />
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
