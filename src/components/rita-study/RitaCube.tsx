import { useEffect, useRef, type MutableRefObject } from "react";
import { OrbDynamics, type OrbMode } from "@/components/rita-live/orb-dynamics";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";

/**
 * The cube's outline in a 100 × 100 box: a block a little wider than tall with soft corners, each a
 * touch different, so it reads as a hand-made, squishy thing rather than a perfect icon.
 */
const BLOB = (() => {
  const [tl, tr, br, bl] = [17, 19, 16, 20];
  const [L, R, T, B] = [8, 92, 10, 90];
  const tilt = 1.6;
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
})();

/** A damped spring: it overshoots and settles, like a real soft body. */
class Spring {
  value: number;
  velocity = 0;
  target: number;
  constructor(
    initial: number,
    private stiffness: number,
    private damping: number,
  ) {
    this.value = initial;
    this.target = initial;
  }
  step(dt: number) {
    // Small sub-steps keep stiff springs stable on slow frames.
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
  kick(velocity: number) {
    this.velocity += velocity;
  }
}

type Keyframe = { at: number; squash?: number; lift?: number; tilt?: number; eyeX?: number };

/**
 * The little actions it does on its own while waiting, as keyframes (seconds from the start).
 * Built on squash and stretch, anticipation and overshoot: it gathers itself before a hop, stretches
 * in the air, squashes on landing, and the springs make it bounce back.
 */
const ACTIONS: Keyframe[][] = [
  // A hop.
  [
    { at: 0, squash: 0.16 },
    { at: 0.13, squash: -0.14, lift: -16 },
    { at: 0.32, squash: 0.02, lift: 0 },
    { at: 0.44, squash: 0.14 },
    { at: 0.54, squash: 0 },
  ],
  // A double bounce in place.
  [
    { at: 0, squash: 0.12 },
    { at: 0.1, squash: -0.08 },
    { at: 0.22, squash: 0.1 },
    { at: 0.32, squash: -0.05 },
    { at: 0.42, squash: 0 },
  ],
  // A curious lean to one side.
  [
    { at: 0, tilt: -9, eyeX: -1, squash: 0.05 },
    { at: 0.75, tilt: 0, eyeX: 0, squash: 0 },
  ],
  [
    { at: 0, tilt: 9, eyeX: 1, squash: 0.05 },
    { at: 0.75, tilt: 0, eyeX: 0, squash: 0 },
  ],
  // A happy wiggle.
  [
    { at: 0, tilt: 7 },
    { at: 0.09, tilt: -7 },
    { at: 0.18, tilt: 5 },
    { at: 0.27, tilt: -3 },
    { at: 0.36, tilt: 0 },
  ],
  // A quick glance and back.
  [
    { at: 0, eyeX: 1 },
    { at: 0.7, eyeX: -1 },
    { at: 1.3, eyeX: 0 },
  ],
];

/**
 * Uzyra's face on the study page: a soft black block with two white eyes, clearly alive.
 *
 * One animation-frame loop drives a few springs (squash, lift, tilt, eyes) and writes two transforms;
 * React state is never touched. Waiting, it does a small random action every few seconds (a hop, a
 * bounce, a lean, a wiggle, a glance) and blinks. While the learner speaks it squashes hard with
 * their voice and the eyes lift; while it thinks it rocks and the eyes circle; while Uzyra speaks it
 * hops on the beats of her voice. It pauses while the tab is hidden; with reduced motion it only
 * blinks.
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
  const body = useRef<HTMLDivElement>(null);
  const eyes = useRef<HTMLDivElement>(null);
  const modeRef = useRef<OrbMode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const bodyEl = body.current;
    const eyesEl = eyes.current;
    if (!bodyEl || !eyesEl) return;
    if (!active) {
      bodyEl.style.transform = "none";
      eyesEl.style.transform = "none";
      return;
    }
    const dynamics = new OrbDynamics();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    // Squash: + squashes (shorter, wider), − stretches. Lift in % of its height (− is up).
    const squash = new Spring(0, 520, 14);
    const lift = new Spring(0, 340, 15);
    const tilt = new Spring(0, 300, 11);
    const eyeX = new Spring(0, 520, 26);
    const eyeY = new Spring(0, 520, 26);

    let clock = 0;
    let last = performance.now();
    let raf = 0;
    let visible = document.visibilityState === "visible";
    let lastMode: OrbMode = modeRef.current;
    let action: { start: number; frames: Keyframe[]; next: number } | null = null;
    let nextAction = rand(0.8, 1.8);
    let nextBlink = rand(1.5, 3.5);
    let blinkAt = -10;
    let secondBlink = false;
    let voice = 0;
    let beatReady = true;

    const play = (frames: Keyframe[]) => {
      action = { start: clock, frames, next: 0 };
    };

    /** Applies the keyframes whose time has come. */
    const runAction = () => {
      if (!action) return;
      const since = clock - action.start;
      while (action.next < action.frames.length && action.frames[action.next].at <= since) {
        const frame = action.frames[action.next];
        if (frame.squash !== undefined) squash.target = frame.squash;
        if (frame.lift !== undefined) lift.target = frame.lift;
        if (frame.tilt !== undefined) tilt.target = frame.tilt;
        if (frame.eyeX !== undefined) eyeX.target = frame.eyeX;
        action.next += 1;
      }
      if (action.next >= action.frames.length) action = null;
    };

