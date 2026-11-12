import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronsRight, X } from "lucide-react";
import { UzyraMark } from "@/components/brand/UzyraMark";
import { menuCloseSound, menuOpenSound } from "./tech-sound";
import {
  clampRect,
  defaultRect,
  dockedRect,
  EDGE,
  maximisedRect,
  overflowRight,
  project,
  resizeRect,
  rubberband,
  shouldOpen,
  shouldTuck,
  springAtRest,
  springFrom,
  springStep,
  squirclePath,
  tabCenter,
  TUCK_SHARE,
  tuckedOffset,
  velocityOf,
  type Corner,
  type Rect,
  type Size,
  type SpringParams,
} from "./window-geometry";

const RADIUS = 26;
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Springs in Apple's terms (response in seconds, damping 1 = no overshoot). A bounce only when a
// flick carried the window; a tap or a key brings it in calmly.
const TUCK_SPRING = springFrom(0.32, 0.86);
const OPEN_SPRING = springFrom(0.4, 1);
const FLICK_SPRING = springFrom(0.35, 0.82);
const SETTLE_SPRING = springFrom(0.3, 1);
/** Below this the release is a tap, not a pull. */
const TAP_TRAVEL = 6;
/** A swipe from the edge starts once the finger has gone this far, mostly sideways. */
const EDGE_SLOP = 8;
const TAB_HALF = 44;

type Variant = "questions" | "practice";
/** The tab on the right edge: not there, a hint while the window is pushed out, or in use. */
type TabState = "off" | "hint" | "armed" | "on" | "pulling";

const storageKey = (variant?: Variant) =>
  variant === "practice" ? "uzyra-window-rect:practice" : "uzyra-window-rect";

function readSaved(variant?: Variant): Rect | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(storageKey(variant)) ?? "null");
    if (raw && [raw.x, raw.y, raw.w, raw.h].every((n) => Number.isFinite(n))) return raw as Rect;
  } catch {
    /* blocked or broken storage: open in the middle */
  }
  return null;
}

