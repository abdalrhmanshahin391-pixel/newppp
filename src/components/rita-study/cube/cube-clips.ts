/**
 * Uzyra's moves: short, hand-timed clips for each mood. Each clip moves a few channels with
 * keyframes; a key's easing runs from it to the next key, so a move can start slow, land with a
 * small overshoot, or snap. Clips start and end at rest, and the engine blends from wherever the
 * cube is into the next one, so they chain without jumps.
 *
 * Channels: rot (degrees: + tips the top towards the viewer, + turns the face to the viewer's
 * right, + rolls anticlockwise), pos (units, y up), sq (squash: width, height), scale, look (the
 * eyes' shift on the face, units). Face events change the eyes; "base" means the mood's own face.
 */

import { cubicBezier, type Ease } from "./cube-math.ts";
import type { FaceName } from "./cube-faces.ts";

export type Mood = "idle" | "listening" | "thinking" | "speaking";

export type Key = { t: number; v: number[]; e?: Ease };
export type Clip = {
  name: string;
  duration: number;
  /** How often it comes up, against the other clips of its mood. */
  weight: number;
  rot?: Key[];
  pos?: Key[];
  sq?: Key[];
  scale?: Key[];
  look?: Key[];
  face?: { t: number; name: FaceName | "base" }[];
  blinks?: number[];
};

export type Pose = {
  rx: number;
  ry: number;
  rz: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  s: number;
  lx: number;
  ly: number;
};

export const REST: Pose = { rx: 0, ry: 0, rz: 0, x: 0, y: 0, sx: 1, sy: 1, s: 1, lx: 0, ly: 0 };

// Timing curves.
const io = cubicBezier(0.45, 0, 0.55, 1); // even in and out
const out = cubicBezier(0.22, 1, 0.36, 1); // quick start, long settle
const back = cubicBezier(0.34, 1.5, 0.64, 1); // lands a little past, then settles
const snap = cubicBezier(0.7, 0, 0.3, 1); // sharp in and out
const rise = cubicBezier(0.18, 0.7, 0.4, 1); // leaving the ground, slowing at the top
const fall = cubicBezier(0.6, 0, 0.85, 0.35); // dropping, faster and faster
const turn = cubicBezier(0.5, 0, 0.12, 1); // a big turn that winds down

const k = (t: number, v: number[], e?: Ease): Key => ({ t, v, e });

