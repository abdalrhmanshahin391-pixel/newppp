import { useEffect, useRef, type MutableRefObject } from "react";
import type { OrbMode } from "@/components/rita-live/orb-dynamics";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";
import { createMascot, restFrame } from "./mascot/mascot-engine";

/** At rest: the first paint, and what shows when it is not moving. */
const REST = restFrame(200);

/**
 * Uzyra's face: a soft blue cube (#3C82F6) with two white eyes, alive (the engine is in ./mascot).
 *
 * It is a rounded square with some thickness and round edges, drawn flat: as it turns its round
 * side comes into view, and its eyes slide across its front face and hide when it faces away. It
 * plays short clips of its mood one after another and blends from wherever it is into the next,
 * spins and flips now and then, blinks, and changes its eyes inside a blink (they flip into happy
 * arcs after a spin or a hop). It stretches along fast moves, leans into a spin and jiggles when
 * it lands. While the learner speaks it leans in and their voice presses it down; while it thinks
 * it looks up and searches; while Uzyra speaks it bobs with her voice.
 *
 * It does not follow the pointer or react to taps (the owner's choice). One animation-frame loop
 * writes three SVG paths, only when they changed; it stops offscreen and in hidden tabs. Reduced
 * motion keeps it still (it only blinks).
 */
export function RitaCube({
  levelsRef,
  mode,
  label,
  active = true,
}: {
  levelsRef: MutableRefObject<OrbLevels>;
  mode: OrbMode;
  label: string;
  /** The home hero pauses offscreen, in hidden tabs, and for reduced motion. */
  active?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const body = useRef<SVGPathElement>(null);
  const left = useRef<SVGPathElement>(null);
  const right = useRef<SVGPathElement>(null);
  const modeRef = useRef<OrbMode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const hostEl = host.current;
    const bodyEl = body.current;
    const leftEl = left.current;
    const rightEl = right.current;
    if (!hostEl || !bodyEl || !leftEl || !rightEl) return;

    let shown = { body: REST.body, left: REST.eyes?.[0] ?? "", right: REST.eyes?.[1] ?? "" };
    const put = (next: typeof shown) => {
      if (next.body !== shown.body) bodyEl.setAttribute("d", next.body);
      if (next.left !== shown.left) leftEl.setAttribute("d", next.left);
      if (next.right !== shown.right) rightEl.setAttribute("d", next.right);
      shown = next;
    };
    if (!active) {
      put({ body: REST.body, left: REST.eyes?.[0] ?? "", right: REST.eyes?.[1] ?? "" });
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cube = createMascot({
      seed: Math.floor(Math.random() * 2 ** 31),
      reduced: reduced.matches,
      size: hostEl.clientWidth || 200,
      mood: modeRef.current,
    });
    const onReduced = () => cube.setReduced(reduced.matches);
    reduced.addEventListener("change", onReduced);
    const sizer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(([entry]) => cube.setSize(entry.contentRect.width));
    sizer?.observe(hostEl);

    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cube.setMood(modeRef.current);
      cube.step(dt, levelsRef.current);
      const frame = cube.frame();
      put({ body: frame.body, left: frame.eyes?.[0] ?? "", right: frame.eyes?.[1] ?? "" });
    };

    // Seen on screen and in an open tab? Otherwise it does no work at all.
    let onScreen = true;
    let visible = document.visibilityState === "visible";
    const sync = () => {
      if (visible && onScreen) {
        if (raf) return;
        last = performance.now();
        raf = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const seen =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            sync();
          });
    seen?.observe(hostEl);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      seen?.disconnect();
      sizer?.disconnect();
      reduced.removeEventListener("change", onReduced);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [levelsRef, active]);

  return (
    <span
      ref={host}
      className="uz-cube"
      style={{ display: "block" }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <svg className="uz-cube-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path ref={body} className="uz-cube-shape" d={REST.body} />
        <path ref={left} className="uz-cube-eye" d={REST.eyes?.[0] ?? ""} />
        <path ref={right} className="uz-cube-eye" d={REST.eyes?.[1] ?? ""} />
      </svg>
    </span>
  );
}
