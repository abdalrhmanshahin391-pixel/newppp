/**
 * Uzyra, alive: plays the clips of its mood one after another (a little faster than they are
 * written), blends from wherever it is into the next one (never jumping), blinks, changes its eyes
 * inside a blink so the swap is never seen, follows the pointer with its eyes and then its body,
 * reacts to taps, and moves with the voices in a conversation.
 *
 * On top of the clips it adds the follow-through that makes it feel soft: it stretches along fast
 * moves (up and down, and while it spins), leans into a spin and wobbles back when it stops, and
 * jiggles like jelly when it lands. Each frame it gives the outline and the two eyes as SVG paths
 * in the 100 × 100 box. Pure (no DOM), so it is the same on the server and in tests.
 */

import {
  CLIPS,
  EASES,
  FACES,
  MOOD_FACE,
  POKE_SECONDS,
  pokeDelta,
  sampleClip,
  TAP_ORDER,
  type Clip,
  type FaceName,
  type Mood,
  type Poke,
} from "./mascot-clips.ts";
import { approach, cubicBezier, lerp, seeded, Spring } from "./mascot-motion.ts";
import {
  mascotFrame,
  REST_POSE,
  type EyePair,
  type MascotFrame,
  type Pose,
} from "./mascot-shape.ts";

export type { Mood, Poke, MascotFrame };

/** Clips play this much faster than written (1.25: a quarter faster). */
export const SPEED = 1.25;
/** Moving from one clip into the next: from where it is, over this long, on this curve. */
export const BRIDGE_SECONDS = 0.4;
const BRIDGE = cubicBezier(0.4, 0, 0.2, 1);
/** A blink: closes in the first 35%, opens with a little overshoot. */
export const BLINK_SECONDS = 0.24;
const BLINK_CLOSED = 0.35;
/** Squash and stretch never go past these, whatever adds up. */
export const SQUASH_LIMITS = [0.86, 1.16] as const;

export type MascotOptions = { seed?: number; reduced?: boolean; size?: number; mood?: Mood };

function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out = { ...a };
  for (const k of Object.keys(a) as (keyof Pose)[]) out[k] = lerp(a[k], b[k], t);
  return out;
}

/** Whole turns are the same pose: the nearest equal angle to 0. */
const fold = (deg: number) => deg - 360 * Math.round(deg / 360);
/** The short way from a to b, in degrees. */
const turnBy = (a: number, b: number) => fold(b - a);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How closed the lids are at blink progress p (0 open, 1 shut; a little below 0 as they pop). */
export function lidAt(p: number) {
  if (p <= 0 || p >= 1) return 0;
  if (p < BLINK_CLOSED) return EASES.io(p / BLINK_CLOSED);
  return 1 - EASES.pop((p - BLINK_CLOSED) / (1 - BLINK_CLOSED));
}

