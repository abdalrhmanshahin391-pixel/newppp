/**
 * The intro card's numbers: how it grows with the scroll, how the cursor pill follows, and the
 * film inside it (dots gather into Uzyra's cube, it grows, settles beside the name, the name
 * wipes in, a ring of dots turns behind). Pure, so it is tested without a browser.
 */

/** The card scales up from `from` to 1 while its top travels from the viewport's bottom to `end`. */
export const SCROLL = {
  desktop: { from: 0.5, end: 0.5 },
  /** Phones: a light scale, finished higher on the screen. */
  mobile: { from: 0.92, end: 0.8 },
  mobileMax: 768,
  /** Seconds the card takes to catch up with the scroll. */
  catchUp: 1,
} as const;

export const power2Out = (p: number) => 1 - (1 - p) * (1 - p);
export const power3Out = (p: number) => 1 - (1 - p) ** 3;
export const power3InOut = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** How far the scroll has carried the card (0 below the fold, 1 once its top reaches `end`). */
export function scrollProgress(top: number, viewport: number, mobile: boolean) {
  const { end } = mobile ? SCROLL.mobile : SCROLL.desktop;
  const travel = viewport - viewport * end;
  return travel <= 0 ? 1 : clamp01((viewport - top) / travel);
}

/** The card's scale for a (smoothed) progress. */
export function cardScale(progress: number, mobile: boolean) {
  const { from } = mobile ? SCROLL.mobile : SCROLL.desktop;
  return mix(from, 1, power2Out(clamp01(progress)));
}

/**
 * A value that glides to its target over a fixed time and, when the target moves mid-way, starts
 * again from where it is (so it never jumps). Used for the scroll catch-up and the cursor pill.
 */
export class Glide {
  value: number;
  private from: number;
  private to: number;
  private elapsed: number;
  private readonly duration: number;
  private readonly ease: (p: number) => number;

  constructor(value: number, duration: number, ease: (p: number) => number) {
    this.value = value;
    this.from = value;
    this.to = value;
    this.elapsed = duration;
    this.duration = duration;
    this.ease = ease;
  }

  get target() {
    return this.to;
  }

  get settled() {
    return this.elapsed >= this.duration;
  }

  set(target: number) {
    if (target === this.to) return;
    this.from = this.value;
    this.to = target;
    this.elapsed = 0;
  }

  jump(value: number) {
    this.value = this.from = this.to = value;
    this.elapsed = this.duration;
  }

  step(dt: number) {
    if (this.settled) return this.value;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    this.value = mix(this.from, this.to, this.ease(this.elapsed / this.duration));
    return this.value;
  }
}

/** The film's beats, in seconds. One cycle, then it starts again from the dots. */
export const FILM = {
  /** Dots fly in and form the cube (each starts up to `scatter` late). */
  gather: [0, 0.5] as const,
  scatter: 0.22,
  /** The dotted cube grows in the middle. */
  grow: [0.35, 1.2] as const,
  /** It shrinks and moves to its place beside the name. */
  settle: [1.2, 1.7] as const,
  /** The dots hand over to the live cube. */
  swap: [1.58, 1.82] as const,
  /** The name wipes in, word by word. */
  first: [1.8, 2.35] as const,
  second: [2.15, 2.75] as const,
  /** The ring of dots behind. */
  ring: [0.9, 2.4] as const,
  /** Everything but the ring fades before the next cycle. */
  out: [11.3, 11.9] as const,
  cycle: 12,
  /** The still frame for reduced motion. */
  still: 3.2,
} as const;

/** Big cube size as a share of the card's height, at the start and at the peak. */
export const MARK = { start: 0.3, peak: 0.46 } as const;

export type FilmState = {
  /** Time in the cycle. */
  t: number;
  /** 0 = big in the middle, 1 = in its place beside the name. */
  settle: number;
  /** Size of the big cube as a share of the card's height. */
  size: number;
  /** Opacity of the dotted cube and of the live one. */
  dots: number;
  cube: number;
  /** Soft light behind the big cube. */
  glow: number;
  /** How much of each word is shown (left to right). */
  first: number;
  second: number;
  ring: number;
};

