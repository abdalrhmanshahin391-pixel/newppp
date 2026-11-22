/**
 * The dot field behind the home hero: a loose grid of small marks. A soft ring moves over it
 * (following the pointer, or drifting on its own); marks under the ring grow into short dashes
 * that point away from its centre and are pushed outwards, then settle back to faint dots.
 *
 * Pure numbers here, so they can be tested; the drawing is in UltraHero.
 */

/** The ring, in fractions of the hero's shorter side (the light settings of the reference). */
export const RING = {
  radius: 0.36,
  /** The sharp inner edge and the soft outer fall-off of the ring. */
  edge: 0.006,
  tail: 0.107,
  /** How far marks in the ring are pushed out, as a fraction of the grid step. */
  push: 0.62,
};

/** Grid step in CSS pixels: a little closer on phones so the field still reads. */
export function gridStep(width: number) {
  return width < 768 ? 20 : 24;
}

/** mulberry32: a small seeded random source, so the field looks the same on every visit. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The marks for a hero of `width` × `height` CSS pixels: x, y, and a random 0–1 per mark
 * (its shade, length and timing). Rows are offset by half a step so it reads as a field, not a
 * table, and every mark is nudged a little.
 */
export function buildField(width: number, height: number, seed = 11) {
  const step = gridStep(width);
  const rng = seeded(seed);
  const cols = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;
  const out = new Float32Array(cols * rows * 3);
  let n = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = (c + (r % 2) * 0.5) * step + (rng() - 0.5) * step * 0.55;
      const y = r * step + (rng() - 0.5) * step * 0.55;
      out[n++] = x;
      out[n++] = y;
      out[n++] = rng();
    }
  }
  return { points: out, count: n / 3, step };
}

/**
 * Where the ring drifts when nobody is pointing: a slow loop around the middle of the hero,
 * a little below the headline. `t` in seconds; returns fractions of width and height.
 */
export function wander(t: number) {
  return {
    x: 0.5 + 0.22 * Math.sin(t * 0.21) + 0.06 * Math.sin(t * 0.53 + 1.3),
    y: 0.58 + 0.14 * Math.sin(t * 0.17 + 0.8) + 0.04 * Math.cos(t * 0.41),
  };
}

/**
 * How strongly a mark `d` pixels from the ring's centre is lit, 0–1: a sharp rise at the ring's
 * edge and a soft tail outside it. `size` is the hero's shorter side in pixels.
 */
export function ringLight(d: number, size: number, radius = RING.radius) {
  const r = radius * size;
  const edge = Math.max(1, RING.edge * size);
  const tail = Math.max(1, RING.tail * size);
  const x = d - r;
  return x < 0 ? Math.exp(-((x / (edge * 6)) ** 2)) : Math.exp(-((x / tail) ** 2));
}
