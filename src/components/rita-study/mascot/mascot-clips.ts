/**
 * Uzyra's moves: short keyframed clips for each mood, the eye shapes for each feeling, and the
 * reactions to a tap.
 *
 * The rhythm and ranges follow the bots on x.ai/bot, read from their page: a full spin of 300–360°
 * in 0.6–1.1 s, about one clip in three with a spin or a flip, a front flip of about 210° in under
 * a second, squash and stretch within 0.93–1.12 across and 0.88–1.09 up, most moves eased in and
 * out, quick turns that snap and settle, and blinks that open with a small overshoot. The people
 * who watch these like the spins and the happy eyes most, so those come up most often here. The
 * clips themselves, the shapes and the code are ours.
 */

import { cubicBezier, type Ease } from "./mascot-motion.ts";
import { EYE, type EyePair, type EyeShape, type Pose } from "./mascot-shape.ts";

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
  /** Draws back a little before it goes (a wind-up), then lands without overshoot. */
  wind: cubicBezier(0.4, -0.14, 0.16, 1),
  /**
   * A whole spin or flip: fast in the middle (about 2.9 times the average speed) and soft at both
   * ends, so a turn of 360° in 0.85 s stays near 21° a frame at 60 fps and never strobes.
   */
  whirl: cubicBezier(0.6, 0, 0.3, 1),
  lin: (t: number) => t,
} satisfies Record<string, Ease>;

export type EaseName = keyof typeof EASES;
export type Key = { t: number; v: number; e?: EaseName };
export type Channel = keyof Pose;

export type FaceName =
  "neutral" | "attentive" | "squint" | "happy" | "surprised" | "curious" | "sleepy";

export type Clip = {
  name: string;
  /** Length in clip time (it plays `SPEED` times faster than this). */
  duration: number;
  /** How often it comes up compared with the others of its mood. */
  weight: number;
  tracks: Partial<Record<Channel, Key[]>>;
  /** Feelings to change to (always through a blink, so the swap is never seen). */
  faces?: { t: number; face: FaceName }[];
  blinks?: number[];
  /** It spins or flips: the moves people like most (used to keep them frequent). */
  showy?: boolean;
};

const pill = (w: number, h: number, tilt = 0, dy = 0, dx = 0): EyeShape => ({
  kind: "pill",
  w,
  h,
  tilt,
  dx,
  dy,
});
const arc = (up: boolean, r: number, span: number, t: number, dy = 0, dx = 0): EyeShape => ({
  kind: "arc",
  r,
  span,
  t,
  up,
  tilt: 0,
  dx,
  dy,
});
const both = (e: EyeShape): EyePair => [e, { ...e }];

