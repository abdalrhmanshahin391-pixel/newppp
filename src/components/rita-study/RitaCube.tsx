import { useEffect, useId, useRef, type MutableRefObject } from "react";
import { OrbDynamics, type OrbMode } from "@/components/rita-live/orb-dynamics";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";

/**
 * The cube's outline in a 100 × 100 box: a block a little wider than tall with soft corners. Each
 * corner has its own radius and the box is a touch uneven, so it reads as a hand-made, squishy thing
 * rather than a perfect icon. `wobble` (0..1 per corner) nudges the radii frame by frame.
 */
function blobPath(radii: [number, number, number, number]): string {
  const [tl, tr, br, bl] = radii;
  // Corners: slightly uneven, a touch wider than tall (about 84 × 80).
  const L = 8;
  const R = 92;
  const T = 10;
  const B = 90;
  const tilt = 1.6; // the top edge leans a little
  return [
    `M${L + tl} ${T + tilt}`,
    `L${R - tr} ${T}`,
    `Q${R} ${T} ${R} ${T + tr}`,
    `L${R + 0.6} ${B - br}`,
    `Q${R + 0.6} ${B} ${R - br} ${B}`,
    `L${L + bl} ${B + 0.4}`,
    `Q${L} ${B + 0.4} ${L} ${B - bl}`,
    `L${L - 0.4} ${T + tilt + tl}`,
    `Q${L - 0.4} ${T + tilt} ${L + tl} ${T + tilt}`,
    "Z",
  ].join(" ");
}

const BASE_RADII: [number, number, number, number] = [17, 19, 16, 20];
const BLOB = blobPath(BASE_RADII);

/**
 * Rita's face on the study page: a soft blue cube with two dark eyes that is quietly alive.
 *
 * Everything moves from one animation-frame loop that writes three transforms (body, eyes, shadow)
 * and the outline's corners (it is soft, like clay), and never touches React state:
 * - waiting: slow breathing and a slight jelly sway; it blinks every 3–7 s (sometimes twice) and
 *   now and then glances to one side, holds, and looks back;
 * - the learner speaking: it squashes with their voice like jelly and the eyes lift, listening;
 * - thinking: the eyes drift side to side and the cube leans a little;
 * - Rita speaking: small hops with her voice.
 * Timings are random so it never looks mechanical. It stops while the tab is hidden; with reduced
 * motion it stays still and only blinks.
 */
