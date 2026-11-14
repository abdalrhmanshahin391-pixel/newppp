import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CONTOUR_PATHS, contourAt } from "./contour-paths";

function Contours() {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const paths = Array.from(svg.current?.querySelectorAll("path") ?? []);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const started = performance.now();
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < 1000 / 12) return;
      last = now;
      paths.forEach((path, i) =>
        path.setAttribute("d", contourAt(CONTOUR_PATHS[i], i, (now - started) / 1000)),
      );
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      if (reduced.matches) paths.forEach((path, i) => path.setAttribute("d", CONTOUR_PATHS[i]));
      else if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  return (
    <svg
      ref={svg}
      className="uz-page-contours"
      viewBox="0 0 1440 1000"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
      focusable="false"
    >
      {CONTOUR_PATHS.map((path, i) => (
        <path
          key={path}
          d={path}
          pathLength="1"
          style={{ "--contour-delay": `${0.2 + i * 0.14}s` } as CSSProperties}
        />
      ))}
    </svg>
  );
}

/**
 * Paint inside the route's own stacking context: above its page colour, below its contents.
 * Keeping the route's background intact preserves dark themes; opaque cards/PDFs cover the lines.
 * The outlet can replace its root on navigation/loading, so observe only that boundary, not messages
 * or other changing content. No route-specific selectors or mutations to the route's React tree.
 */
export function PageContours({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const boundary = scope.current;
    if (!boundary) return;
    let current: HTMLElement | null = null;
    const sync = () => {
      const next =
        Array.from(boundary.children).find(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && !["SCRIPT", "STYLE", "LINK"].includes(node.tagName),
        ) ?? null;
      if (next === current) return;
      current?.removeAttribute("data-uz-contour-surface");
      current = next;
      current?.setAttribute("data-uz-contour-surface", "");
      setSurface(current);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(boundary, { childList: true });
    return () => {
      observer.disconnect();
      current?.removeAttribute("data-uz-contour-surface");
    };
  }, []);
  return (
    <div ref={scope} style={{ display: "contents" }}>
      {children}
      {surface && createPortal(<Contours />, surface)}
    </div>
  );
}
