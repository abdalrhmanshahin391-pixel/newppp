import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { menuCloseSound, menuOpenSound } from "./tech-sound";
import {
  clampRect,
  defaultRect,
  maximisedRect,
  moveRect,
  resizeRect,
  squirclePath,
  type Corner,
  type Rect,
  type Size,
} from "./window-geometry";

const RADIUS = 28;
const KEY = "uzyra-window-rect";
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Mode = "normal" | "max" | "min";

function readSaved(): Rect | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (raw && [raw.x, raw.y, raw.w, raw.h].every((n) => Number.isFinite(n))) return raw as Rect;
  } catch {
    /* blocked or broken storage: open in the middle */
  }
  return null;
}

function save(rect: Rect) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rect));
  } catch {
    /* the place is remembered for this visit only */
  }
}

/**
 * A floating window over the study page, in the manner of iPadOS windows: continuous (squircle)
 * corners, a hairline edge and a soft two-layer shadow, a grabber above it to move it, the three
 * coloured buttons (close, minimise, fill the work area), and corners to resize it (the bottom-right
 * one shows the curved handle). The page behind keeps working: there is no backdrop. It opens out of
 * the circle and goes back into it, with the circle's sounds. Its place and size are remembered.
 */
export function FloatingWindow({
  title,
  origin,
  onClose,
  children,
}: {
  title: string;
  /** The circle's centre in the work area, where the window grows from and returns to. */
  origin: { x: number; y: number };
  onClose: () => void;
  children: ReactNode;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const motion = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<Size>({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const [mode, setMode] = useState<Mode>("normal");
  const [active, setActive] = useState<"" | "move" | "resize">("");
  const before = useRef<Rect | null>(null);
  const closing = useRef(false);
  const lastTap = useRef(0);
  const wasMax = useRef(false);

  // The work area the window lives in (the window's parent), followed as it changes size.
  useIsoLayoutEffect(() => {
    const parent = holder.current?.parentElement;
    if (!parent) return;
    const measure = () => setArea({ w: parent.clientWidth, h: parent.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // First place: where it was last time, else in the middle; always kept inside the area.
  useEffect(() => {
    if (!area.w || !area.h) return;
    setRect((current) => {
      if (mode === "max") return maximisedRect(area);
      const base = current ?? readSaved() ?? defaultRect(area);
      return clampRect(base, area);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.w, area.h]);

  /** Grows out of (or shrinks back into) the circle. */
  const animate = useCallback(
    (show: boolean, done?: () => void) => {
      const el = motion.current;
      if (!el || !rect) return done?.();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.style.transformOrigin = `${origin.x - rect.x}px ${origin.y - rect.y}px`;
      const hidden = reduce
        ? { opacity: 0, transform: "none" }
        : { opacity: 0, transform: "scale(0.86)", filter: "blur(6px)" };
      const shown = { opacity: 1, transform: "scale(1)", filter: "blur(0px)" };
      const animation = el.animate(show ? [hidden, shown] : [shown, hidden], {
        duration: reduce ? 160 : show ? 460 : 300,
        easing: show ? SPRING : "cubic-bezier(0.4, 0, 1, 1)",
        fill: "both",
      });
      animation.onfinish = () => done?.();
    },
    [origin.x, origin.y, rect],
  );

  // Opening: once it has a place, grow out of the circle with the circle's sound.
  const opened = useRef(false);
  useEffect(() => {
    if (!rect || opened.current) return;
    opened.current = true;
    menuOpenSound();
    animate(true);
  }, [rect, animate]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    menuCloseSound();
    animate(false, onClose);
  }, [animate, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && holder.current?.contains(document.activeElement)) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  function toggleMax() {
    if (!rect) return;
    if (mode === "max") {
      const back = clampRect(before.current ?? defaultRect(area), area);
      setRect(back);
      setMode("normal");
      save(back);
    } else {
      before.current = rect;
      setRect(maximisedRect(area));
      setMode("max");
    }
  }

  function minimise() {
    wasMax.current = mode === "max";
    menuCloseSound();
    animate(false, () => setMode("min"));
  }

  function restore() {
    setMode(wasMax.current ? "max" : "normal");
    menuOpenSound();
    requestAnimationFrame(() => animate(true));
  }

  /** Moving (from the grabber or the bar) and resizing (from a corner) share one pointer flow. */
  function startGesture(event: ReactPointerEvent<HTMLElement>, kind: "move" | Corner) {
    if (!rect || event.button > 0) return;
    if ((event.target as HTMLElement).closest(".fw-lights")) return;
    event.preventDefault();
    const el = event.currentTarget;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
    if (kind === "move") {
      // A double tap on the bar fills the area or brings it back, as on iPad.
      const now = performance.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        toggleMax();
        return;
      }
      lastTap.current = now;
    }
    const start = rect;
    const x0 = event.clientX;
    const y0 = event.clientY;
    let latest = start;
    setActive(kind === "move" ? "move" : "resize");
    if (mode === "max" && kind !== "move") setMode("normal");
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      const dx = move.clientX - x0;
      const dy = move.clientY - y0;
      latest =
        kind === "move" ? moveRect(start, dx, dy, area) : resizeRect(start, kind, dx, dy, area);
      if (kind === "move" && mode === "max" && Math.hypot(dx, dy) > 6) setMode("normal");
      setRect(latest);
    };
    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== event.pointerId) return;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      setActive("");
      save(latest);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  const shape = rect ? squirclePath(rect.w, rect.h, RADIUS) : "";

  return (
    <>
      <div
        ref={holder}
        className="fw"
        data-mode={mode}
        data-active={active || undefined}
        hidden={!rect || mode === "min"}
        style={
          rect
            ? {
                width: rect.w,
                height: rect.h,
                transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
              }
            : undefined
        }
      >
        <div ref={motion} className="fw-motion" style={{ opacity: 0 }}>
          <span className="fw-shadow" aria-hidden="true" />
          <div
            className="fw-frame"
            role="dialog"
            aria-label={title}
            style={{ clipPath: `path('${shape}')`, WebkitClipPath: `path('${shape}')` }}
          >
            <div
              className="fw-bar"
              dir="ltr"
              onPointerDown={(event) => startGesture(event, "move")}
            >
              <div className="fw-lights">
                <button
                  type="button"
                  className="is-close"
                  aria-label="سكّر النافذة"
                  onClick={close}
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M3 3l4 4M7 3L3 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="is-min"
                  aria-label="صغّر النافذة"
                  onClick={minimise}
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2.6 5h4.8" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="is-max"
                  aria-label={mode === "max" ? "رجّع حجمها" : "كبّرها لتعبي المكان"}
                  aria-pressed={mode === "max"}
                  onClick={toggleMax}
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M3 6.6V3h3.6M7 3.4V7H3.4" />
                  </svg>
                </button>
              </div>
              <p className="fw-title">{title}</p>
            </div>
            <div className="fw-body">{children}</div>
          </div>
          {rect && (
            <svg
              className="fw-edge"
              width={rect.w}
              height={rect.h}
              viewBox={`0 0 ${rect.w} ${rect.h}`}
              aria-hidden="true"
            >
              <path d={shape} />
            </svg>
          )}
          <button
            type="button"
            className="fw-grab"
            aria-label="اسحب النافذة"
            onPointerDown={(event) => startGesture(event, "move")}
          >
            <span />
          </button>
          {(["tl", "tr", "bl", "br"] as Corner[]).map((corner) => (
            <span
              key={corner}
              className={`fw-corner is-${corner}`}
              onPointerDown={(event) => startGesture(event, corner)}
              aria-hidden="true"
            />
          ))}
          <svg className="fw-arc" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 6.5c0 8-6.5 14.5-14.5 14.5" />
          </svg>
        </div>
      </div>
      {mode === "min" && (
        <button type="button" className="fw-dock" onClick={restore}>
          <span className="fw-dock-dot" aria-hidden="true" />
          {title}
        </button>
      )}
    </>
  );
}
