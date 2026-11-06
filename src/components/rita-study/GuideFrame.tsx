import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { renderGuideHtml } from "@/lib/guides/guide-html";
import type { GuideContent } from "@/lib/guides/guide-content";

/** The frame's width before it is fitted to its pane (the sheet inside is at most 640px). */
const START_WIDTH = 664;

const SCALE_MIN = 0.5;
const SCALE_MAX = 3;

export type GuideFrameHandle = {
  document: () => Document | null;
  window: () => Window | null;
  scrollToSection: (id: string, smooth?: boolean) => void;
  /** Scrolls to a named piece and flashes it once. */
  showPiece: (id: string) => void;
  /** The transparent layer over the sheet that receives pen, finger and mouse. */
  layer: () => HTMLDivElement | null;
  /** A point on screen in the sheet's own units (what the frame's document measures in). */
  toSheet: (clientX: number, clientY: number) => { x: number; y: number };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The guide on the right: the same template, words and fonts as the PDF, as a page so the learner
 * can select text on every device. It sits in an isolated frame with no script (the page reads the
 * selection from outside), and every piece carries its stable name (data-block / data-seg).
 *
 * The frame is as tall as the whole sheet and never scrolls itself: the box around it scrolls, and
 * size changes use a transform. (Safari loses text selection inside a frame scaled with CSS `zoom`.)
 * Until the learner zooms by hand, the frame is as wide as its pane at its real size (scale 1) and
 * the sheet inside reflows to that width (at most 640px, grey around it): the text stays readable
 * on a phone instead of a whole page being shrunk. Two fingers on a touch screen, or a pinch on a
 * trackpad, then zoom around the fingers from there.
 */
export const GuideFrame = forwardRef<
  GuideFrameHandle,
  {
    content: GuideContent;
    title: string;
    onLoad?: (doc: Document) => void;
    /** Called (at most once per frame) when the reading place changes, with the sheet's y in view. */
    onScroll?: (readingY: number) => void;
  }
>(function GuideFrame({ content, title, onLoad, onScroll }, ref) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const hit = useRef<HTMLDivElement | null>(null);
  const scale = useRef(1);
  /** The frame's own width (its layout width, before the zoom transform). */
  const width = useRef(START_WIDTH);
  const height = useRef(1200);
  const fitted = useRef(true);

  const html = useMemo(() => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return renderGuideHtml(content, {
      anchors: true,
      screen: true,
      draft: false,
      fontBase: `${origin}/fonts/guides/`,
    });
  }, [content]);

  /** Where the sheet starts inside the scrolling box (it is centred when narrower). */
  const offsetX = () => {
    const box = scroller.current;
    return box ? Math.max(0, (box.clientWidth - width.current * scale.current) / 2) : 0;
  };

  /** Applies a scale; `anchor` is a point in sheet units that stays under the same screen spot. */
  const apply = useCallback(
    (next: number, anchor?: { x: number; y: number; sx: number; sy: number }) => {
      const box = scroller.current;
      const st = stage.current;
      const el = frame.current;
      if (!box || !st || !el) return;
      scale.current = next;
      el.style.width = `${width.current}px`;
      st.style.width = `${width.current * next}px`;
      st.style.height = `${height.current * next}px`;
      el.style.transform = `scale(${next})`;
      if (anchor) {
        box.scrollLeft = anchor.x * next + offsetX() - anchor.sx;
        box.scrollTop = anchor.y * next - anchor.sy;
      }
    },
    [],
  );

  const fit = useCallback(() => {
    const box = scroller.current;
    if (!box || !fitted.current || box.clientWidth === 0) return;
    // Keep the same place in the text while the sheet reflows to the new width.
    const before = Math.max(1, height.current);
    const ratio = box.scrollTop / (before * scale.current);
    width.current = box.clientWidth;
    apply(1);
    // The new height arrives with the sheet's resize (measure); place the reader again then too.
    requestAnimationFrame(() => {
      box.scrollTop = ratio * height.current;
    });
  }, [apply]);

  const measure = useCallback(() => {
    const doc = frame.current?.contentDocument;
    const sheet = doc?.querySelector(".sheet");
    if (!doc || !sheet) return;
    // The page padding below the sheet (40px) is part of the frame.
    const next = Math.ceil(sheet.getBoundingClientRect().bottom + 40);
    if (next > 0 && next !== height.current) {
      height.current = next;
      if (frame.current) frame.current.style.height = `${next}px`;
      apply(scale.current);
    }
  }, [apply]);

  // The pane changes size (window, divider): refit while the learner has not zoomed by hand.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(box);
    return () => observer.disconnect();
  }, [fit]);

  /** Zooms by `factor` around a point given in the scrolling box's own coordinates. */
  const zoomAround = useCallback(
    (factor: number, sx: number, sy: number) => {
      const box = scroller.current;
      if (!box) return;
      fitted.current = false;
      const old = scale.current;
      const next = clamp(old * factor, SCALE_MIN, SCALE_MAX);
      if (next === old) return;
      const x = (box.scrollLeft + sx - offsetX()) / old;
      const y = (box.scrollTop + sy) / old;
      apply(next, { x, y, sx, sy });
    },
    [apply],
  );

  // Trackpad pinch (and ctrl + wheel) over the grey margins around the sheet.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = box.getBoundingClientRect();
      zoomAround(
        Math.exp(-event.deltaY * 0.01),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [zoomAround]);

  // Scroll: tell the page where the learner is reading (in sheet units), once per frame.
  useEffect(() => {
    const box = scroller.current;
    if (!box || !onScroll) return;
    let frameId = 0;
    const onBoxScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() =>
        onScroll((box.scrollTop + box.clientHeight / 3) / scale.current),
      );
    };
    box.addEventListener("scroll", onBoxScroll, { passive: true });
    return () => {
      box.removeEventListener("scroll", onBoxScroll);
      cancelAnimationFrame(frameId);
    };
  }, [onScroll]);

  /** The frame never scrolls or zooms itself; the box around it does. */
  const listen = useCallback((doc: Document) => {
    doc.documentElement.style.overflow = "hidden";
  }, []);

  /**
   * Two fingers on the layer over the sheet zoom around the fingers. The layer belongs to this page:
   * Safari runs no listener inside the locked frame, so every touch is read here, outside it.
   */
  useEffect(() => {
    const layer = hit.current;
    const box = scroller.current;
    if (!layer || !box) return;
    let pinch: { distance: number; scale: number } | null = null;
    const spread = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const onStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        pinch = { distance: spread(event.touches), scale: scale.current };
      }
    };
    const onMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const rect = box.getBoundingClientRect();
      const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
      const wanted = pinch.scale * (spread(event.touches) / Math.max(pinch.distance, 1));
      zoomAround(wanted / scale.current, midX, midY);
    };
    const onEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = null;
    };
    // Safari's own page zoom gesture would fight ours.
    const onGesture = (event: Event) => event.preventDefault();
    layer.addEventListener("touchstart", onStart, { passive: true });
    layer.addEventListener("touchmove", onMove, { passive: false });
    layer.addEventListener("touchend", onEnd, { passive: true });
    layer.addEventListener("touchcancel", onEnd, { passive: true });
    layer.addEventListener("gesturestart", onGesture);
    return () => {
      layer.removeEventListener("touchstart", onStart);
      layer.removeEventListener("touchmove", onMove);
      layer.removeEventListener("touchend", onEnd);
      layer.removeEventListener("touchcancel", onEnd);
      layer.removeEventListener("gesturestart", onGesture);
    };
  }, [zoomAround]);

  // The page may arrive already drawn by the server, and the frame can finish loading before
  // React listens: then hand over the document now (once per document).
  const handed = useRef<Document | null>(null);
  const handOver = () => {
    const doc = frame.current?.contentDocument;
    if (!doc || handed.current === doc || !doc.querySelector("[data-seg]")) return;
    handed.current = doc;
    listen(doc);
    measure();
    fit();
    // Web fonts change the sheet's height once they arrive.
    void doc.fonts?.ready.then(() => measure());
    const sheet = doc.querySelector(".sheet");
    if (sheet) new ResizeObserver(() => measure()).observe(sheet);
    onLoad?.(doc);
  };
  useEffect(() => {
    if (frame.current?.contentDocument?.readyState === "complete") handOver();
  });

  /** A piece's top inside the sheet, in sheet units (the frame never scrolls). */
  const topOf = (element: Element) => element.getBoundingClientRect().top;

  useImperativeHandle(ref, () => ({
    document: () => frame.current?.contentDocument ?? null,
    window: () => frame.current?.contentWindow ?? null,
    layer: () => hit.current,
    toSheet: (clientX, clientY) => {
      const rect = frame.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (clientX - rect.left) / scale.current, y: (clientY - rect.top) / scale.current };
    },
    scrollToSection: (id, smooth = true) => {
      const target = frame.current?.contentDocument?.getElementById(id);
      const box = scroller.current;
      if (!target || !box) return;
      box.scrollTo({
        top: Math.max(0, (topOf(target) - 16) * scale.current),
        behavior: smooth ? "smooth" : "auto",
      });
    },
    showPiece: (id) => {
      const doc = frame.current?.contentDocument;
      const box = scroller.current;
      const target =
        doc?.querySelector(`[data-seg="${CSS.escape(id)}"]`) ??
        doc?.querySelector(`[data-block="${CSS.escape(id)}"]`) ??
        doc?.getElementById(id);
      if (!target || !box) return;
      const rect = target.getBoundingClientRect();
      box.scrollTo({
        top: Math.max(0, (rect.top + rect.height / 2) * scale.current - box.clientHeight / 2),
        behavior: "smooth",
      });
      target.classList.remove("st-flash");
      void (target as HTMLElement).offsetWidth;
      target.classList.add("st-flash");
    },
  }));

  return (
    // The sheet is a left-to-right page: the box scrolls left to right whatever the page around it.
    <div ref={scroller} className="st-scroll" dir="ltr">
      <div ref={stage} className="st-stage" style={{ width: START_WIDTH, height: height.current }}>
        <iframe
          ref={frame}
          title={`ملف الدرس: ${title}`}
          srcDoc={html}
          // No allow-scripts: the guide never runs code. Same origin so the page can read and set the
          // selection from outside. (Safari then runs no listener inside the frame at all, so all
          // input is taken by the layer below, which belongs to this page.)
          sandbox="allow-same-origin"
          scrolling="no"
          className="st-frame"
          style={{ width: START_WIDTH, height: height.current }}
          onLoad={handOver}
        />
        <div ref={hit} className="st-hit" />
      </div>
    </div>
  );
});
