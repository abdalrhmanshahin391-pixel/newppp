// Pieces of the home page's look for the lesson pages: the field of black marks behind the top of
// the page (the same field as the home hero, drawn on a 2D canvas), a headline whose words come in
// one after another with a caret (Arabic words are never split into letters), numbers that count
// up the first time they are seen, and Uzyra's cube. All of it holds still with reduced motion.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { useReducedMotion, useShown } from "@/components/home/procreate/ag-hooks";
import { buildField, ringLight, RING, wander } from "@/components/home/procreate/ultra-field";

/** The top of a lesson page: the moving field of marks, with the page's words over it. */
export function DotHero({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
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
      const short = Math.min(width, height);
      // The ring follows the pointer for a while after it moved, then drifts on its own.
      const target =
        t - pointer.at < 2500 ? { x: pointer.x / width, y: pointer.y / height } : wander(t / 1000);
      ring.x += (target.x - ring.x) * 0.06;
      ring.y += (target.y - ring.y) * 0.06;
      const cx = ring.x * width;
      const cy = ring.y * height;
      const { points, count, step } = field;
      ctx.fillStyle = "#121117";
      ctx.strokeStyle = "#121117";
      ctx.lineCap = "round";
      for (let i = 0; i < count; i += 1) {
        const x = points[i * 3];
        const y = points[i * 3 + 1];
        const r = points[i * 3 + 2];
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const light = reduced ? 0 : ringLight(d, short * 0.8);
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
      const rect = box.getBoundingClientRect();
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
  }, [reduced]);

  return (
    <section ref={section} className="la-hero">
      <canvas ref={canvas} className="la-hero-field" aria-hidden="true" />
      <div className="la-hero-in">{children}</div>
    </section>
  );
}

/** «[cube] name»: the small line above a page's headline, like «Meet Uzyra Ultra» on the home. */
export function CubeLine({ children }: { children: ReactNode }) {
  const levels = useRef({ input: 0, output: 0 });
  return (
    <p className="la-cubeline">
      <span className="la-cubeline-cube" aria-hidden="true">
        <RitaCube levelsRef={levels} mode="idle" label="" />
      </span>
      {children}
    </p>
  );
}

/**
 * A headline whose words rise in one after another (60ms apart) once its top is 80% down the
 * screen, with a caret that blinks out at the end. Words, not letters: Arabic letters join.
 */
export function WordsIn({
  text,
  as: Tag = "h2",
  className,
  id,
}: {
  text: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
  id?: string;
}) {
  const { ref, shown } = useShown<HTMLHeadingElement>(0.8);
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <Tag ref={ref} id={id} className={className} data-shown={shown ? "on" : undefined}>
      <span className="la-sr">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={i} className="la-word" style={{ "--i": i } as CSSProperties}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
        <span className="la-caret" style={{ "--i": words.length } as CSSProperties} />
      </span>
    </Tag>
  );
}

/** A number that counts up from 0 the first time it is seen (at once with reduced motion). */
export function CountUp({ value }: { value: number }) {
  const { ref, shown, reduced } = useShown<HTMLSpanElement>(0.95);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!shown) return;
    if (reduced || value <= 0) {
      setNow(value);
      return;
    }
    const start = performance.now();
    const length = Math.min(1100, 300 + value * 40);
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / length);
      setNow(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown, reduced, value]);
  return (
    <span ref={ref} aria-label={String(value)}>
      {shown ? now : 0}
    </span>
  );
}

/** Numbers in grey cards, like the facts on the home page; they rise in one after another. */
export function Facts({
  items,
}: {
  items: { label: string; value: number; note?: string; onClick?: () => void }[];
}) {
  return (
    <div className="la-facts">
      {items.map((item, i) => {
        const style = { "--i": i } as CSSProperties;
        const body = (
          <>
            <span className="la-fact-label">{item.label}</span>
            <b>
              <CountUp value={item.value} />
            </b>
            {item.note && <small>{item.note}</small>}
          </>
        );
        return item.onClick ? (
          <button
            key={item.label}
            type="button"
            className="la-fact"
            style={style}
            onClick={item.onClick}
          >
            {body}
          </button>
        ) : (
          <div key={item.label} className="la-fact" style={style}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
