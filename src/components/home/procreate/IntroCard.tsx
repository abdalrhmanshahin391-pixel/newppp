import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { restFrame } from "@/components/rita-study/mascot/mascot-engine";
import {
  cardScale,
  cubeDots,
  FILM,
  filmAt,
  gathered,
  Glide,
  power2Out,
  power3Out,
  ringDots,
  ringPoint,
  scrollProgress,
  SCROLL,
} from "./intro-film";
import "./intro-card.css";

const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** The cube's outline at rest, as the dots should draw it (the 0–100 box the SVG uses). */
function restDots() {
  const rest = restFrame(200);
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe || typeof Path2D === "undefined") return [];
  const body = new Path2D(rest.body);
  const eyes = (rest.eyes ?? []).map((d) => new Path2D(d));
  return cubeDots(
    (x, y) =>
      probe.isPointInPath(body, x, y) && !eyes.some((eye) => probe.isPointInPath(eye, x, y)),
  );
}

/**
 * Under the home hero: a black card that grows as it scrolls into view, with a short film inside.
 * Dots fly in and draw Uzyra's cube, it grows, then settles beside the name and hands over to the
 * live cube while "Uzyra Ultra" wipes in; a slanted ring of dots turns behind. The film starts when
 * the card is in view, stops when it leaves, and plays again every few seconds. Tapping the card
 * replays it; the round button pauses it. On a mouse, the pointer becomes a "Replay intro" pill.
 *
 * Reduced motion (or Save-Data): no growing, no film; the card shows the cube and the name, still.
 */
