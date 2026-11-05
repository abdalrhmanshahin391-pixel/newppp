import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import { UzyraMark } from "@/components/brand/UzyraMark";
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

const RADIUS = 26;
const KEY = "uzyra-window-rect";
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
 * A dark floating window over the study page, in the manner of iPadOS windows: continuous
 * (squircle) corners, a hairline edge and a deep soft shadow, a grabber above it to move it (a double
 * tap on the grabber or the bar fills the work area and brings it back), an X above its corner that
 * hides it (the page's ••• brings it back), and corners to resize it. Type is compact, as in pro
 * tools. The page behind keeps working. It grows out of the circle and goes back into it, with the
 * circle's sounds. Its place and size are remembered.
 */
export function FloatingWindow({
  title,
  variant,
  origin,
  shown,
  onHidden,
  children,
}: {
  title: string;
  /** A light question workspace inside the existing dark window chrome. */
  variant?: "questions";
  /** The circle's centre in the work area, where the window grows from and returns to. */
  origin: { x: number; y: number };
  /** False hides it (it stays mounted, so its content keeps its state). */
  shown: boolean;
  /** The X was pressed and the window has finished going away. */
  onHidden: () => void;
  children: ReactNode;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const motion = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<Size>({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const [max, setMax] = useState(false);
  const [active, setActive] = useState<"" | "move" | "resize">("");
  const [visible, setVisible] = useState(false);
  const before = useRef<Rect | null>(null);
  const lastTap = useRef(0);

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
      if (max) return maximisedRect(area);
      const preferred =
        variant === "questions"
          ? { w: Math.min(960, area.w * 0.88), h: Math.min(700, area.h * 0.88) }
          : null;
      const initial = preferred
        ? { ...preferred, x: (area.w - preferred.w) / 2, y: (area.h - preferred.h) / 2 }
        : defaultRect(area);
      return clampRect(current ?? readSaved() ?? initial, area);
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
        ? { opacity: 0, transform: "none", filter: "blur(0px)" }
        : { opacity: 0, transform: "scale(0.86)", filter: "blur(6px)" };
      const full = { opacity: 1, transform: "scale(1)", filter: "blur(0px)" };
      const animation = el.animate(show ? [hidden, full] : [full, hidden], {
        duration: reduce ? 160 : show ? 460 : 280,
        easing: show ? SPRING : "cubic-bezier(0.4, 0, 1, 1)",
        fill: "both",
      });
      animation.onfinish = () => done?.();
    },
    [origin.x, origin.y, rect],
  );

  // Shown / hidden by the page: grow out of the circle, or go back into it.
  useEffect(() => {
    if (!rect) return;
    if (shown && !visible) {
      setVisible(true);
      menuOpenSound();
      requestAnimationFrame(() => animate(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, rect]);

  const hide = useCallback(() => {
    menuCloseSound();
    animate(false, () => {
      setVisible(false);
      onHidden();
    });
  }, [animate, onHidden]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && holder.current?.contains(document.activeElement)) hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hide]);

  function toggleMax() {
    if (!rect) return;
    if (max) {
      const back = clampRect(before.current ?? defaultRect(area), area);
      setRect(back);
      setMax(false);
      save(back);
    } else {
      before.current = rect;
      setRect(maximisedRect(area));
      setMax(true);
    }
  }

  /** Moving (from the grabber or the bar) and resizing (from a corner) share one pointer flow. */
  function startGesture(event: ReactPointerEvent<HTMLElement>, kind: "move" | Corner) {
    if (!rect || event.button > 0) return;
    event.preventDefault();
    const el = event.currentTarget;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
    if (kind === "move") {
      // A double tap fills the area or brings it back, as on iPad.
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
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      const dx = move.clientX - x0;
      const dy = move.clientY - y0;
      latest =
        kind === "move" ? moveRect(start, dx, dy, area) : resizeRect(start, kind, dx, dy, area);
      if (max && Math.hypot(dx, dy) > 6) setMax(false);
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
    <div
      ref={holder}
      className={`fw${variant === "questions" ? " is-questions" : ""}`}
      data-max={max || undefined}
      data-active={active || undefined}
      hidden={!rect || !visible}
      style={
        rect
          ? { width: rect.w, height: rect.h, transform: `translate3d(${rect.x}px, ${rect.y}px, 0)` }
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
          <div className="fw-bar" dir="ltr" onPointerDown={(event) => startGesture(event, "move")}>
            <p className="fw-title">
              <UzyraMark className="fw-mark" />
              {title}
            </p>
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
          aria-label="اسحب النافذة (دبل كليك لتكبيرها)"
          onPointerDown={(event) => startGesture(event, "move")}
        >
          <span />
        </button>
        <button type="button" className="fw-x" aria-label="أخفِ النافذة" onClick={hide}>
          <X size={13} strokeWidth={2.6} aria-hidden="true" />
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
  );
}

/**
 * The three dots at the bottom middle of the work area while the window is hidden. Pressing them
 * opens a small menu: bring the window back, or close it for good.
 */
export function WindowDots({
  title,
  onShow,
  onClose,
}: {
  title: string;
  onShow: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  }, [open]);
  return (
    <div ref={box} className="fw-dots-wrap">
      {open && (
        <div className="fw-dots-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onShow();
            }}
          >
            <UzyraMark className="fw-mark" />
            {title}
          </button>
          <button
            type="button"
            role="menuitem"
            className="is-quiet"
            onClick={() => {
              setOpen(false);
              onClose();
            }}
          >
            <X size={14} aria-hidden="true" />
            سكّرها نهائياً
          </button>
        </div>
      )}
      <button
        type="button"
        className="fw-dots"
        aria-label="النوافذ المخفية"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>
    </div>
  );
}