const IDLE: Clip[] = [
  {
    // Looks one way, then the other; the eyes go first and the body follows.
    name: "glance",
    duration: 3.4,
    weight: 3,
    look: [
      k(0, [0, 0], out),
      k(0.22, [-0.042, 0.004]),
      k(1.55, [-0.042, 0.004], out),
      k(1.72, [0.044, 0]),
      k(2.75, [0.044, 0], out),
      k(2.98, [0, 0]),
    ],
    rot: [
      k(0.04, [0, 0, 0], io),
      k(0.56, [0, -21, 1.5]),
      k(1.58, [0, -21, 1.5], io),
      k(2.1, [0, 19, -1.5]),
      k(2.78, [0, 19, -1.5], io),
      k(3.34, [0, 0, 0]),
    ],
    pos: [
      k(0.04, [0, 0], io),
      k(0.56, [-0.012, 0]),
      k(1.58, [-0.012, 0], io),
      k(2.1, [0.012, 0]),
      k(2.78, [0.012, 0], io),
      k(3.34, [0, 0]),
    ],
    blinks: [1.6],
  },
  {
    // A little hop: crouch, stretch up, squash on landing, settle.
    name: "hop",
    duration: 1.5,
    weight: 2,
    sq: [
      k(0, [1, 1], io),
      k(0.2, [1.13, 0.86], snap),
      k(0.31, [0.9, 1.13], out),
      k(0.56, [0.98, 1.02], io),
      k(0.8, [0.94, 1.07], snap),
      k(0.87, [1.15, 0.84], back),
      k(1.15, [0.98, 1.02], io),
      k(1.4, [1, 1]),
    ],
    pos: [k(0.22, [0, 0], rise), k(0.55, [0, 0.3], fall), k(0.86, [0, 0])],
    rot: [
      k(0.22, [0, 0, 0], out),
      k(0.55, [-9, 0, 0], io),
      k(0.86, [5, 0, 0], out),
      k(1.25, [0, 0, 0]),
    ],
    face: [
      { t: 0.24, name: "happy" },
      { t: 1.12, name: "base" },
    ],
  },
  {
    // Tips its head, one eye bigger: curious.
    name: "tilt",
    duration: 3.1,
    weight: 2,
    rot: [
      k(0, [0, 0, 0], back),
      k(0.55, [0, -9, 13]),
      k(2.25, [0, -9, 13], io),
      k(2.95, [0, 0, 0]),
    ],
    pos: [
      k(0, [0, 0], back),
      k(0.55, [-0.01, 0.008]),
      k(2.25, [-0.01, 0.008], io),
      k(2.95, [0, 0]),
    ],
    look: [
      k(0.3, [0, 0], out),
      k(0.6, [0.018, 0.014]),
      k(2.25, [0.018, 0.014], io),
      k(2.8, [0, 0]),
    ],
    face: [
      { t: 0.25, name: "curious" },
      { t: 2.3, name: "base" },
    ],
  },
  {
    // Something above catches its eye.
    name: "look-up",
    duration: 2.9,
    weight: 2,
    look: [k(0, [0, 0], out), k(0.2, [0.004, 0.04]), k(1.9, [0.004, 0.04], out), k(2.2, [0, 0])],
    rot: [
      k(0.08, [0, 0, 0], io),
      k(0.62, [-16, 5, 0]),
      k(1.85, [-16, 5, 0], io),
      k(2.5, [0, 0, 0]),
    ],
    sq: [k(0.08, [1, 1], io), k(0.62, [0.97, 1.04]), k(1.85, [0.97, 1.04], io), k(2.5, [1, 1])],
    face: [
      { t: 0.15, name: "attentive" },
      { t: 1.9, name: "base" },
    ],
    blinks: [1.25],
  },
  {
    // Reads the page below: tips forward, the eyes run along a line or two.
    name: "read",
    duration: 3.3,
    weight: 2,
    rot: [k(0, [0, 0, 0], io), k(0.6, [15, -4, 0]), k(2.35, [15, -4, 0], io), k(2.95, [0, 0, 0])],
    look: [
      k(0, [0, 0], out),
      k(0.3, [-0.022, -0.038], io),
      k(0.95, [0.022, -0.038], snap),
      k(1.08, [-0.022, -0.04], io),
      k(1.75, [0.022, -0.04], out),
      k(2.35, [0, -0.03], io),
      k(2.75, [0, 0]),
    ],
    blinks: [2.45],
  },
  {
    // A happy wiggle.
    name: "wiggle",
    duration: 1.5,
    weight: 1,
    rot: [
      k(0, [0, 0, 0], io),
      k(0.1, [0, 4, 9], io),
      k(0.23, [0, -3, -8], io),
      k(0.36, [0, 2, 6], io),
      k(0.49, [0, -1, -4], io),
      k(0.62, [0, 0, 2], io),
      k(0.78, [0, 0, 0]),
    ],
    sq: [
      k(0, [1, 1], io),
      k(0.1, [1.05, 0.95], io),
      k(0.23, [0.97, 1.04], io),
      k(0.36, [1.03, 0.97], io),
      k(0.5, [1, 1]),
    ],
    face: [
      { t: 0, name: "happy" },
      { t: 1.15, name: "base" },
    ],
  },
  {
    // Turns all the way round with a small jump, to show it is a real block.
    name: "turn-around",
    duration: 2.4,
    weight: 0.6,
    rot: [k(0, [0, 0, 0], io), k(0.28, [0, -16, 0], turn), k(1.38, [0, 360, 0])],
    pos: [k(0.25, [0, 0], rise), k(0.7, [0, 0.12], fall), k(1.25, [0, 0])],
    sq: [
      k(0, [1, 1], io),
      k(0.25, [1.08, 0.93], snap),
      k(0.36, [0.95, 1.07], out),
      k(1.22, [0.97, 1.03], snap),
      k(1.3, [1.1, 0.9], back),
      k(1.62, [1, 1]),
    ],
    blinks: [0.3],
    face: [
      { t: 1.35, name: "happy" },
      { t: 2.1, name: "base" },
    ],
  },
  {
    // Nods off, then wakes with a start.
    name: "doze",
    duration: 5.2,
    weight: 0.5,
    face: [
      { t: 0.2, name: "sleepy" },
      { t: 3.42, name: "surprised" },
      { t: 4.5, name: "base" },
    ],
    rot: [
      k(0.2, [0, 0, 0], io),
      k(1.7, [9, 0, -5], io),
      k(2.7, [6, 0, -3], io),
      k(3.3, [14, 0, -6], snap),
      k(3.48, [-7, 0, 2], out),
      k(4.6, [0, 0, 0]),
    ],
    pos: [k(3.4, [0, 0], rise), k(3.62, [0, 0.09], fall), k(3.86, [0, 0])],
    sq: [
      k(0.2, [1, 1], io),
      k(1.7, [1.03, 0.97], io),
      k(3.3, [1.04, 0.96], snap),
      k(3.48, [0.93, 1.09], out),
      k(3.9, [1.04, 0.96], io),
      k(4.3, [1, 1]),
    ],
  },
  {
    // Just breathes and looks about a little.
    name: "rest",
    duration: 3,
    weight: 2,
    look: [
      k(0.6, [0, 0], io),
      k(1.1, [0.014, -0.006]),
      k(2.3, [0.014, -0.006], io),
      k(2.8, [0, 0]),
    ],
    blinks: [1.7],
  },
];

