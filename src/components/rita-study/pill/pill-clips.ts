/**
 * Uzyra's moves: short keyframed clips for each mood, the eye shapes for each feeling, and the
 * reactions to a tap.
 *
 * The rhythm follows what makes the reference landing page's characters feel alive: waiting clips
 * of 4–6 s, speaking clips of about 2.5 s, thinking clips of 4–5 s; most moves eased in and out,
 * quick turns that snap and settle, blinks that open with a little overshoot, and two blinks or so
 * per clip. The clips and shapes themselves are ours.
 */

import { cubicBezier, type Ease } from "./pill-motion.ts";
import type { EyePair, EyeShape, Pose } from "./pill-shape.ts";

export type Mood = "idle" | "listening" | "thinking" | "speaking";

export const EASES = {
  /** In and out: most moves. */
  io: cubicBezier(0.42, 0, 0.58, 1),
  /** A quick turn that lands softly. */
  snap: cubicBezier(0.74, 0.03, 0.26, 1.02),
  /** Lands with a small overshoot (blinks opening, a hop landing). */
  pop: cubicBezier(0.4, 0.22, 0.28, 1.34),
  /** Settles with a bigger overshoot. */
  over: cubicBezier(0.58, 0.31, 0.05, 1.36),
  /** Falls, speeding up (the way down of a hop). */
  fall: cubicBezier(0.5, 0, 0.9, 0.6),
  lin: (t: number) => t,
} satisfies Record<string, Ease>;

export type EaseName = keyof typeof EASES;
export type Key = { t: number; v: number; e?: EaseName };
export type Channel = keyof Pose;

export type FaceName =
  "neutral" | "attentive" | "squint" | "happy" | "surprised" | "curious" | "sleepy";

export type Clip = {
  name: string;
  duration: number;
  /** How often it comes up compared with the others of its mood. */
  weight: number;
  tracks: Partial<Record<Channel, Key[]>>;
  /** Feelings to change to (always through a blink, so the swap is never seen). */
  faces?: { t: number; face: FaceName }[];
  blinks?: number[];
};

const eye = (w: number, h: number, tilt = 0, dy = 0): EyeShape => ({ w, h, tilt, dy });
const both = (e: EyeShape): EyePair => [e, { ...e }];

export const FACES: Record<FaceName, EyePair> = {
  neutral: both(eye(8, 17)),
  attentive: both(eye(8.5, 19, 0, -0.5)),
  squint: both(eye(9, 8, 8, -1)),
  happy: both(eye(9.5, 7, -10, -1)),
  surprised: both(eye(9.5, 21, 0, -1)),
  curious: [eye(8, 17), eye(8.5, 10, 6, -1)],
  sleepy: both(eye(9, 3.5, 0, 2)),
};

export const MOOD_FACE: Record<Mood, FaceName> = {
  idle: "neutral",
  listening: "attentive",
  thinking: "squint",
  speaking: "neutral",
};

/** A gentle bob: up by `lift` and back, `times` times across `duration`. */
function bob(duration: number, times: number, lift: number, base = 0): Key[] {
  const keys: Key[] = [{ t: 0, v: base }];
  const step = duration / (times * 2);
  for (let i = 1; i <= times * 2; i += 1) {
    keys.push({ t: step * i, v: i % 2 ? base - lift : base, e: "io" });
  }
  return keys;
}

