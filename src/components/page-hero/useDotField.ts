// The field of black marks behind the top of a page: the same field as the home hero
// (ultra-field.ts), drawn on a 2D canvas. A ring follows the pointer for a moment, then drifts on
// its own; marks under it grow into short dashes pushed outwards. It draws only while on screen and
// in a visible tab, and holds still (drawn once) with reduced motion. With an `around` element the
// ring drifts close around that element instead of over the whole field (the free conversation
// gathers it around Uzyra's cube).
import { useEffect, type RefObject } from "react";
import { useReducedMotion } from "@/components/home/procreate/ag-hooks";
import { buildField, ringLight, RING, wander } from "@/components/home/procreate/ultra-field";

export function useDotField(
  section: RefObject<HTMLElement | null>,
  canvas: RefObject<HTMLCanvasElement | null>,
  /** The marks' colour: black on the white pages, white on a dark panel. */
  ink = "#121117",
  /** When nobody is pointing, the ring circles this element instead of wandering. */
  around?: RefObject<HTMLElement | null>,
) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const box = section.current;
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!box || !el || !ctx) return;
    let field = buildField(1, 1);
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    const pointer = { x: 0, y: 0, at: -1e9 };
    const ring = { x: 0.5, y: 0.6 };
    // The centre of `around`, in fractions of the field (null without one), and the size the ring
    // is measured against there: a little more than the element, so the ring hugs it.
    let home: { x: number; y: number } | null = null;
    let homeSize = 0;
    let frames = 0;
    const locate = () => {
      const spot = around?.current;
      if (!spot || !width || !height) {
        home = null;
        return;
      }
      // Measured against the canvas itself, which moves with the content if the box scrolls.
      const a = spot.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      home = {
        x: (a.left + a.width / 2 - b.left) / width,
        y: (a.top + a.height / 2 - b.top) / height,
      };
      homeSize = a.width * 2.6;
    };

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
      locate();
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      const short = Math.min(width, height);
      // The ring follows the pointer for a while after it moved, then drifts on its own (close
      // around `around`, when there is one; where it is is read again now and then).
      if (around && (frames += 1) % 30 === 0) locate();
      const s = t / 1000;
      const idle = home
        ? { x: home.x + 0.03 * Math.sin(s * 0.5), y: home.y + 0.025 * Math.cos(s * 0.43) }
        : wander(s);
      const target = t - pointer.at < 2500 ? { x: pointer.x / width, y: pointer.y / height } : idle;
      ring.x += (target.x - ring.x) * 0.06;
      ring.y += (target.y - ring.y) * 0.06;
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
        const light = reduced ? 0 : ringLight(d, home ? homeSize : short * 0.8);
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
      frame = visible && !reduced ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (!frame && !reduced) frame = requestAnimationFrame(loop);
    };

    size();
    draw(0);
    start();
    const resize = new ResizeObserver(() => {
      size();
      draw(performance.now());
    });
    resize.observe(box);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible) start();
    });
    seen.observe(box);
    const move = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.at = performance.now();
    };
    box.addEventListener("pointermove", move);
    const hidden = () => {
      visible = !document.hidden;
      if (visible) start();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      seen.disconnect();
      box.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [reduced, section, canvas, ink, around]);
}
