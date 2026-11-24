/**
 * Timing tools for Uzyra's motion: CSS-style Bézier easing (the curves the moves use), a damped
 * spring, an easing toward a target by half-life, and a small seeded random source.
 */

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

/** mulberry32: a small seeded random source, so each one keeps its own rhythm. */
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

/** Moves `current` toward `target`, halving the gap every `halfLife` seconds (frame-rate free). */
export function approach(current: number, target: number, halfLife: number, dt: number) {
  if (halfLife <= 0) return target;
  return target + (current - target) * Math.pow(2, -dt / halfLife);
}