const IDLE: Clip[] = [
  {
    name: "float",
    duration: 5,
    weight: 3,
    tracks: {
      y: bob(5, 2, 2.2),
      roll: [
        { t: 0, v: 0 },
        { t: 1.6, v: -3, e: "io" },
        { t: 3.4, v: 2.5, e: "io" },
        { t: 5, v: 0, e: "io" },
      ],
      pitch: [
        { t: 0, v: 0 },
        { t: 2.5, v: 4, e: "io" },
        { t: 5, v: 0, e: "io" },
      ],
      lx: [
        { t: 0, v: 0 },
        { t: 0.9, v: -3.5, e: "snap" },
        { t: 2.4, v: -3.5 },
        { t: 2.8, v: 3, e: "snap" },
        { t: 4.2, v: 3 },
        { t: 4.6, v: 0, e: "snap" },
      ],
    },
    blinks: [1.3, 3.9],
  },
  {
    name: "glance",
    duration: 4,
    weight: 2,
    tracks: {
      yaw: [
        { t: 0, v: 0 },
        { t: 0.55, v: -24, e: "snap" },
        { t: 1.7, v: -24 },
        { t: 2.25, v: 20, e: "snap" },
        { t: 3.3, v: 20 },
        { t: 3.85, v: 0, e: "snap" },
      ],
      lx: [
        { t: 0, v: 0 },
        { t: 0.45, v: -3, e: "snap" },
        { t: 1.7, v: -3 },
        { t: 2.15, v: 3, e: "snap" },
        { t: 3.3, v: 3 },
        { t: 3.75, v: 0, e: "snap" },
      ],
      roll: [
        { t: 0, v: 0 },
        { t: 0.55, v: -2, e: "snap" },
        { t: 2.25, v: 2, e: "snap" },
        { t: 3.85, v: 0, e: "snap" },
      ],
    },
    faces: [
      { t: 2, face: "curious" },
      { t: 3.6, face: "neutral" },
    ],
  },
  {
    name: "hop",
    duration: 3.6,
    weight: 2,
    tracks: {
      sx: [
        { t: 0, v: 1 },
        { t: 0.35, v: 1.1, e: "io" },
        { t: 0.62, v: 0.93, e: "snap" },
        { t: 0.92, v: 1, e: "io" },
        { t: 1.2, v: 1.12, e: "fall" },
        { t: 1.55, v: 1, e: "over" },
      ],
      sy: [
        { t: 0, v: 1 },
        { t: 0.35, v: 0.86, e: "io" },
        { t: 0.62, v: 1.1, e: "snap" },
        { t: 0.92, v: 1, e: "io" },
        { t: 1.2, v: 0.86, e: "fall" },
        { t: 1.55, v: 1, e: "over" },
      ],
      y: [
        { t: 0, v: 0 },
        { t: 0.35, v: 0 },
        { t: 0.62, v: -10, e: "snap" },
        { t: 0.92, v: -14, e: "io" },
        { t: 1.2, v: 0, e: "fall" },
      ],
      roll: [
        { t: 0, v: 0 },
        { t: 0.62, v: 0 },
        { t: 0.92, v: -8, e: "io" },
        { t: 1.2, v: 0, e: "io" },
      ],
    },
    faces: [
      { t: 0.3, face: "happy" },
      { t: 2.6, face: "neutral" },
    ],
  },
  {
    name: "turn",
    duration: 5,
    weight: 1,
    tracks: {
      yaw: [
        { t: 0, v: 0 },
        { t: 0.4, v: -14, e: "io" },
        { t: 2.3, v: 360, e: "snap" },
      ],
      y: [
        { t: 0, v: 0 },
        { t: 1.2, v: -5, e: "io" },
        { t: 2.3, v: 0, e: "pop" },
      ],
      sx: [
        { t: 0, v: 1 },
        { t: 2.3, v: 1 },
        { t: 2.5, v: 1.07, e: "io" },
        { t: 2.85, v: 1, e: "over" },
      ],
      sy: [
        { t: 0, v: 1 },
        { t: 2.3, v: 1 },
        { t: 2.5, v: 0.92, e: "io" },
        { t: 2.85, v: 1, e: "over" },
      ],
    },
    faces: [
      { t: 0.3, face: "happy" },
      { t: 3, face: "neutral" },
    ],
    blinks: [3.9],
  },
  {
    name: "doze",
    duration: 6,
    weight: 1,
    tracks: {
      roll: [
        { t: 0, v: 0 },
        { t: 1.2, v: 7, e: "io" },
        { t: 4.6, v: 7 },
        { t: 4.9, v: 0, e: "snap" },
      ],
      pitch: [
        { t: 0, v: 0 },
        { t: 1.2, v: 8, e: "io" },
        { t: 4.6, v: 8 },
        { t: 4.9, v: 0, e: "snap" },
      ],
      y: [
        { t: 0, v: 0 },
        { t: 1.2, v: 1.5, e: "io" },
        { t: 4.6, v: 1.5 },
        { t: 4.85, v: -3, e: "snap" },
        { t: 5.3, v: 0, e: "over" },
      ],
      sy: [
        { t: 0, v: 1 },
        { t: 1.8, v: 0.97, e: "io" },
        { t: 2.8, v: 1, e: "io" },
        { t: 3.8, v: 0.97, e: "io" },
        { t: 4.6, v: 1, e: "io" },
      ],
    },
    faces: [
      { t: 0.4, face: "sleepy" },
      { t: 4.7, face: "surprised" },
      { t: 5.6, face: "neutral" },
    ],
  },
  {
    name: "look-up",
    duration: 4.4,
    weight: 2,
    tracks: {
      ly: [
        { t: 0, v: 0 },
        { t: 0.5, v: -3.5, e: "snap" },
        { t: 2.6, v: -3.5 },
        { t: 3.1, v: 0, e: "snap" },
      ],
      lx: [
        { t: 0, v: 0 },
        { t: 0.5, v: 1.5, e: "snap" },
        { t: 1.6, v: -1.5, e: "io" },
        { t: 2.6, v: 1, e: "io" },
        { t: 3.1, v: 0, e: "snap" },
      ],
      pitch: [
        { t: 0, v: 0 },
        { t: 0.6, v: -10, e: "snap" },
        { t: 2.6, v: -10 },
        { t: 3.2, v: 0, e: "snap" },
      ],
      y: [
        { t: 0, v: 0 },
        { t: 0.6, v: -1.5, e: "io" },
        { t: 3.2, v: 0, e: "io" },
      ],
    },
    blinks: [1.9, 3.6],
  },
];

