/**
 * Uzyra's eyes: their shapes for each feeling, and how they change from one to another.
 *
 * Each eye is a rounded stroke along a short, possibly bent line (its spine) on the front face:
 * standing up it is the logo's tall rounded eye, lying down and bent it is a happy «^». A lid
 * value squashes it from above and below (1 open, 0 shut). Shapes of the same kind blend
 * directly; a change between kinds (pill ↔ arc) happens behind a quick blink, so the eyes never
 * pass through an odd in-between shape.
 */

import { cubicBezier, lerp, smooth, type Vec2 } from "./cube-math.ts";

export type Eye = {
  /** Centre on the face, units (the block is 1 wide), y up. */
  x: number;
  y: number;
  /** Half the spine's length and the stroke's half thickness. */
  len: number;
  thick: number;
  /** Spine direction in radians: 0 stands up, π/2 lies right. */
  ang: number;
  /** How far the spine's middle bows to its left side (up, for a lying spine). */
  bend: number;
  /** 1 open, 0 shut. */
  lid: number;
};
export type Eyes = [Eye, Eye];

export type FaceName =
  "neutral" | "attentive" | "surprised" | "happy" | "sleepy" | "focused" | "curious" | "sad";

type Family = "pill" | "arc";

// The logo's eyes: centres at 37.4 and 60.1 of the 100 box, 11.7 wide and 20 tall.
const LEFT = -0.1504;
const RIGHT = 0.1206;
const pill = (x: number, over: Partial<Eye> = {}): Eye => ({
  x,
  y: 0,
  len: 0.0494,
  thick: 0.0698,
  ang: 0,
  bend: 0,
  lid: 1,
  ...over,
});
const arc = (x: number, over: Partial<Eye> = {}): Eye => ({
  x,
  y: 0.024,
  len: 0.07,
  thick: 0.031,
  ang: Math.PI / 2,
  bend: 0.05,
  lid: 1,
  ...over,
});

export const FACES: Record<FaceName, { family: Family; eyes: Eyes }> = {
  neutral: { family: "pill", eyes: [pill(LEFT), pill(RIGHT)] },
  attentive: {
    family: "pill",
    eyes: [
      pill(LEFT, { len: 0.054, thick: 0.077, y: 0.006 }),
      pill(RIGHT, { len: 0.054, thick: 0.077, y: 0.006 }),
    ],
  },
  surprised: {
    family: "pill",
    eyes: [
      pill(LEFT, { len: 0.03, thick: 0.09, y: 0.014 }),
      pill(RIGHT, { len: 0.03, thick: 0.09, y: 0.014 }),
    ],
  },
  happy: { family: "arc", eyes: [arc(LEFT), arc(RIGHT)] },
  sleepy: {
    family: "pill",
    eyes: [pill(LEFT, { lid: 0.26, y: -0.024 }), pill(RIGHT, { lid: 0.26, y: -0.024 })],
  },
  focused: {
    family: "pill",
    eyes: [
      pill(LEFT, { lid: 0.62, ang: -0.09, thick: 0.072 }),
      pill(RIGHT, { lid: 0.62, ang: 0.09, thick: 0.072 }),
    ],
  },
  curious: {
    family: "pill",
    eyes: [
      pill(LEFT, { lid: 0.78, len: 0.042, thick: 0.066, y: -0.004 }),
      pill(RIGHT, { len: 0.04, thick: 0.086, y: 0.016 }),
    ],
  },
  sad: {
    family: "pill",
    eyes: [
      pill(LEFT, { lid: 0.72, ang: 0.22, thick: 0.064, y: -0.024 }),
      pill(RIGHT, { lid: 0.72, ang: -0.22, thick: 0.064, y: -0.024 }),
    ],
  },
};

const copy = (eyes: Eyes): Eyes => [{ ...eyes[0] }, { ...eyes[1] }];

function mixEye(a: Eye, b: Eye, t: number): Eye {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    len: lerp(a.len, b.len, t),
    thick: lerp(a.thick, b.thick, t),
    ang: lerp(a.ang, b.ang, t),
    bend: lerp(a.bend, b.bend, t),
    lid: lerp(a.lid, b.lid, t),
  };
}

const MORPH = cubicBezier(0.3, 0, 0.15, 1);
const MORPH_SECONDS = 0.3;
/** A blink: shut quickly, a short dark beat, open a little slower (as eyes do). */
const BLINK = { close: 0.085, hold: 0.03, open: 0.13 };
/** A change of kind behind the lids: shut, swap, open with a small pop. */
const SWAP = { close: 0.08, hold: 0.02, open: 0.18 };

/** Opens past fully open by a few percent, then settles. */
function pop(t: number) {
  const x = Math.min(1, Math.max(0, t));
  if (x < 0.65) {
    const k = x / 0.65;
    return 1.07 * (1 - (1 - k) * (1 - k));
  }
  return 1.07 + (1 - 1.07) * smooth((x - 0.65) / 0.35);
}

/** Plays the eyes: holds a feeling, blends to the next, blinks. */
export class FacePlayer {
  name: FaceName = "neutral";
  private shape: Eyes = copy(FACES.neutral.eyes);
  private morph: { from: Eyes; to: Eyes; t: number } | null = null;
  private swap: { to: FaceName; t: number; swapped: boolean } | null = null;
  private blinkT = -1;
  /** Seconds since the lids last opened again. */
  private sinceShut = 10;

  constructor(start: FaceName = "neutral") {
    this.name = start;
    this.shape = copy(FACES[start].eyes);
  }