export function IntroCard() {
  const section = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const first = useRef<HTMLSpanElement>(null);
  const second = useRef<HTMLSpanElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const levels = useRef({ input: 0, output: 0 });
  const playingRef = useRef(true);
  const replayRef = useRef<() => void>(() => {});
  const wakeRef = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(true);
  const [live, setLive] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData;
    const update = () => setStill(media.matches || saveData);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const sectionEl = section.current;
    const cardEl = card.current;
    const stageEl = stage.current;
    const canvasEl = canvas.current;
    const markEl = mark.current;
    const firstEl = first.current;
    const secondEl = second.current;
    const pillEl = pill.current;
    const toggleEl = toggle.current;
    if (!sectionEl || !cardEl || !stageEl || !canvasEl || !markEl || !firstEl || !secondEl) return;
    if (!pillEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const dots = restDots();
    const ring = ringDots();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 1;
    let height = 1;
    // The cube's place beside the name, in the card's own (unscaled) pixels.
    let box = { x: 0, y: 0, size: 1 };

    const measure = () => {
      width = Math.max(1, stageEl.offsetWidth);
      height = Math.max(1, stageEl.offsetHeight);
      canvasEl.width = Math.round(width * dpr);
      canvasEl.height = Math.round(height * dpr);
      const outer = stageEl.getBoundingClientRect();
      const inner = markEl.getBoundingClientRect();
      const ratio = outer.width > 0 ? width / outer.width : 1;
      box = {
        x: (inner.left - outer.left + inner.width / 2) * ratio,
        y: (inner.top - outer.top + inner.height / 2) * ratio,
        size: inner.width * ratio,
      };
    };

    // --- The film -------------------------------------------------------------------------
    let filmTime = still ? FILM.still : 0;
    let ringTime = 0;
    let started = still;
    let inView = false;
    let liveShown = false;

    const draw = () => {
      const s = filmAt(filmTime);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#fff";
      const cx = width / 2;
      const cy = height / 2;

      if (started && s.ring > 0) {
        for (const d of ring) {
          const p = ringPoint(d.u, d.v, ringTime);
          const shimmer = 0.7 + 0.3 * Math.sin(d.phase + ringTime * 0.9);
          const alpha = s.ring * d.a * (0.06 + 0.5 * p.near) * shimmer;
          if (alpha < 0.01) continue;
          const size = 1 + 1.5 * p.near;
          ctx.globalAlpha = alpha;
          ctx.fillRect(cx + p.x * height - size / 2, cy + p.y * height - size / 2, size, size);
        }
      }

      if (started && s.dots > 0) {
        const size = mix(s.size * height, box.size, s.settle);
        const mx = mix(cx, box.x, s.settle);
        const my = mix(cy, box.y, s.settle);
        if (s.glow > 0) {
          const glow = ctx.createRadialGradient(mx, my, 0, mx, my, size * 1.1);
          glow.addColorStop(0, `rgba(255,255,255,${0.24 * s.glow})`);
          glow.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = 1;
          ctx.fillStyle = glow;
          ctx.fillRect(mx - size * 1.1, my - size * 1.1, size * 2.2, size * 2.2);
          ctx.fillStyle = "#fff";
        }
        const dot = Math.max(1, size * 0.0085);
        for (const d of dots) {
          const g = gathered(s.t, d.delay);
          const alpha = s.dots * g * d.a;
          if (alpha < 0.01) continue;
          const x = mix(cx + ((d.fx - 50) / 100) * height, mx + ((d.x - 50) / 100) * size, g);
          const y = mix(cy + ((d.fy - 50) / 100) * height, my + ((d.y - 50) / 100) * size, g);
          ctx.globalAlpha = alpha;
          ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
        }
      }
      ctx.globalAlpha = 1;

      const shown = started ? s : filmAt(0);
      markEl.style.opacity = String(shown.cube);
      firstEl.style.clipPath = `inset(-25% ${(1 - shown.first) * 100}% -25% 0)`;
      firstEl.style.opacity = String(Math.min(1, shown.first * 1.6));
      secondEl.style.clipPath = `inset(-25% ${(1 - shown.second) * 100}% -25% 0)`;
      secondEl.style.opacity = String(Math.min(1, shown.second * 1.6));
      // The live cube runs only once the dots have handed over (it starts from rest, like them).
      const wantLive = started && !still && s.t >= FILM.swap[0] && s.t < FILM.out[1];
      if (wantLive !== liveShown) {
        liveShown = wantLive;
        setLive(wantLive);
      }
    };

    // --- The scroll: the card catches up with the page over a second ---------------------
    const mobile = () => window.innerWidth <= SCROLL.mobileMax;
    const catchUp = new Glide(0, SCROLL.catchUp, power3Out);
    const target = () =>
      scrollProgress(sectionEl.getBoundingClientRect().top, window.innerHeight, mobile());
    const placeCard = () => {
      cardEl.style.transform = still ? "" : `scale(${cardScale(catchUp.value, mobile())})`;
    };
    catchUp.jump(target());
    placeCard();

    // --- The cursor pill (mouse and trackpad only) ---------------------------------------
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const px = new Glide(0, 0.35, power2Out);
    const py = new Glide(0, 0.35, power2Out);
    let pillShown = false;
    let pointer = { x: 0, y: 0 };
    const local = () => {
      const rect = cardEl.getBoundingClientRect();
      const kx = rect.width > 0 ? cardEl.offsetWidth / rect.width : 1;
      const ky = rect.height > 0 ? cardEl.offsetHeight / rect.height : 1;
      return { rect, x: (pointer.x - rect.left) * kx, y: (pointer.y - rect.top) * ky };
    };
    const showPill = (on: boolean) => {
      if (on === pillShown) return;
      pillShown = on;
      pillEl.toggleAttribute("data-shown", on);
      stageEl.style.cursor = on ? "none" : "";
    };
    const followPill = (jump = false) => {
      const { rect, x, y } = local();
      const offScreen = rect.bottom < 0 || rect.top > window.innerHeight;
      const near =
        pointer.x >= rect.left - 50 &&
        pointer.x <= rect.right + 50 &&
        pointer.y >= rect.top - 50 &&
        pointer.y <= rect.bottom + 50;
      if (offScreen || !near) {
        showPill(false);
        return;
      }
      if (jump) {
        px.jump(x);
        py.jump(y);
      } else {
        px.set(x);
        py.set(y);
      }
      wake();
    };
    const overStage = (event: PointerEvent) => {
      const el = event.target as Node | null;
      return !!el && stageEl.contains(el) && !toggleEl?.contains(el);
    };
    const onPointer = (event: PointerEvent) => {
      if (still || !fine.matches || event.pointerType !== "mouse") return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!pillShown && overStage(event)) {
        followPill(true);
        showPill(true);
      } else if (pillShown && toggleEl?.contains(event.target as Node)) {
        showPill(false);
      } else if (pillShown) {
        followPill();
      }
    };
    const onLeave = () => showPill(false);

    // --- One loop for the film, the scroll catch-up and the pill ------------------------
    let raf = 0;
    let last = performance.now();
    const filmRunning = () => started && inView && playingRef.current && !still && !document.hidden;
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (filmRunning()) {
        filmTime += dt;
        ringTime += dt;
      }
      if (!still) {
        catchUp.set(target());
        catchUp.step(dt);
        placeCard();
      }
      if (pillShown) {
        px.step(dt);
        py.step(dt);
        pillEl.style.transform = `translate3d(${px.value}px, ${py.value}px, 0)`;
      }
      // Nothing to repaint while the card is off screen (the scroll still wakes the loop).
      if (inView) draw();
      if (filmRunning() || !catchUp.settled || (pillShown && !(px.settled && py.settled))) wake();
    };
    function wake() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    const onScroll = () => {
      if (pillShown) followPill();
      wake();
    };
    const seen = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView && entry.intersectionRatio >= 0.4) started = true;
        wake();
      },
      { threshold: [0, 0.4] },
    );
    seen.observe(stageEl);
    const sizer = new ResizeObserver(() => {
      measure();
      draw();
    });
    sizer.observe(stageEl);
    sizer.observe(markEl);
    document.fonts?.ready.then(() => {
      measure();
      draw();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    stageEl.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", wake);

    wakeRef.current = wake;
    replayRef.current = () => {
      if (still) return;
      filmTime = 0;
      started = true;
      playingRef.current = true;
      setPlaying(true);
      wake();
    };

    measure();
    draw();
    wake();
    sectionEl.dataset.film = still ? "still" : "on";

    return () => {
      cancelAnimationFrame(raf);
      seen.disconnect();
      sizer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onPointer);
      stageEl.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", wake);
      cardEl.style.transform = "";
      delete sectionEl.dataset.film;
      wakeRef.current = wake;
      replayRef.current = () => {};
    };
  }, [still]);

  const flip = () => {
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
    // The loop sleeps while paused; wake it to carry on.
    wakeRef.current();
  };

  return (
    <section ref={section} className="uz-intro" dir="ltr" lang="en" aria-label="Uzyra Ultra">
      <div ref={card} className="uz-intro-card">
        <div
          ref={stage}
          className="uz-intro-stage"
          {...(still
            ? {}
            : {
                role: "button",
                tabIndex: 0,
                "aria-label": "Replay the Uzyra intro",
                onClick: () => replayRef.current(),
                onKeyDown: (event: KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    replayRef.current();
                  }
                },
              })}
        >
          <canvas ref={canvas} className="uz-intro-canvas" aria-hidden="true" />
          <p className="uz-intro-lockup" aria-hidden="true">
            <span ref={mark} className="uz-intro-mark">
              <RitaCube
                levelsRef={levels}
                mode="idle"
                label=""
                active={live && playing && !still}
              />
            </span>
            <span ref={first} className="uz-intro-word">
              Uzyra
            </span>
            <span ref={second} className="uz-intro-word">
              Ultra
            </span>
          </p>
        </div>
        {!still && (
          <button
            ref={toggle}
            type="button"
            className="uz-intro-toggle"
            aria-label={playing ? "Pause the intro" : "Play the intro"}
            aria-pressed={!playing}
            onClick={flip}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" />
                <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        )}
        <div ref={pill} className="uz-intro-pill" aria-hidden="true">
          <div className="uz-intro-pill-body">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path
                d="M12 5a7 7 0 1 1-6.6 4.7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M4.2 4.6 5 10l5.2-1.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Replay intro</span>
          </div>
        </div>
      </div>
    </section>
  );
}