const LISTENING: Clip[] = [
  {
    name: "lean-in",
    duration: 3,
    weight: 2,
    tracks: {
      pitch: [
        { t: 0, v: 6 },
        { t: 1.5, v: 10, e: "io" },
        { t: 3, v: 6, e: "io" },
      ],
      y: [
        { t: 0, v: 1 },
        { t: 1.5, v: 1.6, e: "io" },
        { t: 3, v: 1, e: "io" },
      ],
      sy: [
        { t: 0, v: 0.97 },
        { t: 1.5, v: 0.95, e: "io" },
        { t: 3, v: 0.97, e: "io" },
      ],
      roll: [
        { t: 0, v: 0 },
        { t: 1.5, v: -2, e: "io" },
        { t: 3, v: 0, e: "io" },
      ],
      ly: [{ t: 0, v: -1.2 }],
    },
    blinks: [2.2],
  },
  {
    name: "nod",
    duration: 2.6,
    weight: 1,
    tracks: {
      pitch: [
        { t: 0, v: 6 },
        { t: 0.35, v: 14, e: "snap" },
        { t: 0.7, v: 6, e: "io" },
        { t: 1.05, v: 12, e: "snap" },
        { t: 1.4, v: 6, e: "io" },
      ],
      y: [{ t: 0, v: 1 }],
      sy: [{ t: 0, v: 0.97 }],
      ly: [{ t: 0, v: -1.2 }],
    },
    blinks: [1.9],
  },
];

const THINKING: Clip[] = [
  {
    name: "ponder",
    duration: 4.6,
    weight: 2,
    tracks: {
      lx: [
        { t: 0, v: 0 },
        { t: 0.5, v: -3.2, e: "snap" },
        { t: 2.2, v: -3.2 },
        { t: 2.7, v: 3, e: "snap" },
        { t: 4.1, v: 3 },
        { t: 4.6, v: 0, e: "snap" },
      ],
      ly: [{ t: 0, v: -3.5 }],
      pitch: [{ t: 0, v: -8 }],
      yaw: [
        { t: 0, v: 0 },
        { t: 0.5, v: -14, e: "snap" },
        { t: 2.2, v: -14 },
        { t: 2.7, v: 12, e: "snap" },
        { t: 4.1, v: 12 },
        { t: 4.6, v: 0, e: "snap" },
      ],
      roll: [
        { t: 0, v: 0 },
        { t: 0.5, v: -4, e: "snap" },
        { t: 2.7, v: 4, e: "snap" },
        { t: 4.6, v: 0, e: "snap" },
      ],
      y: bob(4.6, 2, 1.5),
    },
    blinks: [2.45],
  },
  {
    name: "tap-tap",
    duration: 4,
    weight: 1,
    tracks: {
      y: [
        { t: 0, v: 0 },
        { t: 0.3, v: -3, e: "snap" },
        { t: 0.6, v: 0, e: "pop" },
        { t: 1.3, v: -3, e: "snap" },
        { t: 1.6, v: 0, e: "pop" },
      ],
      sy: [
        { t: 0, v: 1 },
        { t: 0.6, v: 1 },
        { t: 0.7, v: 0.94, e: "io" },
        { t: 0.9, v: 1, e: "over" },
        { t: 1.6, v: 1 },
        { t: 1.7, v: 0.94, e: "io" },
        { t: 1.9, v: 1, e: "over" },
      ],
      ly: [{ t: 0, v: -3.5 }],
      lx: [{ t: 0, v: 2 }],
      roll: [{ t: 0, v: 3 }],
      pitch: [{ t: 0, v: -8 }],
    },
    blinks: [2.8],
  },
];