export function RitaCube({
  levelsRef,
  mode,
  label,
}: {
  levelsRef: MutableRefObject<OrbLevels>;
  mode: OrbMode;
  label: string;
}) {
  const body = useRef<HTMLDivElement>(null);
  const eyes = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  const shape = useRef<SVGSVGElement>(null);
  const modeRef = useRef<OrbMode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const bodyEl = body.current;
    const eyesEl = eyes.current;
    const shadowEl = shadow.current;
    const paths = Array.from(shape.current?.querySelectorAll("path") ?? []);
    if (!bodyEl || !eyesEl || !shadowEl) return;
    const dynamics = new OrbDynamics();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    let clock = 0;
    let last = performance.now();
    let raf = 0;
    let visible = document.visibilityState === "visible";
    // Smoothed values (critically damped by exponential easing).
    let voice = 0;
    let lift = 0;
    let eyeX = 0;
    let eyeY = 0;
    let lean = 0;
    // Blinks: when the next starts, and whether a second follows.
    let nextBlink = rand(1.2, 3);
    let blinkAt = -10;
    let secondBlink = false;
    // Glances: when the next one starts, where to, and until when it holds.
    let nextGlance = rand(4, 7);
    let glanceX = 0;
    let glanceY = 0;
    let glanceUntil = 0;

    const ease = (value: number, target: number, dt: number, tau: number) =>
      value + (target - value) * (1 - Math.exp(-dt / tau));

    /** 0 open, 1 shut: a quick close and a slightly slower open (about 140 ms). */
    const blinkAmount = (t: number) => {
      const since = t - blinkAt;
      if (since < 0 || since > 0.14) return 0;
      return since < 0.06 ? since / 0.06 : 1 - (since - 0.06) / 0.08;
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!visible) return;
      clock += dt;
      const t = clock;
      const current = modeRef.current;
      const still = reduced.matches;

      // Blinks happen in every mood (and with reduced motion: they are tiny and calm).
      if (t >= nextBlink) {
        blinkAt = t;
        if (secondBlink) {
          secondBlink = false;
          nextBlink = t + rand(3, 7);
        } else if (Math.random() < 0.25) {
          secondBlink = true;
          nextBlink = t + 0.24;
        } else {
          nextBlink = t + rand(3, 7);
        }
      }
      const shut = blinkAmount(t);

      if (still) {
        bodyEl.style.transform = "none";
        shadowEl.style.transform = "none";
        eyesEl.style.transform = `scaleY(${(1 - shut * 0.9).toFixed(3)})`;
        return;
      }

      const levels = levelsRef.current;
      const frame = dynamics.step(dt, {
        input: levels.input,
        output: levels.output,
        mode: current,
        reducedMotion: false,
      });
      const speaking = current === "speaking";
      const listening = current === "listening";
      const thinking = current === "thinking";

      // Rita's voice, smoothed: a fast rise and a softer fall, so it hops instead of shaking.
      const target = speaking ? Math.min(1, levels.output * 1.4) : 0;
      voice = ease(voice, target, dt, target > voice ? 0.045 : 0.16);
      // The learner's voice: radius < 1 while they talk.
      const press = listening ? Math.max(0, 1 - frame.radius) : 0;
      lift = ease(lift, listening && frame.voiced ? 1 : 0, dt, 0.18);
      lean = ease(lean, thinking ? Math.sin(t * 1.3) * 3 : 0, dt, 0.25);

      // Glances while waiting, listening or speaking; thinking drifts instead.
      if (thinking) {
        glanceUntil = 0;
        nextGlance = t + rand(3, 6);
      } else if (t >= nextGlance) {
        glanceX = Math.random() < 0.5 ? -1 : 1;
        glanceY = rand(-0.4, 0.3);
        glanceUntil = t + rand(0.7, 1.3);
        nextGlance = t + rand(5, 9);
      }
      const glancing = t < glanceUntil;
      const wantX = thinking ? Math.sin(t * 1.5) * 0.9 : glancing ? glanceX : 0;
      const wantY = thinking ? -0.35 : glancing ? glanceY : 0;
      eyeX = ease(eyeX, wantX, dt, 0.09);
      eyeY = ease(eyeY, wantY - lift * 0.5, dt, 0.09);

      // Calm, clay-like: small amplitudes, slow periods.
      const calm = current === "idle" ? 1 : 0.6;
      const breathe = Math.sin((t * Math.PI * 2) / 3.8) * 0.018 * calm;
      const sway = Math.sin((t * Math.PI * 2) / 5.2) * 0.6 * calm;
      const skew = Math.sin((t * Math.PI * 2) / 3.3 + 0.7) * 0.5 * calm;
      const sy = 1 + breathe - press * 0.2 + voice * 0.05;
      const sx = 1 - breathe * 0.5 + press * 0.12 - voice * 0.025;
      const hop = -voice * 7;
      // The outline itself moves a little, like soft clay: each corner breathes on its own.
      const squish = 0.8 + press * 3 + voice * 2;
      const outline = blobPath([
        BASE_RADII[0] + Math.sin(t * 1.1) * squish,
        BASE_RADII[1] + Math.sin(t * 0.9 + 1.7) * squish,
        BASE_RADII[2] + Math.sin(t * 1.3 + 3.1) * squish,
        BASE_RADII[3] + Math.sin(t * 0.8 + 4.4) * squish,
      ]);
      for (const path of paths) path.setAttribute("d", outline);
      bodyEl.style.transform =
        `translateY(${hop.toFixed(2)}%) rotate(${(sway + lean).toFixed(2)}deg) ` +
        `skewX(${skew.toFixed(2)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      shadowEl.style.transform = `scaleX(${(sx * (1 - voice * 0.25)).toFixed(4)})`;
      shadowEl.style.opacity = (1 - voice * 0.35).toFixed(3);
      eyesEl.style.transform =
        `translate(${(eyeX * 16).toFixed(2)}%, ${(eyeY * 14).toFixed(2)}%) ` +
        `scaleY(${(1 - shut * 0.9).toFixed(3)})`;
    };
    raf = requestAnimationFrame(draw);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [levelsRef]);

  const id = useId().replace(/:/g, "");
  return (
    <div className="uz-cube" role="img" aria-label={label}>
      <div ref={body} className="uz-cube-body">
        {/* Matte and soft, like clay or a gummy: light from above, a slightly lighter rim, a
            deeper bottom. No glossy highlight. */}
        <svg ref={shape} className="uz-cube-shape" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-fill`} x1="0.1" y1="0.95" x2="0.9" y2="0.05">
              <stop offset="0" stopColor="#4a83f4" />
              <stop offset="0.5" stopColor="#3170ef" />
              <stop offset="1" stopColor="#2a63dc" />
            </linearGradient>
            <linearGradient id={`${id}-rim`} x1="0" y1="1" x2="0.75" y2="0.25">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id={`${id}-soft`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="0.9" />
            </filter>
            <clipPath id={`${id}-clip`}>
              <path d={BLOB} />
            </clipPath>
          </defs>
          <g>
            <path d={BLOB} fill={`url(#${id}-fill)`} />
            <path
              d={BLOB}
              fill="none"
              stroke={`url(#${id}-rim)`}
              strokeWidth="5"
              filter={`url(#${id}-soft)`}
              clipPath={`url(#${id}-clip)`}
            />
          </g>
        </svg>
        <div ref={eyes} className="uz-cube-eyes" aria-hidden="true">
          <span className="uz-cube-eye" />
          <span className="uz-cube-eye" />
        </div>
      </div>
      <span ref={shadow} className="uz-cube-shadow" aria-hidden="true" />
    </div>
  );
}