export function createMascot(options: MascotOptions = {}) {
  const rand = seeded(options.seed ?? 1);
  const between = (a: number, b: number) => a + rand() * (b - a);
  let reduced = options.reduced ?? false;
  let mood: Mood = options.mood ?? "idle";
  let decimals = 2;
  let samples = 144;
  const setSize = (px: number) => {
    decimals = px >= 96 ? 2 : 1;
    samples = Math.round(clamp(px * 0.6, 48, 168));
  };
  setSize(options.size ?? 200);

  // ---- Clips: weighted, never the same one twice in a row.
  let clip: Clip;
  let clipT = 0;
  let lastClip: Clip | null = null;
  const pokes: { kind: Poke; t: number }[] = [];
  /** A tapped spin or flip is playing: no clip spin on top of it. */
  const turningByTap = () => pokes.some((p) => p.kind === "spin" || p.kind === "flip");
  const pick = (): Clip => {
    const all = CLIPS[mood];
    let pool = all.filter((c) => c !== lastClip || all.length === 1);
    if (turningByTap()) pool = pool.filter((c) => !c.showy);
    let roll = rand() * pool.reduce((sum, c) => sum + c.weight, 0);
    for (const c of pool) {
      roll -= c.weight;
      if (roll <= 0) return c;
    }
    return pool[pool.length - 1];
  };
  let bridge: { from: Pose; t: number } | null = null;
  let base: Pose = { ...REST_POSE };
  const start = (next: Clip, blend: boolean) => {
    if (blend) {
      // Whole turns are folded away first, so it never unwinds a spin or a flip.
      bridge = {
        from: { ...base, yaw: fold(base.yaw), pitch: fold(base.pitch), roll: fold(base.roll) },
        t: 0,
      };
    }
    clip = next;
    lastClip = next;
    clipT = 0;
  };
  clip = pick();
  lastClip = clip;
  // Each one starts somewhere different in its first clip, so several never move in step.
  clipT = rand() * clip.duration * 0.5;

  // ---- Eyes: the shown pair, a pending feeling (taken in the next blink), the blink itself.
  let faceName: FaceName = MOOD_FACE[mood];
  let eyes: EyePair = FACES[faceName];
  let pending: FaceName | null = null;
  let blinkP = -1;
  let nextBlink = between(1.2, 3.2);
  const blink = () => {
    if (blinkP < 0) blinkP = 0;
  };
  const wantFace = (name: FaceName) => {
    if (name === faceName && !pending) return;
    pending = name;
    blink();
  };

  // ---- Pointer, taps and voices.
  let gazeAt: [number, number] | null = null;
  let eyeX = 0;
  let eyeY = 0;
  let headYaw = 0;
  let headPitch = 0;
  let taps = 0;
  let heard = 0;
  let said = 0;

  // ---- Follow-through: speeds of the last frames, the lean into a spin, the landing jiggle.
  let prev: Pose | null = null;
  let fallSpeed = 0;
  let spinSpeed = 0;
  const lean = new Spring(0, 15, 0.42);
  const jelly = new Spring(0, 24, 0.26);

  let pose: Pose = { ...REST_POSE };

  return {
    get mood() {
      return mood;
    },
    get clip() {
      return clip.name;
    },
    get face() {
      return faceName;
    },
    setMood(next: Mood) {
      if (next === mood) return;
      mood = next;
      wantFace(MOOD_FACE[mood]);
      start(pick(), true);
    },
    setReduced(value: boolean) {
      reduced = value;
    },
    setSize,
    gaze(at: [number, number] | null) {
      gazeAt = at;
    },
    poke(kind?: Poke) {
      if (reduced) return;
      let chosen = kind ?? TAP_ORDER[taps++ % TAP_ORDER.length];
      // Never two turns at once: during a spin or flip (by clip or by tap), a tap hops instead.
      if ((chosen === "spin" || chosen === "flip") && (clip.showy || turningByTap()))
        chosen = "hop";
      pokes.push({ kind: chosen, t: 0 });
      if (chosen !== "nod") wantFace("happy");
    },
    blink,
    step(dt: number, levels: { input: number; output: number } = { input: 0, output: 0 }) {
      // Blinks run in every mode, reduced motion included: they are the only thing that moves.
      nextBlink -= dt;
      if (nextBlink <= 0) {
        blink();
        // Now and then a double blink.
        nextBlink = rand() < 0.18 ? BLINK_SECONDS + 0.12 : between(2.4, 5.2);
      }
      if (blinkP >= 0) {
        const before = blinkP;
        blinkP += dt / BLINK_SECONDS;
        // At the closed moment the new eyes are swapped in, unseen.
        if (before < BLINK_CLOSED && blinkP >= BLINK_CLOSED && pending) {
          faceName = pending;
          eyes = FACES[faceName];
          pending = null;
        }
        if (blinkP >= 1) blinkP = -1;
      }

      if (reduced) {
        pose = { ...REST_POSE };
        prev = null;
        return;
      }

      // The clip (a little faster than written), its feelings and blinks, and the next clip.
      const before = clipT;
      clipT += dt * SPEED;
      for (const event of clip.faces ?? []) {
        if (event.t > before && event.t <= clipT) wantFace(event.face);
      }
      for (const at of clip.blinks ?? []) if (at > before && at <= clipT) blink();
      if (clipT >= clip.duration) start(pick(), true);

      let now = sampleClip(clip, clipT, REST_POSE);
      if (bridge) {
        bridge.t += dt;
        const k = BRIDGE(Math.min(1, bridge.t / BRIDGE_SECONDS));
        now = mixPose(bridge.from, now, k);
        if (bridge.t >= BRIDGE_SECONDS) bridge = null;
      }
      base = now;

      // Taps, added on top (in real time).
      const out = { ...now };
      for (let i = pokes.length - 1; i >= 0; i -= 1) {
        const p = pokes[i];
        p.t += dt / POKE_SECONDS[p.kind];
        if (p.t >= 1) {
          pokes.splice(i, 1);
          continue;
        }
        const d = pokeDelta(p.kind, p.t);
        out.x += d.x ?? 0;
        out.y += d.y ?? 0;
        out.roll += d.roll ?? 0;
        out.yaw += d.yaw ?? 0;
        out.pitch += d.pitch ?? 0;
        out.sx *= d.sx ?? 1;
        out.sy *= d.sy ?? 1;
      }

      // The pointer: eyes first (quick), then the body (slower).
      const [gx, gy] = gazeAt ?? [0, 0];
      eyeX = approach(eyeX, gx * 4.5, 0.07, dt);
      eyeY = approach(eyeY, -gy * 3.5, 0.07, dt);
      headYaw = approach(headYaw, gx * 16, 0.22, dt);
      headPitch = approach(headPitch, -gy * 10, 0.22, dt);
      const held = gazeAt ? 1 : 0;
      out.lx = lerp(out.lx, out.lx * 0.3, held) + eyeX;
      out.ly = lerp(out.ly, out.ly * 0.3, held) + eyeY;
      out.yaw += headYaw;
      out.pitch += headPitch;

      // Voices: quick to rise, a little slower to fall.
      const inTarget = clamp(levels.input, 0, 1);
      const outTarget = clamp(levels.output, 0, 1);
      heard = approach(heard, inTarget, inTarget > heard ? 0.03 : 0.1, dt);
      said = approach(said, outTarget, outTarget > said ? 0.03 : 0.1, dt);
      if (mood === "speaking") {
        out.y -= 3.2 * said;
        out.sy *= 1 + 0.07 * said;
        out.sx *= 1 - 0.045 * said;
      } else if (mood === "listening") {
        out.sy *= 1 - 0.07 * heard;
        out.sx *= 1 + 0.05 * heard;
        out.pitch += 5 * heard;
      }

      // Follow-through, from how fast it moved since the last frame.
      if (prev && dt > 0) {
        const fall = (out.y - prev.y) / dt;
        const spin = turnBy(prev.yaw, out.yaw) / dt;
        const wasFalling = fallSpeed;
        fallSpeed = approach(fallSpeed, fall, 0.025, dt);
        spinSpeed = approach(spinSpeed, spin, 0.04, dt);
        // It lands: a fall that stops at once sets it jiggling.
        if (wasFalling > 90 && fall < 20) jelly.kick(Math.min(1.6, wasFalling / 170));
      }
      prev = { ...out };
      lean.target = clamp(spinSpeed / 180, -7, 7);
      lean.step(dt);
      jelly.step(dt);
      // Stretch along a fast move up or down, and while it spins.
      const stretch = clamp(Math.abs(fallSpeed) / 4200, 0, 0.06);
      const smear = clamp(Math.abs(spinSpeed) / 28000, 0, 0.05);
      out.sy *= (1 + stretch + smear) * (1 - jelly.x);
      out.sx *= (1 - 0.7 * stretch - smear) * (1 + jelly.x);
      out.roll += lean.x;
      out.sx = clamp(out.sx, SQUASH_LIMITS[0], SQUASH_LIMITS[1]);
      out.sy = clamp(out.sy, SQUASH_LIMITS[0], SQUASH_LIMITS[1]);
      pose = out;
    },
    pose() {
      return pose;
    },
    frame(): MascotFrame {
      return mascotFrame(pose, eyes, {
        samples,
        decimals,
        lid: blinkP >= 0 ? lidAt(blinkP) : 0,
      });
    },
  };
}

export type Mascot = ReturnType<typeof createMascot>;

/** Uzyra at rest: the first paint, the still frame, and what the intro film's dots draw. */
export function restFrame(size = 200): MascotFrame {
  return mascotFrame(REST_POSE, FACES.neutral, {
    samples: Math.round(clamp(size * 0.6, 48, 168)),
    decimals: size >= 96 ? 2 : 1,
  });
}
