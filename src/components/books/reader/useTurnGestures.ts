// Turning pages by touch: a sideways swipe across the page, or a tap on its outer edges (12% on
// each side). The rules are in src/lib/book-gestures.ts; this wires them to the reader's scroll
// box with touch events (they keep coming while the browser scrolls a zoomed page, where pointer
// events would be cancelled).
//
// Selection always wins: nothing starts while text is selected, from a button or field, or while
// the circle's menu is open, and a touch held still for 300 ms (a selection starting) is left to
// the browser. A mouse never swipes; it selects.
import { useEffect, useRef, type RefObject } from "react";
import {
  LONG_PRESS_MS,
  TAP_SLOP,
  atSwipeEdge,
  dragOffset,
  isDoubleTap,
  nearestZoom,
  nextZoom,
  swipeDirection,
  swipeTurn,
  tapScrollTo,
  tapTurn,
  type Turn,
} from "@/lib/book-gestures";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const SKIP = "button, a, input, textarea, select, label, [role='button']";

type Options = {
  scroller: RefObject<HTMLDivElement | null>;
  stage: RefObject<HTMLDivElement | null>;
  rtl: boolean;
  page: number;
  total: number;
  /** True while something else owns the page (the circle's menu). */
  blocked: () => boolean;
  onTurn: (page: number) => void;
  /** Changes when the scroll box is made again (layout switches). */
  layoutKey: unknown;
  /**
   * Zooming by finger, when switched on: a double tap off the words goes one zoom step up (back
   * to the first after the last), and a pinch settles on the nearest step when the fingers lift.
   */
  zoom?: { on: boolean; index: number; levels: number[]; set: (index: number) => void };
};

type Start = {
  x: number;
  y: number;
  t: number;
  left: number;
  top: number;
  width: number;
  client: number;
  boxRtl: boolean;
  page: DOMRect | null;
  moved: boolean;
  long: boolean;
  following: boolean;
  timer: number;
};

