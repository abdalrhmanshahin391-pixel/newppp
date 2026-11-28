import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

/** The cube is drawn at this size and scaled to the spot it sits in. */
export const CUBE_PX = 168;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Holds Uzyra's cube over the column and moves it to whichever spot is showing: the big one in the
 * middle before the call (`data-cube-spot="hero"`), the small one just above the message bar once
 * the call starts (`data-cube-spot="dock"`). The move is one transform (translate + scale) with a
 * spring-like curve, so the cube flies down and shrinks in one motion; resizing places it at once,
 * and a change around its spot that moves the spot (a line coming or going) moves it with it.
 */
export function FlyingCube({ chatting, children }: { chatting: boolean; children: ReactNode }) {
  const holder = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useIsoLayoutEffect(() => {
    const el = holder.current;
    const column = el?.parentElement;
    if (!el || !column) return;
    const selector = `[data-cube-spot="${chatting ? "dock" : "hero"}"]`;
    let placed = "";
    const place = (animate: boolean) => {
      const spot = column.querySelector<HTMLElement>(selector);
      if (!spot) return;
      const box = column.getBoundingClientRect();
      const rect = spot.getBoundingClientRect();
      if (!rect.width) return;
      const scale = rect.width / CUBE_PX;
      const x = rect.left - box.left + rect.width / 2 - CUBE_PX / 2;
      const y = rect.top - box.top + rect.height / 2 - CUBE_PX / 2;
      const transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(4)})`;
      if (transform === placed) return;
      placed = transform;
      el.style.transition = animate ? "" : "none";
      el.style.transform = transform;
      el.style.opacity = "1";
    };
    place(!first.current);
    first.current = false;
    // Only a real size change moves it at once (the observer also reports right after observe()).
    let size = `${column.clientWidth}x${column.clientHeight}`;
    const observer = new ResizeObserver(() => {
      const next = `${column.clientWidth}x${column.clientHeight}`;
      if (next === size) return;
      size = next;
      place(false);
    });
    observer.observe(column);
    // The part of the column the spot is in (the hero or the dock) can move the spot without
    // resizing the column: a line wrapping, a message coming or going, the composer rising in.
    // The cube follows with its usual motion.
    let block = column.querySelector<HTMLElement>(selector);
    while (block && block.parentElement !== column) block = block.parentElement;
    const follow = () => place(true);
    const sizes = new ResizeObserver(follow);
    const watch = () => {
      if (!block) return;
      sizes.observe(block);
      for (const child of Array.from(block.children)) sizes.observe(child);
    };
    const lines = new MutationObserver(() => {
      watch();
      follow();
    });
    // On a short screen that part may scroll: the cube scrolls with its spot.
    const scrolled = () => place(false);
    if (block) {
      watch();
      lines.observe(block, { childList: true });
      block.addEventListener("scroll", scrolled, { passive: true });
    }
    return () => {
      observer.disconnect();
      sizes.disconnect();
      lines.disconnect();
      block?.removeEventListener("scroll", scrolled);
    };
  }, [chatting]);

  return (
    <div ref={holder} className="uz-rc-cube">
      {children}
    </div>
  );
}

/**
 * The scrolling conversation. It follows new words to the bottom while the learner is already
 * near the bottom, and leaves them alone when they scrolled up to read.
 */
export function StickyScroll({ follow, children }: { follow: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [follow]);

  return (
    <div ref={box} className="uz-rc-scroll">
      {children}
    </div>
  );
}