const THINKING: Clip[] = [
  {
    name: "ponder",
    duration: 3.8,
    weight: 2,
    look: [k(0, [0, 0], out), k(0.3, [0.03, 0.036]), k(3.35, [0.03, 0.036], io), k(3.75, [0, 0])],
    rot: [
      k(0, [0, 0, 0], io),
      k(0.7, [-11, 14, -6], io),
      k(1.9, [-8, 10, -3], io),
      k(3.0, [-11, 14, -6], io),
      k(3.7, [0, 0, 0]),
    ],
    blinks: [2.1],
  },
  {
    // The eyes search one way and the other, the body a step behind.
    name: "scan",
    duration: 3.4,
    weight: 2,
    look: [
      k(0, [0, 0], io),
      k(0.4, [-0.04, 0.02], io),
      k(1.4, [0.04, 0.02], io),
      k(2.4, [-0.03, 0.02], io),
      k(3.1, [0, 0]),
    ],
    rot: [
      k(0, [0, 0, 0], io),
      k(0.7, [-6, -14, 0], io),
      k(1.7, [-6, 14, 0], io),
      k(2.7, [-6, -8, 0], io),
      k(3.4, [0, 0, 0]),
    ],
  },
  {
    // Taps along while it works it out.
    name: "tap",
    duration: 2.6,
    weight: 1.5,
    sq: [
      k(0, [1, 1], io),
      k(0.18, [1.04, 0.96], io),
      k(0.4, [1, 1], io),
      k(0.78, [1.04, 0.96], io),
      k(1.0, [1, 1], io),
      k(1.38, [1.04, 0.96], io),
      k(1.6, [1, 1]),
    ],
    rot: [k(0, [0, 0, 0], io), k(0.6, [-6, 0, 4], io), k(1.6, [-6, 0, -4], io), k(2.4, [0, 0, 0])],
    look: [k(0, [0, 0], out), k(0.3, [0.02, 0.04]), k(2.1, [0.02, 0.04], io), k(2.5, [0, 0])],
  },
];