    /** 0 open, 1 shut: a quick close and open (about 110 ms). */
    const blinkAmount = (t: number) => {
      const since = t - blinkAt;
      if (since < 0 || since > 0.11) return 0;
      return since < 0.045 ? since / 0.045 : 1 - (since - 0.045) / 0.065;
    };

    // Seen on screen? Off screen (a closed tab of the reader, scrolled away) it does no work.
    let onScreen = true;
    const seen =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            last = performance.now();
          });
    seen?.observe(bodyEl);
    let lastBody = "";
    let lastEyes = "";
    /** Writes a transform only when it changed (an unchanged write still costs a style pass). */
    const put = (bodyTransform: string, eyesTransform: string) => {
      if (bodyTransform !== lastBody) bodyEl.style.transform = lastBody = bodyTransform;
      if (eyesTransform !== lastEyes) eyesEl.style.transform = lastEyes = eyesTransform;
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || !onScreen) {
        last = now;
        return;
      }
      // Calm (waiting or thinking, no hop playing) it moves slowly: 30 frames a second are
      // enough and halve the work; listening and speaking follow the voice at full rate.
      const calm = (modeRef.current === "idle" || modeRef.current === "thinking") && !action;
      if (calm && now - last < 30) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const t = clock;
      const current = modeRef.current;

      if (t >= nextBlink) {
        blinkAt = t;
        if (secondBlink) {
          secondBlink = false;
          nextBlink = t + rand(2.5, 5.5);
        } else if (Math.random() < 0.3) {
          secondBlink = true;
          nextBlink = t + 0.18;
        } else {
          nextBlink = t + rand(2.5, 5.5);
        }
      }
      const shut = blinkAmount(t);

      if (reduced.matches) {
        put("none", `scaleY(${(1 - shut * 0.92).toFixed(3)})`);
        return;
      }

      // A change of mood starts with a little hop, so the change is seen.
      if (current !== lastMode) {
        lastMode = current;
        tilt.target = 0;
        eyeX.target = 0;
        eyeY.target = 0;
        play(ACTIONS[0]);
      }

      const levels = levelsRef.current;
      const frame = dynamics.step(dt, {
        input: levels.input,
        output: levels.output,
        mode: current,
        reducedMotion: false,
      });

      if (current === "idle") {
        if (!action && t >= nextAction) {
          play(ACTIONS[Math.floor(Math.random() * ACTIONS.length)]);
          nextAction = t + rand(2, 4);
        }
        if (!action) {
          squash.target = Math.sin(t * 2.4) * 0.025;
          eyeY.target = 0;
        }
      } else if (current === "listening") {
        // The learner's voice presses it down; it springs back in the pauses.
        const press = Math.max(0, 1 - frame.radius);
        if (!action) {
          squash.target = Math.min(0.24, press * 0.9);
          tilt.target = Math.sin(t * 3) * 2;
          eyeX.target = 0;
        }
        eyeY.target = frame.voiced ? -0.7 : -0.3;
      } else if (current === "thinking") {
        if (!action) {
          tilt.target = Math.sin(t * 3.4) * 7;
          squash.target = Math.sin(t * 6.8) * 0.04;
        }
        eyeX.target = Math.cos(t * 2.6) * 0.9;
        eyeY.target = Math.sin(t * 2.6) * 0.45 - 0.25;
      } else if (current === "speaking") {
        // Hops on the beats of Uzyra's voice, and stretches up while her voice is loud.
        const target = Math.min(1, levels.output * 1.5);
        voice += (target - voice) * (1 - Math.exp(-dt / (target > voice ? 0.03 : 0.12)));
        if (beatReady && voice > 0.45) {
          beatReady = false;
          lift.kick(-140);
          squash.kick(-3);
        } else if (voice < 0.22) {
          beatReady = true;
        }
        if (!action) {
          squash.target = -voice * 0.1;
          tilt.target = Math.sin(t * 4) * 2.5;
        }
        eyeY.target = -0.15;
        eyeX.target = 0;
      }
      runAction();

      const q = squash.step(dt);
      const y = lift.step(dt);
      const r = tilt.step(dt);
      const ex = eyeX.step(dt);
      const ey = eyeY.step(dt);
      const sy = 1 - q;
      const sx = 1 + q * 0.75;
      put(
        `translateY(${y.toFixed(2)}%) rotate(${r.toFixed(2)}deg) ` +
          `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
        `translate(${(ex * 22).toFixed(1)}%, ${(ey * 30).toFixed(1)}%) ` +
          `scaleY(${(1 - shut * 0.92).toFixed(2)})`,
      );
    };
    raf = requestAnimationFrame(draw);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      seen?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [levelsRef, active]);

  return (
    <div className="uz-cube" role="img" aria-label={label}>
      <div ref={body} className="uz-cube-body">
        <svg className="uz-cube-shape" viewBox="0 0 100 100" aria-hidden="true">
          <path d={BLOB} />
        </svg>
        <div ref={eyes} className="uz-cube-eyes" aria-hidden="true">
          <span className="uz-cube-eye" />
          <span className="uz-cube-eye" />
        </div>
      </div>
    </div>
  );
}