  /** The shapes being drawn now, before lids. */
  private current(): Eyes {
    if (!this.morph) return this.shape;
    const k = MORPH(Math.min(1, this.morph.t / MORPH_SECONDS));
    return [
      mixEye(this.morph.from[0], this.morph.to[0], k),
      mixEye(this.morph.from[1], this.morph.to[1], k),
    ];
  }

  set(name: FaceName) {
    const target = this.swap?.to ?? this.name;
    if (name === target) return;
    if (FACES[name].family === FACES[this.name].family && !this.swap) {
      this.morph = { from: copy(this.current()), to: copy(FACES[name].eyes), t: 0 };
      this.name = name;
      return;
    }
    // A different kind of eye: change it while the lids are shut.
    if (this.swap && !this.swap.swapped) this.swap.to = name;
    else this.swap = { to: name, t: 0, swapped: false };
  }

  blink() {
    // Not while the lids are already moving, nor just after they were shut: that would read as
    // the eyes being closed half the time.
    if (this.blinkT < 0 && !this.swap && this.sinceShut > 0.9) this.blinkT = 0;
  }

  get busy() {
    return this.morph !== null || this.swap !== null || this.blinkT >= 0;
  }

  step(dt: number) {
    this.sinceShut += dt;
    if (this.morph) {
      this.morph.t += dt;
      if (this.morph.t >= MORPH_SECONDS) {
        this.shape = copy(this.morph.to);
        this.morph = null;
      }
    }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > BLINK.close + BLINK.hold + BLINK.open) {
        this.blinkT = -1;
        this.sinceShut = 0;
      }
    }
    if (this.swap) {
      this.swap.t += dt;
      if (!this.swap.swapped && this.swap.t >= SWAP.close) {
        this.swap.swapped = true;
        this.morph = null;
        this.name = this.swap.to;
        this.shape = copy(FACES[this.swap.to].eyes);
      }
      if (this.swap.t >= SWAP.close + SWAP.hold + SWAP.open) {
        this.swap = null;
        this.sinceShut = 0;
      }
    }
  }

  /** How open the lids are now, from blinks and swaps (1 open, about 0 shut, a bit over 1 on a pop). */
  private openness() {
    let open = 1;
    if (this.blinkT >= 0) {
      const t = this.blinkT;
      const shut =
        t < BLINK.close
          ? smooth(t / BLINK.close)
          : t < BLINK.close + BLINK.hold
            ? 1
            : 1 - smooth((t - BLINK.close - BLINK.hold) / BLINK.open);
      open = Math.min(open, 1 - 0.94 * shut);
    }
    if (this.swap) {
      const t = this.swap.t;
      if (t < SWAP.close) open = Math.min(open, 1 - 0.94 * smooth(t / SWAP.close));
      else if (t < SWAP.close + SWAP.hold) open = Math.min(open, 0.06);
      else open = Math.min(open, 0.06 + 0.94 * pop((t - SWAP.close - SWAP.hold) / SWAP.open));
    }
    return open;
  }

  /** The eyes to draw: shapes with their lids. */
  eyes(): Eyes {
    const open = this.openness();
    const [a, b] = this.current();
    return [
      { ...a, lid: a.lid * open },
      { ...b, lid: b.lid * open },
    ];
  }
}

/**
 * One eye's outline on the face (units, y up), as a closed loop: down one side of the spine,
 * round the far end, back along the other side, round the near end. `n` steps along the spine.
 */
export function eyeOutline(eye: Eye, n = 8): Vec2[] {
  const dx = Math.sin(eye.ang);
  const dy = Math.cos(eye.ang);
  // The spine's left side.
  const px = -dy;
  const py = dx;
  const p0: Vec2 = [eye.x - dx * eye.len, eye.y - dy * eye.len];
  const p2: Vec2 = [eye.x + dx * eye.len, eye.y + dy * eye.len];
  const p1: Vec2 = [eye.x + px * eye.bend * 2, eye.y + py * eye.bend * 2];
  const spine: { p: Vec2; nx: number; ny: number }[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    const x = a * p0[0] + b * p1[0] + c * p2[0];
    const y = a * p0[1] + b * p1[1] + c * p2[1];
    let tx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    let ty = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const length = Math.hypot(tx, ty);
    if (length < 1e-9) {
      tx = dx;
      ty = dy;
    } else {
      tx /= length;
      ty /= length;
    }
    spine.push({ p: [x, y], nx: -ty, ny: tx });
  }
  const out: Vec2[] = [];
  const r = eye.thick;
  for (const s of spine) out.push([s.p[0] + s.nx * r, s.p[1] + s.ny * r]);
  // Round the far end: from the left side, through the tip, to the right side.
  const end = spine[spine.length - 1];
  const endAngle = Math.atan2(end.ny, end.nx);
  for (let i = 1; i < 8; i += 1) {
    const a = endAngle - (Math.PI * i) / 8;
    out.push([end.p[0] + Math.cos(a) * r, end.p[1] + Math.sin(a) * r]);
  }
  for (let i = spine.length - 1; i >= 0; i -= 1) {
    const s = spine[i];
    out.push([s.p[0] - s.nx * r, s.p[1] - s.ny * r]);
  }
  const start = spine[0];
  const startAngle = Math.atan2(-start.ny, -start.nx);
  for (let i = 1; i < 8; i += 1) {
    const a = startAngle - (Math.PI * i) / 8;
    out.push([start.p[0] + Math.cos(a) * r, start.p[1] + Math.sin(a) * r]);
  }
  // The lids squash the eye towards its centre line.
  if (eye.lid !== 1) {
    for (const p of out) p[1] = eye.y + (p[1] - eye.y) * eye.lid;
  }
  return out;
}