export const FACES: Record<FaceName, EyePair> = {
  neutral: both(pill(EYE.w, EYE.h)),
  attentive: both(pill(10, 22.5, 0, -0.5)),
  /** Thinking: the same upright pills, a little shorter (never small round dots). */
  squint: both(pill(9, 16.5, 0, -1)),
  /** ◠ ◠: the eyes flip up into happy arcs. */
  happy: both(arc(true, 6.2, 160, 5.4, -1.5, 2.5)),
  surprised: both(pill(11, 23.5, 0, -1)),
  curious: [pill(EYE.w, EYE.h), pill(9, 16.5, 0, -1)],
  /** ◡ ◡: relaxed, nearly shut. */
  sleepy: both(arc(false, 5.6, 130, 4.2, 2, 2)),
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

/**
 * Squash and stretch for a jump: crouch, stretch on take-off, round in the air, squash on
 * landing, settle with an overshoot. `t` are the crouch, take-off, apex, landing and settle times.
 */
function jumpSquash(t: [number, number, number, number, number]) {
  const [crouch, off, apex, land, settle] = t;
  const sx: Key[] = [
    { t: 0, v: 1 },
    { t: crouch, v: 1.12, e: "io" },
    { t: off, v: 0.93, e: "snap" },
    { t: apex, v: 1, e: "io" },
    { t: land, v: 1.12, e: "fall" },
    { t: settle, v: 1, e: "over" },
  ];
  const sy: Key[] = sx.map((k) => ({ ...k, v: k.v === 1 ? 1 : k.v > 1 ? 0.88 : 1.09 }));
  return { sx, sy };
}

const IDLE: Clip[] = [
  {
    name: "float",
    duration: 5,
    weight: 2,
    tracks: {
      y: bob(5, 2, 2.4),
      roll: [
        { t: 0, v: 0 },
        { t: 1.6, v: -3, e: "io" },
        { t: 3.4, v: 3, e: "io" },
        { t: 5, v: 0, e: "io" },
      ],
      pitch: [
        { t: 0, v: 0 },
        { t: 2.5, v: 5, e: "io" },
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
        { t: 0.5, v: -26, e: "snap" },
        { t: 1.6, v: -26 },
        { t: 2.1, v: 22, e: "snap" },
        { t: 3.2, v: 22 },
        { t: 3.7, v: 0, e: "over" },
      ],
      lx: [
        { t: 0, v: 0 },
        { t: 0.4, v: -3, e: "snap" },
        { t: 1.6, v: -3 },
        { t: 2, v: 3, e: "snap" },
        { t: 3.2, v: 3 },
        { t: 3.6, v: 0, e: "snap" },
      ],
      roll: [
        { t: 0, v: 0 },
        { t: 0.5, v: -2, e: "snap" },
        { t: 2.1, v: 2, e: "snap" },
        { t: 3.7, v: 0, e: "snap" },
      ],
    },
    faces: [
      { t: 1.9, face: "curious" },
      { t: 3.5, face: "neutral" },
    ],
  },
  {
    name: "hop",
    duration: 3.4,
    weight: 2,
    tracks: {
      ...jumpSquash([0.32, 0.55, 0.85, 1.12, 1.45]),
      y: [
        { t: 0, v: 0 },
        { t: 0.32, v: 0 },
        { t: 0.55, v: -10, e: "snap" },
        { t: 0.85, v: -14, e: "io" },
        { t: 1.12, v: 0, e: "fall" },
      ],
      roll: [
        { t: 0, v: 0 },
        { t: 0.55, v: 0 },
        { t: 0.85, v: -8, e: "io" },
        { t: 1.12, v: 0, e: "io" },
      ],
    },
    faces: [
      { t: 0.25, face: "happy" },
      { t: 2.6, face: "neutral" },
    ],
  },
  {
    // The favourite: wind up, spin all the way round in 0.85 s, land, beam.
    name: "spin",
    duration: 3.2,
    weight: 3,
    showy: true,
    tracks: {
      yaw: [
        { t: 0, v: 0 },
        { t: 0.35, v: -20, e: "io" },
        { t: 1.41, v: 360, e: "whirl" },
      ],
      y: [
        { t: 0, v: 0 },
        { t: 0.35, v: 1, e: "io" },
        { t: 0.85, v: -7, e: "io" },
        { t: 1.41, v: 0, e: "pop" },
      ],
      sx: [
        { t: 0, v: 1 },
        { t: 0.35, v: 1.08, e: "io" },
        { t: 0.55, v: 0.95, e: "io" },
        { t: 1.41, v: 1, e: "io" },
        { t: 1.56, v: 1.1, e: "io" },
        { t: 1.86, v: 1, e: "over" },
      ],
      sy: [
        { t: 0, v: 1 },
        { t: 0.35, v: 0.9, e: "io" },
        { t: 0.55, v: 1.06, e: "io" },
        { t: 1.41, v: 1, e: "io" },
        { t: 1.56, v: 0.9, e: "io" },
        { t: 1.86, v: 1, e: "over" },
      ],
    },
    faces: [
      { t: 0.2, face: "happy" },
      { t: 2.9, face: "neutral" },
    ],
  },
  {
    // A front flip: lean back to load, jump, tumble forward, land.
    name: "flip",
    duration: 3.4,
    weight: 1,
    showy: true,
    tracks: {
      ...jumpSquash([0.4, 0.6, 1.05, 1.45, 1.8]),
      pitch: [
        { t: 0, v: 0 },
        { t: 0.4, v: -12, e: "io" },
        { t: 1.45, v: 360, e: "whirl" },
      ],
      y: [
        { t: 0, v: 0 },
        { t: 0.4, v: 1, e: "io" },
        { t: 0.95, v: -16, e: "io" },
        { t: 1.45, v: 0, e: "fall" },
      ],
    },
    faces: [
      { t: 0.3, face: "happy" },
      { t: 3, face: "neutral" },
    ],
  },
  {
    // Two quick hops, the second higher, happy eyes.
    name: "double-hop",
    duration: 3,
    weight: 2,
    tracks: {
      y: [
        { t: 0, v: 0 },
        { t: 0.25, v: 0 },
        { t: 0.45, v: -8, e: "snap" },
        { t: 0.62, v: 0, e: "fall" },
        { t: 0.78, v: 0 },
        { t: 1, v: -11, e: "snap" },
        { t: 1.22, v: 0, e: "fall" },
      ],
      sx: [
        { t: 0, v: 1 },
        { t: 0.25, v: 1.1, e: "io" },
        { t: 0.45, v: 0.94, e: "snap" },
        { t: 0.62, v: 1.1, e: "fall" },
        { t: 0.78, v: 1.08, e: "io" },
        { t: 1, v: 0.93, e: "snap" },
        { t: 1.22, v: 1.12, e: "fall" },
        { t: 1.55, v: 1, e: "over" },
      ],
      sy: [
        { t: 0, v: 1 },
        { t: 0.25, v: 0.9, e: "io" },
        { t: 0.45, v: 1.08, e: "snap" },
        { t: 0.62, v: 0.9, e: "fall" },
        { t: 0.78, v: 0.92, e: "io" },
        { t: 1, v: 1.09, e: "snap" },
        { t: 1.22, v: 0.88, e: "fall" },
        { t: 1.55, v: 1, e: "over" },
      ],
      roll: [
        { t: 0, v: 0 },
        { t: 0.45, v: -5, e: "io" },
        { t: 0.62, v: 0, e: "io" },
        { t: 1, v: 5, e: "io" },
        { t: 1.22, v: 0, e: "io" },
      ],
    },
    faces: [
      { t: 0.15, face: "happy" },
      { t: 2.6, face: "neutral" },
    ],
  },
  {
    // Turns to show its side, peeks back at you, then the other way.
    name: "peek",
    duration: 4.4,
    weight: 1,
    tracks: {
      yaw: [
        { t: 0, v: 0 },
        { t: 0.45, v: 68, e: "snap" },
        { t: 1.5, v: 68 },
        { t: 1.8, v: 0, e: "over" },
        { t: 2.3, v: 0 },
        { t: 2.75, v: -68, e: "snap" },
        { t: 3.8, v: -68 },
        { t: 4.1, v: 0, e: "over" },
      ],
      lx: [
        { t: 0, v: 0 },
        { t: 0.45, v: -4, e: "snap" },
        { t: 1.5, v: -4 },
        { t: 1.8, v: 0, e: "snap" },
        { t: 2.75, v: 4, e: "snap" },
        { t: 3.8, v: 4 },
        { t: 4.1, v: 0, e: "snap" },
      ],
      roll: [
        { t: 0, v: 0 },
        { t: 0.45, v: -3, e: "io" },
        { t: 1.8, v: 0, e: "io" },
        { t: 2.75, v: 3, e: "io" },
        { t: 4.1, v: 0, e: "io" },
      ],
    },
    faces: [
      { t: 0.9, face: "curious" },
      { t: 2.1, face: "neutral" },
      { t: 3.2, face: "curious" },
      { t: 4.25, face: "neutral" },
    ],
  },
  {
    // Eyes roll up, head tips back, then the eyes flip into happy arcs.
    name: "look-up",
    duration: 4.4,
    weight: 1,
    tracks: {
      ly: [
        { t: 0, v: 0 },
        { t: 0.45, v: -4.4, e: "snap" },
        { t: 2.2, v: -4.4 },
        { t: 2.6, v: 0, e: "snap" },
      ],
      lx: [
        { t: 0, v: 0 },
        { t: 0.45, v: 1.5, e: "snap" },
        { t: 1.4, v: -1.5, e: "io" },
        { t: 2.2, v: 1, e: "io" },
        { t: 2.6, v: 0, e: "snap" },
      ],
      pitch: [
        { t: 0, v: 0 },
        { t: 0.55, v: -12, e: "snap" },
        { t: 2.2, v: -12 },
        { t: 2.7, v: 0, e: "snap" },
      ],
      y: [
        { t: 0, v: 0 },
        { t: 0.55, v: -1.5, e: "io" },
        { t: 2.7, v: 0, e: "io" },
      ],
    },
    faces: [
      { t: 2.9, face: "happy" },
      { t: 4.2, face: "neutral" },
    ],
    blinks: [1.8],
  },
  {
    name: "doze",
    duration: 6,
    weight: 0.6,
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
        { t: 0.5, v: -16, e: "snap" },
        { t: 2.2, v: -16 },
        { t: 2.7, v: 14, e: "snap" },
        { t: 4.1, v: 14 },
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
  {
    // Working it out: a little hop and a tumble backwards, still squinting.
    name: "tumble",
    duration: 3.4,
    weight: 1,
    showy: true,
    tracks: {
      ...jumpSquash([0.35, 0.55, 1, 1.4, 1.75]),
      pitch: [
        { t: 0, v: -8 },
        { t: 0.35, v: 2, e: "io" },
        { t: 1.4, v: -360, e: "whirl" },
        { t: 1.85, v: -368, e: "io" },
      ],
      y: [
        { t: 0, v: 0 },
        { t: 0.35, v: 1, e: "io" },
        { t: 0.9, v: -12, e: "io" },
        { t: 1.4, v: 0, e: "fall" },
      ],
      ly: [{ t: 0, v: -3 }],
    },
    blinks: [2.6],
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
        { t: 1.25, v: 10, e: "io" },
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
        { t: 0.65, v: -14, e: "snap" },
        { t: 1.95, v: 14, e: "snap" },
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
  {
    // A happy spin while she talks (0.84 s for the full turn).
    name: "happy-spin",
    duration: 2.6,
    weight: 1,
    showy: true,
    tracks: {
      yaw: [
        { t: 0, v: 0 },
        { t: 0.3, v: -15, e: "io" },
        { t: 1.35, v: 360, e: "whirl" },
      ],
      y: [
        { t: 0, v: 0 },
        { t: 0.8, v: -5, e: "io" },
        { t: 1.35, v: 0, e: "pop" },
        { t: 1.85, v: -2, e: "io" },
        { t: 2.6, v: 0, e: "io" },
      ],
    },
    faces: [
      { t: 0.1, face: "happy" },
      { t: 2.3, face: "neutral" },
    ],
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

/* ---- Reactions to a tap: added on top of whatever plays. p runs 0 → 1 (real time). ---- */

export type Poke = "spin" | "hop" | "flip" | "wiggle" | "nod";
export const POKE_SECONDS: Record<Poke, number> = {
  spin: 0.85,
  hop: 0.6,
  flip: 1.05,
  wiggle: 0.7,
  nod: 0.55,
};
/** Taps go through these in turn: the spin first, as it is the one people tap for. */
export const TAP_ORDER: Poke[] = ["spin", "hop", "flip", "wiggle", "spin", "nod"];

/** sin² bump from a to b (0 outside): a soft rise and fall. */
export function bump(p: number, a: number, b: number) {
  if (p <= a || p >= b) return 0;
  const s = Math.sin((Math.PI * (p - a)) / (b - a));
  return s * s;
}

/** What a reaction adds at progress p: moves and turns added, squash multiplied. */
export function pokeDelta(kind: Poke, p: number): Partial<Pose> {
  const crouch = bump(p, 0, 0.22);
  const land = bump(p, 0.74, 1);
  switch (kind) {
    case "spin":
      return {
        yaw: 360 * EASES.wind(p),
        y: -6 * bump(p, 0.08, 0.85),
        sx: 1 + 0.06 * crouch - 0.05 * bump(p, 0.2, 0.7) + 0.08 * land,
        sy: 1 - 0.08 * crouch + 0.06 * bump(p, 0.2, 0.7) - 0.1 * land,
      };
    case "hop": {
      const air = p > 0.2 && p < 0.75 ? Math.sin((Math.PI * (p - 0.2)) / 0.55) : 0;
      return {
        y: -14 * air,
        sx: 1 + 0.12 * crouch - 0.06 * air + 0.1 * land,
        sy: 1 - 0.12 * crouch + 0.08 * air - 0.12 * land,
        roll: -6 * Math.sin(Math.PI * Math.min(1, p / 0.75)) * (p < 0.75 ? 1 : 0),
      };
    }
    case "flip": {
      const air = p > 0.15 && p < 0.8 ? Math.sin((Math.PI * (p - 0.15)) / 0.65) : 0;
      return {
        pitch: 360 * EASES.whirl(Math.min(1, Math.max(0, (p - 0.1) / 0.76))),
        y: -16 * air,
        sx: 1 + 0.1 * crouch - 0.05 * air + 0.1 * land,
        sy: 1 - 0.1 * crouch + 0.07 * air - 0.12 * land,
      };
    }
    case "wiggle":
      return { roll: 12 * Math.sin(p * Math.PI * 4) * (1 - p) };
    case "nod":
      return { pitch: 16 * bump(p, 0, 0.45) + 9 * bump(p, 0.45, 0.9), y: 1.5 * bump(p, 0, 0.9) };
  }
}
