// The progress line over the page, made into a scrubber (the page-pane plan, phase 3b). It stays
// the same 3px accent line; pressing it (a 28px band around it takes the finger) thickens it to
// 6px with a knob, and a card follows the pointer with the page's little picture (160px), its
// number and its chapter. The full page is fetched only on release. A click jumps; on a computer,
// hovering shows the card without jumping. Escape while dragging goes back to where you were.
//
// The little pictures' links are signed in one batch for the 41 pages around the pointer (and
// reused), so dragging does not sign page by page.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { thumbHashToDataURL } from "thumbhash";
import type { BookManifest } from "@/lib/book-reader-data";
import { linksMissing, signPagePaths } from "@/lib/book-reader-data";
import {
  base64ToBytes,
  chapterAt,
  chapterTicks,
  scrubPage,
  scrubSpot,
  scrubWindow,
  tierPath,
} from "@/lib/books-reader";

const CARD = 240;
const THUMB = 120;

type Props = {
  bookId: string;
  userId: string;
  page: number;
  total: number;
  rtl: boolean;
  manifest: BookManifest | null;
  onJump: (page: number) => void;
  /** True while the card is shown (the page-number toast hides meanwhile). */
  onScrubbing: (on: boolean) => void;
};

export function BookScrubber({
  bookId,
  userId,
  page,
  total,
  rtl,
  manifest,
  onJump,
  onScrubbing,
}: Props) {
  const track = useRef<HTMLDivElement | null>(null);
  // The line's length, for chapter ticks that keep apart.
  const [lineWidth, setLineWidth] = useState(0);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const read = () => setLineWidth(el.clientWidth);
    const observer = new ResizeObserver(read);
    observer.observe(el);
    read();
    return () => observer.disconnect();
  }, []);
  // The page under the pointer and where the pointer is (px from the line's left end).
  const [at, setAt] = useState<{ page: number; x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const [thumb, setThumb] = useState<{ page: number; url: string } | null>(null);
  const [thumbFailed, setThumbFailed] = useState<number | null>(null);

  const thumbPath = (n: number): string | null => {
    const entry = manifest?.pages[n - 1];
    return entry && entry.tiers.includes("thumb") ? tierPath(bookId, n, "thumb", entry.type) : null;
  };

  const shown = at !== null;
  useEffect(() => onScrubbing(shown), [shown, onScrubbing]);

  // The little picture of the page under the pointer: signed with its neighbours in one batch.
  const atPage = at?.page ?? 0;
  useEffect(() => {
    if (!atPage) return;
    const path = thumbPath(atPage);
    if (!path) return;
    let alive = true;
    const around = scrubWindow(atPage, total)
      .map((n) => thumbPath(n))
      .filter((p): p is string => Boolean(p));
    const missing = linksMissing(userId, around);
    const wanted = missing.includes(path) || missing.length >= 8 ? around : [path];
    void signPagePaths(userId, wanted)
      .then((links) => {
        if (alive && links[path]) setThumb({ page: atPage, url: links[path] });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // thumbPath depends on the manifest and the book only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atPage, total, userId, bookId, manifest]);

  const entry = atPage ? manifest?.pages[atPage - 1] : undefined;
  const preview = useMemo(() => {
    if (!entry?.thumbhash) return null;
    try {
      return thumbHashToDataURL(base64ToBytes(entry.thumbhash));
    } catch {
      return null;
    }
  }, [entry?.thumbhash]);
  const chapter = atPage && manifest ? chapterAt(manifest.outline, atPage) : null;

  const pointAt = (clientX: number) => {
    const el = track.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const x = Math.min(box.width, Math.max(0, clientX - box.left));
    return { page: scrubPage(x, box.width, total, rtl), x, width: box.width };
  };

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (total <= 1 || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    setAt(pointAt(event.clientX));
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (total <= 1) return;
    // Hover shows the card on a computer only; on touch the card belongs to the drag.
    if (!draggingRef.current && event.pointerType !== "mouse") return;
    setAt(pointAt(event.clientX));
  };
  const finish = (jump: boolean, clientX?: number) => {
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    setDragging(false);
    if (wasDragging && jump && clientX !== undefined) {
      const spot = pointAt(clientX);
      if (spot && spot.page !== page) onJump(spot.page);
    }
  };
  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    finish(true, event.clientX);
    if (event.pointerType !== "mouse") setAt(null);
  };
  const onCancel = () => {
    finish(false);
    setAt(null);
  };
  const onLeave = () => {
    if (!draggingRef.current) setAt(null);
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && draggingRef.current) {
      event.preventDefault();
      onCancel();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onJump(event.key === "Home" ? 1 : total);
    }
  };
  // Escape also works when the line itself does not have the focus.
  useEffect(() => {
    if (!dragging) return;
    const onEsc = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      draggingRef.current = false;
      setDragging(false);
      setAt(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [dragging]);

  const fill = scrubSpot(page, total, rtl);
  const ticks = useMemo(
    () => (manifest ? chapterTicks(manifest.outline, total, lineWidth, rtl) : []),
    [manifest, total, lineWidth, rtl],
  );
  const knob = at ? at.x / Math.max(1, at.width) : fill;
  const ratio = entry ? Math.min(1.42, entry.height / entry.width) : 1.3;
  const cardLeft = at ? Math.min(Math.max(at.x - CARD / 2, 8), at.width - CARD - 8) : 0;
  const hasThumb = Boolean(atPage && thumbPath(atPage));
  const showPicture = hasThumb && thumbFailed !== atPage;

  return (
    <div className={`bkr-scrub${dragging ? " is-active" : ""}`} data-dir={rtl ? "rtl" : "ltr"}>
      <div
        ref={track}
        className="bkr-scrub-hit"
        role="slider"
        tabIndex={0}
        aria-label="وين وصلت بالكتاب"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={page}
        aria-valuetext={`صفحة ${page} من ${total}`}
        aria-orientation="horizontal"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onPointerLeave={onLeave}
        onKeyDown={onKey}
      >
        <div className="bkr-progress" data-dir={rtl ? "rtl" : "ltr"}>
          <span style={{ transform: `scaleX(${(page / Math.max(1, total)).toFixed(4)})` }} />
          {ticks.map((part) => (
            <i
              key={part}
              className="bkr-tick"
              style={{ left: `${(part * 100).toFixed(3)}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
        {dragging && (
          <i className="bkr-scrub-knob" style={{ left: `${(knob * 100).toFixed(2)}%` }} />
        )}
      </div>
      {at && (
        <div className="bkr-scrub-card" style={{ left: cardLeft, width: CARD }} aria-hidden="true">
          {showPicture && (
            <div
              className="bkr-scrub-thumb"
              style={{
                width: THUMB,
                height: Math.round(THUMB * ratio),
                background: entry?.color ?? undefined,
              }}
            >
              {preview && <img src={preview} alt="" className="bkr-scrub-blur" draggable={false} />}
              {thumb?.page === atPage && (
                <img
                  key={thumb.url}
                  src={thumb.url}
                  alt=""
                  draggable={false}
                  onError={() => setThumbFailed(atPage)}
                />
              )}
            </div>
          )}
          <p className="bkr-scrub-label">
            <span>
              صفحة {atPage} من {total}
            </span>
            {chapter && (
              <>
                <span className="bkr-scrub-dot" aria-hidden="true">
                  ·
                </span>
                <bdi className="bkr-scrub-chapter">{chapter}</bdi>
              </>
            )}
          </p>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {dragging && atPage ? `صفحة ${atPage}` : ""}
      </p>
    </div>
  );
}
