// One book page: its picture, and over it the page's words in see-through text, each piece where
// it sits on the picture, so the reader selects real text (the way pdf.js lays its text layer).
//
// Turning is instant: the sheet takes the new page's size at once (from the light page info),
// slides in 24 px (220 ms), and shows the page's real line layout as faint "ghost text" until the
// picture is decoded, then the picture fades in (200 ms). Pages beside the one being read are
// decoded ahead, so they appear sharp straight away. A spinner shows only after a second.
//
// Sizes are parts of the page box (container units), so zooming or turning the tablet needs no
// work. Each piece is stretched to the width of its words on the picture, measured once per page
// with the browser's own layout (so Safari and Chrome both line up).
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import type { PageView, PageWords } from "@/lib/book-reader-data";
import { decodePicture, isPictureReady } from "@/lib/book-pictures";
import { SETTLE_MS } from "@/lib/books-reader";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
/** Ghost text draws at most this many line pieces (a dense page has thousands). */
const GHOST_MAX = 700;

export const BookPageView = forwardRef<
  HTMLDivElement,
  {
    view: PageView | null;
    /** The words of this page, once read (null before). */
    words: PageWords | null;
    /** The page's shape while its info loads (from the previous page). */
    ratio: number;
    width: number;
    /** +1: the new page comes from the right; -1: from the left; 0: no slide. */
    motion: number;
    /** Changes on every turn (the slide plays again). */
    turn: number;
    /** Flipping fast: fetch the picture only once the reader stays on this page. */
    settle: boolean;
    failed: string;
    onRetry: () => void;
  }
>(function BookPageView(
  { view, words, ratio, width, motion, turn, settle, failed, onRetry },
  textRef,
) {
  const box = useRef<HTMLDivElement | null>(null);
  const layer = useRef<HTMLDivElement | null>(null);
  const url = view?.url ?? "";
  const pageRatio = view ? view.height / view.width : ratio;
  const height = width * pageRatio;

  // ---- the picture: shown once decoded --------------------------------------------------------
  const [sharp, setSharp] = useState<{ url: string; fade: boolean } | null>(null);
  const [pictureFailed, setPictureFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Read when the page changes (a later change of "flipping" must not reload the picture).
  const settleRef = useRef(settle);
  settleRef.current = settle;
  useEffect(() => {
    setPictureFailed(false);
    setSlow(false);
    if (!url) return;
    if (isPictureReady(url)) {
      setSharp({ url, fade: false });
      return;
    }
    let alive = true;
    // While flipping fast, a page is fetched only once the reader stays on it.
    const timer = window.setTimeout(
      () => {
        decodePicture(url, "high").then(
          () => alive && setSharp({ url, fade: true }),
          () => {
            if (!alive) return;
            // One quiet retry after 1.5 s, then a small "try again".
            if (attempt === 0) window.setTimeout(() => alive && setAttempt(1), 1500);
            else setPictureFailed(true);
          },
        );
      },
      settleRef.current ? SETTLE_MS : 0,
    );
    const spinner = window.setTimeout(() => alive && setSlow(true), 1000);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearTimeout(spinner);
    };
  }, [url, attempt]);
  const ready = Boolean(url && sharp?.url === url);

  // ---- the slide on every turn --------------------------------------------------------------
  useEffect(() => {
    const el = box.current;
    if (!el || !motion || !el.animate) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const animation = reduce
      ? el.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 120, easing: "ease-out" })
      : el.animate(
          [
            { transform: `translateX(${24 * motion}px)`, opacity: 0.5 },
            { transform: "translateX(0)", opacity: 1 },
          ],
          { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
    return () => animation.cancel();
    // Plays on each turn only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  // ---- the words ----------------------------------------------------------------------------
  const mine = words && view && words.page === view.page ? words : null;
  const pieces = useMemo(
    () =>
      mine
        ? mine.runs.map(([text, left, top, w, h], index) => ({ key: index, text, left, top, w, h }))
        : [],
    [mine],
  );

  // Each piece's natural width at this size, then the stretch that makes it cover its words. The
  // stretch does not change with zoom (the font grows with the page), so this runs once per page.
  useIsoLayoutEffect(() => {
    const el = layer.current;
    if (!el || !pieces.length || !width) return;
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
  }, [pieces, ready]);

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
  }, [ready, mine]);

  const problem = failed || (pictureFailed ? "ما قدرت أفتح الصفحة" : "");

  return (
    <div
      ref={box}
      className="bkr-page"
      style={{ width, height }}
      data-loaded={ready ? "" : undefined}
    >
      {/* The page's real lines, faint, until its picture is in. */}
      {!ready && mine && (
        <div className="bkr-ghost" aria-hidden="true">
          {mine.runs.slice(0, GHOST_MAX).map(([, left, top, w, h], index) => (
            <i
              key={index}
              style={{
                left: `${left * 100}%`,
                top: `${(top + h * 0.2) * 100}%`,
                width: `${w * 100}%`,
                height: `${h * 60}%`,
              }}
            />
          ))}
        </div>
      )}
      {ready && sharp && (
        <img
          key={sharp.url}
          src={sharp.url}
          alt=""
          className={`bkr-picture${sharp.fade ? " is-fading" : ""}`}
          draggable={false}
        />
      )}
      {ready && mine && (
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
      {view && !view.hasText && ready && <p className="bkr-badge">صفحة صورة بدون نص، ما بتنحدد</p>}
      {!ready && slow && !problem && (
        <span className="bkr-spin" role="status" aria-label="جاري تحميل الصفحة">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        </span>
      )}
      {problem && (
        <button
          type="button"
          className="bkr-retry"
          onClick={() => {
            setPictureFailed(false);
            setAttempt((n) => n + 1);
            onRetry();
          }}
        >
          <RotateCcw size={14} aria-hidden="true" />
          {problem} · جرّب مرة ثانية
        </button>
      )}
    </div>
  );
});
