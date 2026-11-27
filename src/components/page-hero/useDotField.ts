// The field of black marks behind the top of a page: the same field as the home hero
// (ultra-field.ts), drawn on a 2D canvas. A ring follows the pointer for a moment, then drifts on
// its own; marks under it grow into short dashes pushed outwards. It draws only while on screen and
// in a visible tab, and holds still (drawn once) with reduced motion.
//
// Modes: "live" (the home's: the ring drifts on its own when the pointer rests), "rest" (beside a
// book: the ring wakes under the pointer or a finger and fades out a moment after it stops, then
// nothing draws), "still" (the faint dots only, drawn once).
import { useEffect, type RefObject } from "react";
import { useReducedMotion } from "@/components/home/procreate/ag-hooks";
import { buildField, ringLight, RING, wander } from "@/components/home/procreate/ultra-field";

export type DotFieldMode = "live" | "rest" | "still";

/** How long the ring keeps following after the last pointer move (ms). */
const AWAKE_MS = 2500;

export function useDotField(
  section: RefObject<HTMLElement | null>,
  canvas: RefObject<HTMLCanvasElement | null>,
  /** The marks' colour: black on the white pages, white on a dark panel. */
  ink = "#121117",
  mode: DotFieldMode = "live",
) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const box = section.current;
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!box || !el || !ctx) return;
    const still = reduced || mode === "still";
    const rest = mode === "rest";
    let field = buildField(1, 1);
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    // How strongly the ring shows: always 1 when live; in rest mode it rises while the pointer
    // moves and falls back to 0 after it stops.
    let amp = rest ? 0 : 1;
    const pointer = { x: 0, y: 0, at: -1e9 };
    const ring = { x: 0.5, y: 0.6 };

    const size = () => {
      const rect = box.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field = buildField(width, height);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;
      const short = Math.min(width, height);
      const awake = t - pointer.at < AWAKE_MS;
      if (rest) {
        amp += ((awake ? 1 : 0) - amp) * 0.08;
        if (awake) {
          ring.x += (pointer.x / width - ring.x) * 0.14;
          ring.y += (pointer.y / height - ring.y) * 0.14;
        }
      } else {
        // The ring follows the pointer for a while after it moved, then drifts on its own.
        const target = awake ? { x: pointer.x / width, y: pointer.y / height } : wander(t / 1000);
        ring.x += (target.x - ring.x) * 0.06;
        ring.y += (target.y - ring.y) * 0.06;
      }
      const cx = ring.x * width;
      const cy = ring.y * height;
      const { points, count, step } = field;
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
      ctx.lineCap = "round";
      for (let i = 0; i < count; i += 1) {
        const x = points[i * 3];
        const y = points[i * 3 + 1];
        const r = points[i * 3 + 2];
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const light = still ? 0 : ringLight(d, short * 0.8) * amp;
        if (light < 0.04) {
          ctx.globalAlpha = 0.1 + r * 0.1;
          ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
          continue;
        }
        const ux = dx / d;
        const uy = dy / d;
        const push = RING.push * step * light;
        const len = 2 + light * (5 + r * 5);
        const sx = x + ux * push;
        const sy = y + uy * push;
        ctx.globalAlpha = 0.18 + light * 0.6;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx - (ux * len) / 2, sy - (uy * len) / 2);
        ctx.lineTo(sx + (ux * len) / 2, sy + (uy * len) / 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      draw(t);
      // In rest mode the field goes back to sleep once the ring has faded out.
      const asleep = rest && t - pointer.at >= AWAKE_MS && amp < 0.01;
      frame = visible && !still && !asleep ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (!frame && !still && visible) frame = requestAnimationFrame(loop);
    };

    size();
    draw(0);
    if (!rest) start();
    const resize = new ResizeObserver(() => {
      size();
      draw(performance.now());
    });
    resize.observe(box);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible && !rest) start();
    });
    seen.observe(box);
    const move = (event: PointerEvent) => {
      const rect = box.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      // Waking from sleep: the ring starts where the pointer is, not where it fell asleep.
      if (rest && amp < 0.05) {
        ring.x = pointer.x / (width || 1);
        ring.y = pointer.y / (height || 1);
      }
      pointer.at = performance.now();
      start();
    };
    if (!still) {
      box.addEventListener("pointermove", move);
      box.addEventListener("pointerdown", move);
    }
    const hidden = () => {
      visible = !document.hidden;
      if (visible && !rest) start();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      seen.disconnect();
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerdown", move);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [reduced, section, canvas, ink, mode]);
}
