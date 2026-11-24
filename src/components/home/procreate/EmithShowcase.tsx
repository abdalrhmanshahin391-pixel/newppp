import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import "./emith-showcase.css";

/** Emith's poses (cut from her sprite sheet), in the order she plays them. */
const POSES = ["wave", "idea", "teach", "think", "laptop", "listen", "cheer", "stand"] as const;
const POSE_MS = 2800;
const TITLE = "Meet Emith.";
const TYPE_MS = 70;
const BLUE = [60, 130, 246] as const; // #3C82F6, Uzyra's blue

type Dash = { r: number; a: number; k: number; spin: number };

/**
 * The end of the home page: a big black card where Emith, Uzyra's study partner in lessons and
 * books, stands large on the right, cycling through her poses with a small hop. Around her a field
 * of blue dashes turns slowly, brighter on a ring around her and near the pointer; a tap on her
 * plays her next pose and throws the dashes outwards. The title types itself in with a blue caret.
 *
 * The field is our own 2D canvas: one pass per frame, dashes batched by brightness. It runs only
 * while the card is on screen and the tab is visible; reduced motion draws one still frame, keeps
 * one pose and skips the typing.
 */
export function EmithShowcase() {
  const card = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const figure = useRef<HTMLButtonElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const hop = useRef<HTMLSpanElement>(null);
  const burst = useRef(0);
  const [pose, setPose] = useState(0);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // The title types in, and the poses start, the first time the card is well in view.
  useEffect(() => {
    const el = card.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const next = () => setPose((p) => (p + 1) % POSES.length);

  // A new pose lands with a hop (skipped for reduced motion and on the first paint).
  const firstPose = useRef(true);
  useEffect(() => {
    if (firstPose.current) {
      firstPose.current = false;
      return;
    }
    if (reduced || !hop.current?.animate) return;
    hop.current.animate(
      [
        { transform: "translateY(0) scale(1, 1)" },
        { transform: "translateY(-18px) scale(0.97, 1.03)", offset: 0.38 },
        { transform: "translateY(0) scale(1.04, 0.96)", offset: 0.72 },
        { transform: "translateY(0) scale(1, 1)" },
      ],
      { duration: 440, easing: "cubic-bezier(0.34, 1.2, 0.64, 1)" },
    );
  }, [pose, reduced]);

  // Poses play on their own while the card is on screen.
  useEffect(() => {
    if (!shown || reduced) return;
    const el = card.current;
    let onScreen = true;
    const io =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting))
        : null;
    if (el) io?.observe(el);
    const id = window.setInterval(() => {
      if (onScreen && document.visibilityState === "visible") next();
    }, POSE_MS);
    return () => {
      window.clearInterval(id);
      io?.disconnect();
    };
  }, [shown, reduced]);

  // The dash field.
  useEffect(() => {
    const cardEl = card.current;
    const canvasEl = canvas.current;
    const figureEl = figure.current;
    const ctx = canvasEl?.getContext("2d");
    if (!cardEl || !canvasEl || !figureEl || !ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let centre = { x: 0, y: 0, ring: 200 };
    // The words' box: dashes behind it are dimmed so the text stays easy to read.
    let quiet = { x0: 0, y0: 0, x1: 0, y1: 0 };
    let dashes: Dash[] = [];
    const pointer = { x: -9999, y: -9999, on: 0 };

    const seed = (n: number) => {
      let s = 1234567;
      const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
      const reach = Math.hypot(width, height);
      return Array.from({ length: n }, () => {
        const near = rand() < 0.42;
        // Gaussian-ish spread around the ring, the rest thinly out to the corners.
        const g = (rand() + rand() + rand() - 1.5) * 0.55;
        const r = near ? centre.ring * (1 + g * 0.5) : centre.ring * 0.55 + rand() * reach;
        return { r: Math.max(12, r), a: rand() * Math.PI * 2, k: rand(), spin: 0 };
      });
    };

    const measure = () => {
      const rect = cardEl.getBoundingClientRect();
      const fig = figureEl.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvasEl.width = Math.round(width * dpr);
      canvasEl.height = Math.round(height * dpr);
      centre = {
        x: fig.left - rect.left + fig.width / 2,
        y: fig.top - rect.top + fig.height * 0.48,
        ring: Math.max(120, fig.height * 0.5),
      };
      const words = copy.current?.getBoundingClientRect();
      quiet = words
        ? {
            x0: words.left - rect.left - 32,
            y0: words.top - rect.top - 32,
            x1: words.right - rect.left + 32,
            y1: words.bottom - rect.top + 32,
          }
        : { x0: 0, y0: 0, x1: 0, y1: 0 };
      const count = Math.min(width < 700 ? 420 : 900, Math.round((width * height) / 1500));
      dashes = seed(count);
    };

    const BUCKETS = 6;
    const paths: Path2D[] = [];
    let t = 0;
    const draw = (dt: number) => {
      t += dt;
      burst.current = Math.max(0, burst.current - dt * 1.4);
      pointer.on += ((pointer.x > -999 ? 1 : 0) - pointer.on) * Math.min(1, dt * 6);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      for (let b = 0; b < BUCKETS; b++) paths[b] = new Path2D();
      const kick = burst.current * burst.current;
      for (const d of dashes) {
        // Slower further out, so the field shears like a slow vortex.
        const speed = 0.05 + 0.22 * (centre.ring / (d.r + centre.ring)) + d.k * 0.03;
        d.a += speed * dt;
        const rr = d.r + kick * (60 + 140 * d.k) * Math.min(1, centre.ring / d.r + 0.4);
        const ca = Math.cos(d.a);
        const sa = Math.sin(d.a);
        let x = centre.x + rr * ca * 1.18;
        let y = centre.y + rr * sa * 0.86 + Math.sin(t * 0.7 + d.k * 9) * 2;
        const ring = Math.exp(-(((d.r - centre.ring) / (centre.ring * 0.32)) ** 2));
        let light = ring * (0.75 + 0.25 * Math.sin(t * 1.3 + d.k * 20)) + kick * 0.8;
        if (pointer.on > 0.01) {
          const px = x - pointer.x;
          const py = y - pointer.y;
          const dist = Math.hypot(px, py);
          if (dist < 200) {
            const f = (1 - dist / 200) * pointer.on;
            light += f * 0.9;
            x += (px / (dist || 1)) * f * 18;
            y += (py / (dist || 1)) * f * 18;
          }
        }
        light = Math.min(1, light);
        if (x > quiet.x0 && x < quiet.x1 && y > quiet.y0 && y < quiet.y1) {
          if (d.k < 0.7) continue;
          light *= 0.25;
        }
        const len = 1.6 + light * (7 + d.k * 5);
        // Along the turn: the tangent of the ellipse.
        let tx = -sa * 1.18;
        let ty = ca * 0.86;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const bucket = Math.min(BUCKETS - 1, Math.floor((0.12 + 0.88 * light) * BUCKETS));
        const p = paths[bucket];
        p.moveTo(x - (tx * len) / 2, y - (ty * len) / 2);
        p.lineTo(x + (tx * len) / 2, y + (ty * len) / 2);
      }
      ctx.lineCap = "round";
      for (let b = 0; b < BUCKETS; b++) {
        const level = (b + 1) / BUCKETS;
        ctx.lineWidth = 1.4 + level * 1.4;
        ctx.strokeStyle = `rgba(${BLUE[0]},${BLUE[1]},${BLUE[2]},${0.16 + 0.84 * level})`;
        ctx.stroke(paths[b]);
      }
    };

    let raf = 0;
    let last = 0;
    let onScreen = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      draw(dt);
    };
    const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sync = () => {
      const run = onScreen && document.visibilityState === "visible" && !still();
      if (run && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (!run) draw(0);
    };

    measure();
    draw(0);
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            measure();
            draw(0);
          });
    ro?.observe(cardEl);
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            sync();
          });
    io?.observe(cardEl);
    const onVisibility = () => sync();
    document.addEventListener("visibilitychange", onVisibility);

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onMove = (event: PointerEvent) => {
      if (!fine.matches || event.pointerType !== "mouse") return;
      const rect = cardEl.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    cardEl.addEventListener("pointermove", onMove, { passive: true });
    cardEl.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cardEl.removeEventListener("pointermove", onMove);
      cardEl.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const onTap = () => {
    burst.current = 1;
    next();
  };

  return (
    <section className="uz-emith" aria-labelledby="uz-emith-title" dir="ltr" lang="en">
      <div ref={card} className="uz-emith-card" data-shown={shown || undefined}>
        <canvas ref={canvas} className="uz-emith-field" aria-hidden="true" />
        <div ref={copy} className="uz-emith-copy">
          <p className="uz-emith-eyebrow">Your study partner</p>
          <h2 id="uz-emith-title" className="uz-emith-title">
            <span className="uz-emith-sr">{TITLE}</span>
            <span aria-hidden="true">
              {[...TITLE].map((ch, i) => (
                <span
                  key={i}
                  className={i === TITLE.length - 1 ? "uz-emith-ch uz-emith-last" : "uz-emith-ch"}
                  style={{ "--i": i, "--type": `${TYPE_MS}ms` } as CSSProperties}
                >
                  {ch}
                </span>
              ))}
            </span>
          </h2>
          <p className="uz-emith-lead">
            Emith walks you through every lesson and every book in Uzyra. She explains the hard
            parts, quizzes you on the rest, and cheers when it clicks.
          </p>
          <Link to="/learn" className="uz-emith-button">
            Start learning
          </Link>
        </div>
        <button
          ref={figure}
          type="button"
          className="uz-emith-figure"
          onClick={onTap}
          aria-label="Emith, your Uzyra study partner. Tap to see her next move."
        >
          <span ref={hop} className="uz-emith-hop">
            <span className="uz-emith-float">
              {POSES.map((name, i) => (
                <img
                  key={name}
                  src={`/media/home/emith/emith-${name}.webp`}
                  alt=""
                  width={568}
                  height={694}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  data-on={i === pose || undefined}
                />
              ))}
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