function save(rect: Rect, variant?: Variant) {
  try {
    window.localStorage.setItem(storageKey(variant), JSON.stringify(rect));
  } catch {
    /* the place is remembered for this visit only */
  }
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A dark floating window over the study page, in the manner of iPadOS windows: continuous
 * (squircle) corners, a hairline edge and a deep soft shadow, a grabber above it to move it (a double
 * tap on the grabber or the bar fills the work area and brings it back), an X above its corner that
 * hides it (the page's ••• brings it back), and corners to resize it. Type is compact, as in pro
 * tools. The page behind keeps working. It grows out of the circle and goes back into it, with the
 * circle's sounds. Its place and size are remembered.
 *
 * As iPad's Slide Over, it also goes off the right edge: pushed past the edge (or flicked towards
 * it) or with the bar's » button. A small tab stays on the edge; a tap on it, a pull to the left, or
 * (on touch screens) a swipe in from the edge brings the window back against the right edge. The
 * motion follows the finger, carries on with its speed, and can be caught and reversed at any time.
 */
export function FloatingWindow({
  title,
  variant,
  origin,
  shown,
  onHidden,
  revealSignal = 0,
  tabLabel = "أظهر النافذة",
  children,
}: {
  title: string;
  /** "questions": a light question workspace; "practice": the cards and questions made from a selection. */
  variant?: Variant;
  /** The circle's centre in the work area, where the window grows from and returns to. */
  origin: { x: number; y: number };
  /** False hides it (it stays mounted, so its content keeps its state). */
  shown: boolean;
  /** The X was pressed and the window has finished going away. */
  onHidden: () => void;
  /** Changing it brings the window back from the side (new content arrived). */
  revealSignal?: number;
  /** The tab's name for screen readers and keyboards. */
  tabLabel?: string;
  children: ReactNode;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLDivElement>(null);
  const motion = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const tab = useRef<HTMLButtonElement>(null);
  const [area, setArea] = useState<Size>({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const [max, setMax] = useState(false);
  const [active, setActive] = useState<"" | "move" | "resize">("");
  const [visible, setVisible] = useState(false);
  const [tucked, setTucked] = useState(false);
  const [tabState, setTabStateRaw] = useState<TabState>("off");
  const before = useRef<Rect | null>(null);
  const lastTap = useRef(0);
  // The latest values, for gestures and animation frames that outlive a render.
  const rectRef = useRef<Rect | null>(null);
  rectRef.current = rect;
  const areaRef = useRef(area);
  areaRef.current = area;
  const tuckedRef = useRef(false);
  tuckedRef.current = tucked;
  const tabRef = useRef<TabState>("off");
  /** How far the window is slid to the right of its place (px); written straight to the page. */
  const slide = useRef(0);
  const spring = useRef<number | null>(null);

  const setTab = useCallback((next: TabState) => {
    if (tabRef.current === next) return;
    tabRef.current = next;
    setTabStateRaw(next);
  }, []);

  /** Puts the slide on the page now (no render): a transform on its own layer. */
  const setSlide = useCallback((value: number) => {
    slide.current = value;
    const el = slider.current;
    if (el) el.style.transform = value ? `translate3d(${value}px, 0, 0)` : "";
  }, []);

  /** Moves the window to a new place now, before React renders the same place. */
  const placeNow = useCallback((next: Rect) => {
    rectRef.current = next;
    const el = holder.current;
    if (el) {
      el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      el.style.width = `${next.w}px`;
      el.style.height = `${next.h}px`;
    }
    setRect(next);
  }, []);

  /** The fade used instead of a slide under reduced motion; a new gesture cancels it too. */
  const fading = useRef<Animation | null>(null);

  const stopSpring = useCallback(() => {
    if (spring.current !== null) cancelAnimationFrame(spring.current);
    spring.current = null;
    fading.current?.cancel();
    fading.current = null;
  }, []);

  /** Springs the slide to `target`, starting at the finger's speed; a new gesture stops it where it is. */
  const springSlide = useCallback(
    (target: number, velocity: number, params: SpringParams, done?: () => void) => {
      stopSpring();
      let x = slide.current;
      let v = velocity;
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.064, Math.max(0, (now - last) / 1000));
        last = now;
        [x, v] = springStep(x, v, target, dt, params);
        if (springAtRest(x, v, target)) {
          spring.current = null;
          setSlide(target);
          done?.();
          return;
        }
        setSlide(x);
        spring.current = requestAnimationFrame(tick);
      };
      spring.current = requestAnimationFrame(tick);
    },
    [setSlide, stopSpring],
  );

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

  // First place: where it was last time, else its own place; always kept inside the area.
  useEffect(() => {
    if (!area.w || !area.h) return;
    setRect((current) => {
      if (max) return maximisedRect(area);
      let initial: Rect;
      if (variant === "questions") {
        const w = Math.min(960, area.w * 0.88);
        const h = Math.min(700, area.h * 0.88);
        initial = { w, h, x: (area.w - w) / 2, y: (area.h - h) / 2 };
      } else if (variant === "practice") {
        // Beside the lesson, against the right edge, as iPad's Slide Over.
        const w = Math.min(460, area.w - EDGE * 2);
        const h = Math.min(620, area.h - EDGE * 2);
        initial = dockedRect({ w, h, x: 0, y: (area.h - h) / 2 }, area);
      } else initial = defaultRect(area);
      return clampRect(current ?? readSaved(variant) ?? initial, area);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.w, area.h]);

  // While it is on the side, a change of the area (a turned iPad, Split View) keeps it fully out.
  useEffect(() => {
    const current = rectRef.current;
    if (tuckedRef.current && current && spring.current === null && tabRef.current === "on")
      setSlide(tuckedOffset(current, area));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.w, area.h, rect?.x]);

  useEffect(() => () => stopSpring(), [stopSpring]);

  /** Grows out of (or shrinks back into) the circle. */
  const animate = useCallback(
    (show: boolean, done?: () => void) => {
      const el = motion.current;
      if (!el || !rect) return done?.();
      const reduce = reducedMotion();
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
      // Never comes back half on the side.
      stopSpring();
      setSlide(0);
      setTucked(false);
      setTab("off");
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

  /** A quick fade instead of the slide, for people who asked for less motion. */
  function fade(show: boolean, done: () => void) {
    const el = motion.current;
    if (!el) return done();
    const animation = el.animate([{ opacity: show ? 0 : 1 }, { opacity: show ? 1 : 0 }], {
      duration: 160,
      easing: "ease-out",
    });
    fading.current = animation;
    animation.onfinish = () => {
      fading.current = null;
      done();
    };
  }

  /** Sends the window off the right edge (the tab stays). `velocity` is the finger's, if any. */
  const tuck = useCallback(
    (velocity = 0) => {
      const current = rectRef.current;
      if (!current) return;
      const hadFocus = holder.current?.contains(document.activeElement) ?? false;
      const target = tuckedOffset(current, areaRef.current);
      setTab("on");
      // On the side (and out of reach of the keyboard) only once it is all the way out: until
      // then it can still be caught and pulled back.
      const finish = () => {
        setTucked(true);
        if (hadFocus) requestAnimationFrame(() => tab.current?.focus({ preventScroll: true }));
      };
      if (reducedMotion()) {
        stopSpring();
        fade(false, () => {
          setSlide(target);
          finish();
        });
        return;
      }
      springSlide(target, Math.max(0, velocity), TUCK_SPRING, finish);
    },

    [setSlide, setTab, springSlide, stopSpring],
  );

  /**
   * Brings the window back from the side, against the right edge at the same height. The window
   * keeps its place on screen while its home moves, so nothing jumps.
   */
  const reveal = useCallback(
    (velocity = 0, focus = true) => {
      const current = rectRef.current;
      if (!current) return;
      stopSpring();
      const home = dockedRect(current, areaRef.current);
      const onScreen = current.x + slide.current;
      placeNow(home);
      setSlide(onScreen - home.x);
      setTucked(false);
      setTab("off");
      const settle = () => {
        save(home, variant);
        if (focus) frame.current?.focus({ preventScroll: true });
      };
      if (reducedMotion()) {
        setSlide(0);
        fade(true, settle);
        return;
      }
      springSlide(0, Math.min(0, velocity), velocity < -200 ? FLICK_SPRING : OPEN_SPRING, settle);
    },

    [placeNow, setSlide, setTab, springSlide, stopSpring, variant],
  );

  // New content while on the side: the window comes back by itself.
  const firstSignal = useRef(revealSignal);
  useEffect(() => {
    if (revealSignal === firstSignal.current) return;
    firstSignal.current = revealSignal;
    if (tuckedRef.current) reveal(0, false);
  }, [revealSignal, reveal]);

  function toggleMax() {
    if (!rect) return;
    if (max) {
      const back = clampRect(before.current ?? defaultRect(area), area);
      setRect(back);
      setMax(false);
      save(back, variant);
    } else {
      before.current = rect;
      setRect(maximisedRect(area));
      setMax(true);
    }
  }

  /**
   * Moving (from the grabber or the bar) and resizing (from a corner) share one pointer flow. A
   * move may push the window past the right edge; let go there (or flick it that way) and it goes
   * to the side, otherwise it springs back in.
   */
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
        stopSpring();
        setSlide(0);
        toggleMax();
        return;
      }
      lastTap.current = now;
    }
    // Caught mid-flight: carry on from where it is on screen.
    stopSpring();
    const start = rect;
    const startX = rect.x + slide.current;
    const x0 = event.clientX;
    const y0 = event.clientY;
    let latest = start;
    const samples = [{ t: event.timeStamp, x: event.clientX }];
    setActive(kind === "move" ? "move" : "resize");
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      const dx = move.clientX - x0;
      const dy = move.clientY - y0;
      if (kind === "move") {
        samples.push({ t: move.timeStamp, x: move.clientX });
        if (samples.length > 12) samples.shift();
        const raw = startX + dx;
        latest = clampRect({ ...start, x: raw, y: start.y + dy }, area);
        const over = overflowRight(raw, start, area);
        setSlide(over);
        // The tab shows where the window will go, and lights up once letting go would send it.
        const v = velocityOf(samples);
        setTab(
          over <= 0
            ? "off"
            : over + Math.max(0, project(v)) > start.w * TUCK_SHARE
              ? "armed"
              : "hint",
        );
      } else latest = resizeRect(start, kind, dx, dy, area);
      if (max && Math.hypot(dx, dy) > 6) setMax(false);
      setRect(latest);
    };
    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== event.pointerId) return;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      setActive("");
      rectRef.current = latest;
      save(latest, variant);
      if (kind !== "move" || slide.current <= 0) return;
      // The release itself counts: a pause before letting go means no flick.
      samples.push({ t: up.timeStamp, x: up.clientX });
      const v = up.type === "pointercancel" ? 0 : velocityOf(samples);
      if (shouldTuck(slide.current, v, latest.w)) tuck(v);
      else {
        setTab("off");
        springSlide(0, Math.min(0, v), SETTLE_SPRING);
      }
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  /**
   * Pulling the window in from the side: from the tab (a tap opens it) or, on touch screens, a
   * swipe in from the right edge (it starts only once the finger goes mostly sideways, to the left).
   */
  function startPull(event: ReactPointerEvent<HTMLElement>, fromEdge: boolean) {
    const current = rectRef.current;
    if (!current || event.button > 0) return;
    const el = event.currentTarget;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
    stopSpring();
    const x0 = event.clientX;
    const y0 = event.clientY;
    const samples = [{ t: event.timeStamp, x: event.clientX }];
    let pulling = false;
    let home = current;
    let off = 0;
    let startSlide = 0;
    const begin = () => {
      pulling = true;
      // The window's home becomes its place against the right edge, without moving it on screen.
      home = dockedRect(current, areaRef.current);
      const onScreen = current.x + slide.current;
      placeNow(home);
      startSlide = onScreen - home.x;
      off = tuckedOffset(home, areaRef.current);
      setSlide(startSlide);
      setTab("pulling");
    };
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      const dx = move.clientX - x0;
      const dy = move.clientY - y0;
      samples.push({ t: move.timeStamp, x: move.clientX });
      if (samples.length > 12) samples.shift();
      if (!pulling) {
        if (fromEdge) {
          if (Math.hypot(dx, dy) < EDGE_SLOP) return;
          // Up, down or to the right: not a pull, leave it.
          if (dx > -EDGE_SLOP || Math.abs(dx) < Math.abs(dy) * 1.5) return finish(null);
        } else if (Math.abs(dx) < TAP_TRAVEL) return;
        begin();
      }
      const raw = startSlide + dx;
      // Past its place it resists, as at the end of a list; never further out than off.
      setSlide(raw < 0 ? -rubberband(-raw, home.w) : Math.min(raw, off));
    };
    const finish = (up: PointerEvent | null) => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (!up) return;
      if (!pulling) {
        // A tap on the tab opens it; a touch on the edge that went nowhere does nothing.
        if (!fromEdge && up.type === "pointerup") reveal(0);
        return;
      }
      samples.push({ t: up.timeStamp, x: up.clientX });
      const v = up.type === "pointercancel" ? 0 : velocityOf(samples);
      if (shouldOpen(off - slide.current, v, home.w)) reveal(v);
      else {
        setTab("on");
        springSlide(off, Math.max(0, v), TUCK_SPRING, () => setTucked(true));
      }
    };
    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== event.pointerId) return;
      finish(up);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  const shape = rect ? squirclePath(rect.w, rect.h, RADIUS) : "";
  const live = Boolean(rect && visible);

  return (
    <>
      <div
        ref={holder}
        className={`fw${variant === "questions" ? " is-questions" : ""}${variant === "practice" ? " is-practice" : ""}`}
        data-max={max || undefined}
        data-active={active || undefined}
        data-tucked={tucked || undefined}
        hidden={!live}
        inert={tucked || undefined}
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
        <div ref={slider} className="fw-slide">
          <div ref={motion} className="fw-motion" style={{ opacity: 0 }}>
            <span className="fw-shadow" aria-hidden="true" />
            <div
              ref={frame}
              className="fw-frame"
              role="dialog"
              aria-label={title}
              tabIndex={-1}
              style={{ clipPath: `path('${shape}')`, WebkitClipPath: `path('${shape}')` }}
            >
              <div
                className="fw-bar"
                dir="ltr"
                onPointerDown={(event) => startGesture(event, "move")}
              >
                <p className="fw-title">
                  <UzyraMark className="fw-mark" />
                  {title}
                </p>
                <button
                  type="button"
                  className="fw-dock"
                  aria-label="زيح النافذة لليمين"
                  title="زيح النافذة لليمين"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => tuck(0)}
                >
                  <ChevronsRight size={15} strokeWidth={2.2} aria-hidden="true" />
                </button>
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
      </div>
      {live && rect && (
        <button
          ref={tab}
          type="button"
          className="fw-tab"
          data-state={tabState}
          style={{ top: tabCenter(rect, area, TAB_HALF) - TAB_HALF }}
          aria-label={tabLabel}
          aria-hidden={tucked ? undefined : true}
          tabIndex={tucked ? 0 : -1}
          onPointerDown={(event) => tabRef.current === "on" && startPull(event, false)}
          onClick={(event) => {
            // A key (Enter or Space) clicks with no pointer; a tap is handled on pointer up.
            if (tabRef.current === "on" && event.detail === 0) reveal(0);
          }}
        >
          <span className="fw-tab-pill">
            <ChevronLeft size={17} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </button>
      )}
      {live && tucked && (
        <div
          className="fw-edge-zone"
          aria-hidden="true"
          onPointerDown={(event) => startPull(event, true)}
        />
      )}
    </>
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