function selecting(): boolean {
  const selection = document.getSelection();
  return Boolean(selection && !selection.isCollapsed);
}

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function useTurnGestures(options: Options) {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const box = options.scroller.current;
    if (!box) return;
    let start: Start | null = null;
    let offset = 0;
    // Finger zoom: the last tap off the words, and a pinch under way.
    let lastTap: { x: number; y: number; t: number } | null = null;
    let pinch: { d0: number; cx: number; cy: number; scale: number } | null = null;
    const zoomOn = () => Boolean(latest.current.zoom?.on);
    const spread = (list: TouchList) =>
      Math.hypot(list[0].clientX - list[1].clientX, list[0].clientY - list[1].clientY);
    const endPinch = () => {
      const p = pinch;
      pinch = null;
      const el = stageEl();
      if (el) {
        el.style.transform = "";
        el.style.transformOrigin = "";
        el.style.willChange = "";
      }
      const zoom = latest.current.zoom;
      if (!p || !zoom) return;
      const to = nearestZoom(zoom.levels, zoom.index, p.scale);
      if (to !== zoom.index) zoom.set(to);
    };

    const stageEl = () => latest.current.stage.current;
    const setOffset = (px: number) => {
      const el = stageEl();
      if (!el) return;
      offset = px;
      el.style.willChange = px ? "transform" : "";
      el.style.transform = px ? `translateX(${px.toFixed(1)}px)` : "";
    };
    /** The sheet goes back to its place (a swipe that did not turn). */
    const settleBack = () => {
      const el = stageEl();
      const from = offset;
      setOffset(0);
      if (!el || !from || !el.animate) return;
      el.animate([{ transform: `translateX(${from}px)` }, { transform: "translateX(0)" }], {
        duration: 160,
        easing: EASE_OUT,
      });
    };
    /** No page beyond: the sheet gives a small push that way and comes back. */
    const bump = (turn: Turn) => {
      const el = stageEl();
      const from = offset;
      setOffset(0);
      if (!el?.animate) return;
      if (reducedMotion()) {
        el.animate([{ opacity: 1 }, { opacity: 0.7 }, { opacity: 1 }], { duration: 180 });
        return;
      }
      // "Next" pulls the page towards the book's start side: left in a left-to-right book.
      const push = (latest.current.rtl ? 1 : -1) * turn * 12;
      el.animate(
        [
          { transform: `translateX(${from}px)` },
          { transform: `translateX(${push}px)` },
          { transform: "translateX(0)" },
        ],
        { duration: 180, easing: EASE_OUT },
      );
    };
    const turnBy = (turn: Turn) => {
      const { page, total, onTurn } = latest.current;
      const to = page + turn;
      if (to < 1 || to > total) {
        bump(turn);
        return;
      }
      setOffset(0);
      onTurn(to);
    };
    const reset = () => {
      if (start) window.clearTimeout(start.timer);
      start = null;
      settleBack();
    };

    const onStart = (event: TouchEvent) => {
      if (start) window.clearTimeout(start.timer);
      start = null;
      if (event.touches.length === 2 && zoomOn() && !selecting() && !latest.current.blocked()) {
        settleBack();
        const [a, b] = [event.touches[0], event.touches[1]];
        const el = stageEl();
        const box2 = el?.getBoundingClientRect();
        const cx = (a.clientX + b.clientX) / 2 - (box2?.left ?? 0);
        const cy = (a.clientY + b.clientY) / 2 - (box2?.top ?? 0);
        pinch = { d0: Math.max(1, spread(event.touches)), cx, cy, scale: 1 };
        return;
      }
      if (event.touches.length !== 1) {
        settleBack();
        return;
      }
      const target = event.target as Element | null;
      if (target?.closest(SKIP) || latest.current.blocked() || selecting()) return;
      const touch = event.touches[0];
      const sheet = box.querySelector(".bkr-page");
      const begun: Start = {
        x: touch.clientX,
        y: touch.clientY,
        t: performance.now(),
        left: box.scrollLeft,
        top: box.scrollTop,
        width: box.scrollWidth,
        client: box.clientWidth,
        boxRtl: getComputedStyle(box).direction === "rtl",
        page: sheet ? sheet.getBoundingClientRect() : null,
        moved: false,
        long: false,
        following: false,
        timer: 0,
      };
      begun.timer = window.setTimeout(() => {
        if (!begun.moved) begun.long = true;
      }, LONG_PRESS_MS);
      start = begun;
    };

    const onMove = (event: TouchEvent) => {
      if (pinch) {
        if (event.touches.length < 2) return;
        // The page follows the fingers lightly; it settles on a zoom step when they lift.
        pinch.scale = Math.min(2.5, Math.max(0.5, spread(event.touches) / pinch.d0));
        const el = stageEl();
        if (el && !reducedMotion()) {
          el.style.willChange = "transform";
          el.style.transformOrigin = `${pinch.cx}px ${pinch.cy}px`;
          el.style.transform = `scale(${pinch.scale.toFixed(3)})`;
        }
        return;
      }
      const s = start;
      if (!s) return;
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      if (!s.moved && Math.hypot(dx, dy) > TAP_SLOP) s.moved = true;
      if (s.long || selecting()) {
        if (offset) settleBack();
        return;
      }
      if (reducedMotion()) return;
      const scroll = { left: s.left, width: s.width, client: s.client, rtl: s.boxRtl };
      // A zoomed page moves inside its box until it reaches the edge.
      if (!atSwipeEdge(dx, scroll) || Math.abs(box.scrollLeft - s.left) > 2) {
        if (offset) settleBack();
        return;
      }
      const { rtl, page, total } = latest.current;
      const to = page + swipeDirection(dx, rtl);
      const next = dragOffset(dx, dy, to >= 1 && to <= total);
      if (next || s.following) {
        s.following = true;
        setOffset(next);
      }
    };

    const onEnd = (event: TouchEvent) => {
      if (pinch) {
        if (event.touches.length < 2) endPinch();
        return;
      }
      const s = start;
      start = null;
      if (!s) return;
      window.clearTimeout(s.timer);
      const touch = event.changedTouches[0];
      if (!touch || s.long || selecting() || latest.current.blocked()) {
        settleBack();
        return;
      }
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      const ms = performance.now() - s.t;
      const { rtl } = latest.current;

      // A tap on the page's outer edge.
      if (!s.moved) {
        settleBack();
        if (ms >= LONG_PRESS_MS || !s.page) return;
        const { left, right, top, bottom, width } = s.page;
        if (s.x < left || s.x > right || s.y < top || s.y > bottom) return;
        const turn = tapTurn(s.x - left, width, rtl);
        if (!turn) {
          // Off the edges: a double tap off the words zooms (when switched on).
          const zoom = latest.current.zoom;
          const tap = { x: s.x, y: s.y, t: performance.now() };
          const onWords = Boolean((event.target as Element | null)?.closest?.(".bkr-text span"));
          if (zoom?.on && !onWords && isDoubleTap(lastTap, tap)) {
            lastTap = null;
            zoom.set(nextZoom(zoom.levels, zoom.index));
          } else lastTap = onWords ? null : tap;
          return;
        }
        const to = tapScrollTo(turn, {
          top: box.scrollTop,
          height: box.scrollHeight,
          client: box.clientHeight,
        });
        if (to !== null) {
          box.scrollTo({ top: to, behavior: reducedMotion() ? "auto" : "smooth" });
          return;
        }
        turnBy(turn);
        return;
      }

      // A swipe: only from the edge on a zoomed page, and only if the page did not scroll.
      const scroll = { left: s.left, width: s.width, client: s.client, rtl: s.boxRtl };
      if (!atSwipeEdge(dx, scroll) || Math.abs(box.scrollLeft - s.left) > 2) {
        settleBack();
        return;
      }
      const turn = swipeTurn(dx, dy, ms, rtl);
      if (!turn) {
        settleBack();
        return;
      }
      turnBy(turn);
    };

    box.addEventListener("touchstart", onStart, { passive: true });
    box.addEventListener("touchmove", onMove, { passive: true });
    box.addEventListener("touchend", onEnd, { passive: true });
    const onCancel = () => {
      if (pinch) endPinch();
      reset();
    };
    box.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      box.removeEventListener("touchstart", onStart);
      box.removeEventListener("touchmove", onMove);
      box.removeEventListener("touchend", onEnd);
      box.removeEventListener("touchcancel", onCancel);
      if (start) window.clearTimeout(start.timer);
      setOffset(0);
    };
    // Attached once per scroll box; the rest is read from `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.layoutKey]);
}