const SPEAKING: Clip[] = [
  {
    name: "talk",
    duration: 2.5,
    weight: 2,
    tracks: {
      y: bob(2.5, 4, 2.4),
      roll: [
        { t: 0, v: 0 },
        { t: 0.62, v: 2.5, e: "io" },
        { t: 1.88, v: -2.5, e: "io" },
        { t: 2.5, v: 0, e: "io" },
      ],
      yaw: [
        { t: 0, v: 0 },
        { t: 1.25, v: 8, e: "io" },
        { t: 2.5, v: 0, e: "io" },
      ],
    },
    blinks: [1.4],
  },
  {
    name: "explain",
    duration: 2.6,
    weight: 1,
    tracks: {
      yaw: [
        { t: 0, v: 0 },
        { t: 0.65, v: -12, e: "snap" },
        { t: 1.95, v: 12, e: "snap" },
        { t: 2.6, v: 0, e: "snap" },
      ],
      lx: [
        { t: 0, v: 0 },
        { t: 0.55, v: -2, e: "snap" },
        { t: 1.85, v: 2, e: "snap" },
        { t: 2.6, v: 0, e: "snap" },
      ],
      roll: [
        { t: 0, v: 0 },
        { t: 0.65, v: -3, e: "io" },
        { t: 1.95, v: 3, e: "io" },
        { t: 2.6, v: 0, e: "io" },
      ],
      y: bob(2.6, 4, 2),
    },
    blinks: [1.2],
  },
];

export const CLIPS: Record<Mood, Clip[]> = {
  idle: IDLE,
  listening: LISTENING,
  thinking: THINKING,
  speaking: SPEAKING,
};

/** The value of one channel at time `t` (each stretch eases with its end key's curve). */
export function sampleTrack(keys: Key[] | undefined, t: number, rest: number): number {
  if (!keys || keys.length === 0) return rest;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i += 1) {
    const b = keys[i];
    if (t < b.t) {
      const a = keys[i - 1];
      const p = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return a.v + (b.v - a.v) * EASES[b.e ?? "io"](p);
    }
  }
  return keys[keys.length - 1].v;
}

export function sampleClip(clip: Clip, t: number, rest: Pose): Pose {
  const out = { ...rest };
  for (const channel of Object.keys(rest) as Channel[]) {
    out[channel] = sampleTrack(clip.tracks[channel], t, rest[channel]);
  }
  return out;
}

/* ---- Reactions to a tap: added on top of whatever plays. p runs 0 → 1. ---- */

export type Poke = "hop" | "spin" | "wiggle" | "nod";
export const POKE_SECONDS: Record<Poke, number> = { hop: 0.7, spin: 1, wiggle: 0.8, nod: 0.6 };
export const TAP_ORDER: Poke[] = ["hop", "spin", "wiggle", "nod"];

/** sin² bump from a to b (0 outside): a soft rise and fall. */
export function bump(p: number, a: number, b: number) {
  if (p <= a || p >= b) return 0;
  const s = Math.sin((Math.PI * (p - a)) / (b - a));
  return s * s;
}

/** What a reaction adds at progress p: moves and turns added, squash multiplied. */
export function pokeDelta(kind: Poke, p: number): Partial<Pose> {
  switch (kind) {
    case "hop": {
      const air = p > 0.2 && p < 0.75 ? Math.sin((Math.PI * (p - 0.2)) / 0.55) : 0;
      const crouch = bump(p, 0, 0.24) - bump(p, 0.18, 0.36) * 0.4;
      const land = bump(p, 0.72, 1);
      return {
        y: -15 * air,
        sx: 1 + 0.12 * crouch - 0.05 * air + 0.1 * land,
        sy: 1 - 0.16 * crouch + 0.08 * air - 0.12 * land,
        roll: -6 * Math.sin(Math.PI * Math.min(1, p / 0.75)) * (p < 0.75 ? 1 : 0),
      };
    }
    case "spin":
      return {
        yaw: 360 * EASES.snap(p),
        y: -6 * bump(p, 0, 0.9),
        sy: 1 - 0.08 * bump(p, 0.82, 1),
        sx: 1 + 0.06 * bump(p, 0.82, 1),
      };
    case "wiggle":
      return { roll: 12 * Math.sin(p * Math.PI * 4) * (1 - p) };
    case "nod":
      return { pitch: 16 * bump(p, 0, 0.45) + 9 * bump(p, 0.45, 0.9), y: 1.5 * bump(p, 0, 0.9) };
  }
}
