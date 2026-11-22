/**
 * The maths under Uzyra's cube: a rounded block in 3D, seen from the front.
 *
 * The block is a box with every edge rounded, which is exactly the space covered by eight balls
 * placed inside its corners. Seen from any angle, its outline is the outline around the eight
 * balls' discs, so drawing it turned is cheap: turn the eight centres, project them, and take
 * the outline around their discs. The eyes are drawn on the front face (a flat plane), so they
 * slide and narrow with it as it turns and disappear when it faces away.
 *
 * Pure numbers, no DOM: the engine and the tests use it.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
/** A 3 × 3 rotation, row by row. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

const DEG = Math.PI / 180;

/**
 * Units: the block is 1 wide. x right, y up, z towards the viewer. In the 100 × 100 logo box the
 * block spans x 8–92 and y 10–90, so 1 unit is 84 logo units.
 */
export const UNIT = 84;

/** Half sizes of the block. */
export const HALF = { w: 0.5, h: 80 / 84 / 2, d: 0.4 };

/**
 * The four front corners (and the four behind them) with the logo's own small differences:
 * each corner a little rounder or tighter, the top edge a touch lower on the left. Radii and
 * nudges are in units.
 */
export const CORNERS: { sx: number; sy: number; r: number; dx: number; dy: number }[] = [
  { sx: -1, sy: 1, r: 17 / 84, dx: 0, dy: -1.6 / 84 }, // top left
  { sx: 1, sy: 1, r: 19 / 84, dx: 0, dy: 0 }, // top right
  { sx: 1, sy: -1, r: 16 / 84, dx: 0.6 / 84, dy: 0 }, // bottom right
  { sx: -1, sy: -1, r: 20 / 84, dx: -0.4 / 84, dy: -0.4 / 84 }, // bottom left
];

/** Camera distance in units: a little perspective, so the near side reads larger. */
export const CAMERA = 9;

/** Rotation from angles in degrees: first about x (+ tips the top towards the viewer), then y
 *  (+ turns the face to the viewer's right), then z (+ rolls anticlockwise). */
export function rotation(rx: number, ry: number, rz: number): Mat3 {
  const cx = Math.cos(rx * DEG);
  const sx = Math.sin(rx * DEG);
  const cy = Math.cos(ry * DEG);
  const sy = Math.sin(ry * DEG);
  const cz = Math.cos(rz * DEG);
  const sz = Math.sin(rz * DEG);
  return [
    cz * cy,
    cz * sy * sx - sz * cx,
    cz * sy * cx + sz * sx,
    sz * cy,
    sz * sy * sx + cz * cx,
    sz * sy * cx - cz * sx,
    -sy,
    cy * sx,
    cy * cx,
  ];
}

export function apply(m: Mat3, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
  ];
}

/** Depth of the front corner balls' centres (their radius is about 0.2): the depth drawn at
 *  scale 1, so the outline at rest matches the logo. */
const NEAR = HALF.d - 0.2;

/** Perspective scale of a point at depth z. */
export function depthScale(z: number) {
  return (CAMERA - NEAR) / (CAMERA - z);
}

/** Andrew's monotone chain: the convex outline of the points, anticlockwise, no repeats. */
export function convexHull(points: Vec2[]): Vec2[] {
  if (points.length < 3) return points.slice();
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Unit circle samples, cached per count. */
const circles = new Map<number, Vec2[]>();
function circle(count: number): Vec2[] {
  let samples = circles.get(count);
  if (!samples) {
    samples = Array.from({ length: count }, (_, i): Vec2 => {
      const a = (2 * Math.PI * i) / count;
      return [Math.cos(a), Math.sin(a)];
    });
    circles.set(count, samples);
  }
  return samples;
}

/**
 * The block's outline turned by `m`, in units around its centre (y up), anticlockwise.
 * `samples` points per corner disc: more for large drawings, fewer for small ones.
 */
export function silhouette(m: Mat3, samples = 40): Vec2[] {
  const ring = circle(samples);
  const points: Vec2[] = [];
  for (const corner of CORNERS) {
    for (const sz of [1, -1]) {
      const centre = apply(m, [
        corner.sx * (HALF.w - corner.r) + corner.dx,
        corner.sy * (HALF.h - corner.r) + corner.dy,
        sz * (HALF.d - corner.r),
      ]);
      const k = depthScale(centre[2]);
      const radius = corner.r * k;
      const cx = centre[0] * k;
      const cy = centre[1] * k;
      for (const [ux, uy] of ring) points.push([cx + ux * radius, cy + uy * radius]);
    }
  }
  return convexHull(points);
}

/** A point on the front face (face coordinates, units) turned by `m` and projected. */
export function onFace(m: Mat3, u: number, v: number): Vec2 {
  const p = apply(m, [u, v, HALF.d]);
  const k = depthScale(p[2]);
  return [p[0] * k, p[1] * k];
}

/** How squarely the front face looks at the viewer: 1 straight on, 0 edge on, below 0 away. */
export function facing(m: Mat3) {
  return m[8];
}

// ---- Easing and springs ----

export type Ease = (t: number) => number;

/** CSS-style cubic Bézier timing (x1, y1, x2, y2); y may overshoot for a pop. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const bx = (s: number) => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
  const by = (s: number) => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
  const dx = (s: number) =>
    3 * (1 - s) * (1 - s) * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2);
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i += 1) {
      const err = bx(s) - t;
      if (Math.abs(err) < 1e-6) return by(s);
      const slope = dx(s);
      if (Math.abs(slope) < 1e-6) break;
      s = Math.min(1, Math.max(0, s - err / slope));
    }
    // Newton stalled on a flat stretch: halve the interval instead.
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < 30; i += 1) {
      const x = bx(s);
      if (Math.abs(x - t) < 1e-6) break;
      if (x < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return by(s);
  };
}

export const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The same angle (degrees) moved by whole turns to sit nearest `near`. */
export function nearestAngle(angle: number, near: number) {
  return angle + 360 * Math.round((near - angle) / 360);
}

/**
 * A damped spring towards `target`: `omega` sets how fast (radians per second), `zeta` how much
 * it overshoots (1 none, lower more). Small fixed sub-steps keep it stable on slow frames.
 */
export class Spring {
  x: number;
  v = 0;
  target: number;
  omega: number;
  zeta: number;
  constructor(initial: number, omega: number, zeta: number) {
    this.x = initial;
    this.target = initial;
    this.omega = omega;
    this.zeta = zeta;
  }
  step(dt: number) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      this.v +=
        (-2 * this.zeta * this.omega * this.v - this.omega * this.omega * (this.x - this.target)) *
        h;
      this.x += this.v * h;
    }
    if (!Number.isFinite(this.x) || !Number.isFinite(this.v)) {
      this.x = this.target;
      this.v = 0;
    }
    return this.x;
  }
  kick(velocity: number) {
    this.v += velocity;
  }
  get settled() {
    return Math.abs(this.x - this.target) < 1e-3 && Math.abs(this.v) < 1e-3;
  }
}

/** mulberry32: a small seeded random source, so each cube keeps its own rhythm. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