export function filmAt(time: number): FilmState {
  const t = ((time % FILM.cycle) + FILM.cycle) % FILM.cycle;
  const out = 1 - span(t, FILM.out[0], FILM.out[1]);
  const grow = power3InOut(span(t, FILM.grow[0], FILM.grow[1]));
  const swap = span(t, FILM.swap[0], FILM.swap[1]);
  const glowUp = span(t, 0.15, 0.9);
  const glowDown = span(t, 1.15, 1.6);
  return {
    t,
    settle: power3InOut(span(t, FILM.settle[0], FILM.settle[1])),
    size: mix(MARK.start, MARK.peak, grow),
    dots: 1 - swap,
    cube: swap * out,
    glow: glowUp * (1 - glowDown),
    first: power2Out(span(t, FILM.first[0], FILM.first[1])) * out,
    second: power2Out(span(t, FILM.second[0], FILM.second[1])) * out,
    ring: span(t, FILM.ring[0], FILM.ring[1]),
  };
}

/** How far one dot of the cube has flown in (each has its own small delay). */
export function gathered(t: number, delay: number) {
  const [a, b] = FILM.gather;
  return power3Out(span(t, a + delay, b - FILM.scatter + delay));
}

/** A small, repeatable random sequence. */
export function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The dots that draw the cube: a fine grid over the 0–100 box, kept where `inside` says the body
 * is (and the eyes are not). Each dot also gets where it flies in from and its delay.
 */
export function cubeDots(inside: (x: number, y: number) => boolean, step = 1.7, seed = 11) {
  const rnd = random(seed);
  const dots: { x: number; y: number; fx: number; fy: number; delay: number; a: number }[] = [];
  for (let y = step / 2; y < 100; y += step) {
    for (let x = step / 2; x < 100; x += step) {
      if (!inside(x, y)) continue;
      const angle = rnd() * Math.PI * 2;
      const reach = 70 + rnd() * 150;
      dots.push({
        x,
        y,
        fx: 50 + Math.cos(angle) * reach * 1.6,
        fy: 50 + Math.sin(angle) * reach,
        delay: rnd() * FILM.scatter,
        a: 0.55 + rnd() * 0.45,
      });
    }
  }
  return dots;
}

/** The ring behind: dots on a slim, tilted torus (unit radius), each with a little shimmer phase. */
export function ringDots(around = 180, across = 12, seed = 5) {
  const rnd = random(seed);
  const dots: { u: number; v: number; phase: number; a: number }[] = [];
  for (let i = 0; i < around; i += 1) {
    for (let j = 0; j < across; j += 1) {
      dots.push({
        u: ((i + rnd() * 0.6) / around) * Math.PI * 2,
        v: ((j + rnd() * 0.6) / across) * Math.PI * 2,
        phase: rnd() * Math.PI * 2,
        a: 0.35 + rnd() * 0.65,
      });
    }
  }
  return dots;
}

export const RING = {
  /** Torus size as shares of the card's height. */
  radius: 0.66,
  tube: 0.16,
  /** Tilt (radians) and turn speed (radians per second). */
  tilt: 1.15,
  roll: -0.42,
  speed: 0.11,
  camera: 3.2,
} as const;

/** Where a ring dot lands on screen (in card-height units around the centre) and how near it is. */
export function ringPoint(u: number, v: number, time: number) {
  const a = u + time * RING.speed;
  const r = RING.radius + RING.tube * Math.cos(v);
  let x = r * Math.cos(a);
  let y = r * Math.sin(a);
  let z = RING.tube * Math.sin(v);
  // Tip it back, then roll it a little, so it reads as a slanted loop.
  const ct = Math.cos(RING.tilt);
  const st = Math.sin(RING.tilt);
  [y, z] = [y * ct - z * st, y * st + z * ct];
  const cr = Math.cos(RING.roll);
  const sr = Math.sin(RING.roll);
  [x, y] = [x * cr - y * sr, x * sr + y * cr];
  const k = RING.camera / (RING.camera - z);
  return { x: x * k * 1.35, y: y * k, near: clamp01((z / (RING.radius + RING.tube) + 1) / 2) };
}