const LISTENING: Clip[] = [
  {
    // Leans in and nods along.
    name: "lean-in",
    duration: 3.4,
    weight: 2,
    rot: [
      k(0, [0, 0, 0], io),
      k(0.6, [6, -3, 0], io),
      k(1.1, [10, -3, 0], io),
      k(1.5, [6, -3, 0], io),
      k(2.4, [6, 3, 0], io),
      k(2.8, [10, 3, 0], io),
      k(3.4, [0, 0, 0]),
    ],
    scale: [k(0, [1], io), k(0.6, [1.03]), k(2.8, [1.03], io), k(3.4, [1])],
  },
  {
    name: "tilt-listen",
    duration: 3.6,
    weight: 1.5,
    rot: [k(0, [0, 0, 0], io), k(0.7, [4, -8, 9]), k(2.8, [4, -8, 9], io), k(3.5, [0, 0, 0])],
    look: [k(0.3, [0, 0], out), k(0.6, [0.015, 0.01]), k(2.8, [0.015, 0.01], io), k(3.3, [0, 0])],
  },
  { name: "still", duration: 2.4, weight: 1, blinks: [1.2] },
];

const SPEAKING: Clip[] = [
  {
    name: "sway",
    duration: 3.2,
    weight: 2,
    rot: [
      k(0, [0, 0, 0], io),
      k(0.8, [0, -7, 3], io),
      k(1.6, [0, 6, -3], io),
      k(2.4, [0, -4, 2], io),
      k(3.2, [0, 0, 0]),
    ],
  },
  {
    // Turns to explain, with a friendly face in the middle.
    name: "explain",
    duration: 3.4,
    weight: 2,
    rot: [
      k(0, [0, 0, 0], io),
      k(0.6, [3, 12, -2], io),
      k(1.4, [6, 12, -2], io),
      k(1.8, [3, 12, -2], io),
      k(2.6, [2, -6, 2], io),
      k(3.4, [0, 0, 0]),
    ],
    face: [
      { t: 1.4, name: "happy" },
      { t: 2.5, name: "base" },
    ],
  },
  {
    name: "bright",
    duration: 2.6,
    weight: 1,
    sq: [k(0, [1, 1], io), k(0.3, [0.96, 1.05], back), k(1.2, [1, 1])],
    rot: [k(0, [0, 0, 0], io), k(0.5, [-5, 0, -3], io), k(2.2, [0, 0, 0])],
    face: [
      { t: 0.1, name: "happy" },
      { t: 2.0, name: "base" },
    ],
  },
];

export const CLIPS: Record<Mood, Clip[]> = {
  idle: IDLE,
  thinking: THINKING,
  listening: LISTENING,
  speaking: SPEAKING,
};

/** Each mood's own eyes, used between clips and wherever a clip says "base". */
export const MOOD_FACE: Record<Mood, FaceName> = {
  idle: "neutral",
  listening: "attentive",
  thinking: "focused",
  speaking: "neutral",
};

/** A track's value at time t: the key before it eased towards the key after. */
export function sampleTrack(track: Key[] | undefined, t: number, rest: number[]): number[] {
  if (!track || track.length === 0) return rest;
  if (t <= track[0].t) return track[0].v;
  const last = track[track.length - 1];
  if (t >= last.t) return last.v;
  let i = 0;
  while (i < track.length - 2 && track[i + 1].t <= t) i += 1;
  const a = track[i];
  const b = track[i + 1];
  const span = Math.max(1e-9, b.t - a.t);
  const f = a.e ? a.e((t - a.t) / span) : (t - a.t) / span;
  return a.v.map((value, j) => value + (b.v[j] - value) * f);
}

export function sampleClip(clip: Clip, t: number): Pose {
  const [rx, ry, rz] = sampleTrack(clip.rot, t, [0, 0, 0]);
  const [x, y] = sampleTrack(clip.pos, t, [0, 0]);
  const [sx, sy] = sampleTrack(clip.sq, t, [1, 1]);
  const [s] = sampleTrack(clip.scale, t, [1]);
  const [lx, ly] = sampleTrack(clip.look, t, [0, 0]);
  return { rx, ry, rz, x, y, sx, sy, s, lx, ly };
}
