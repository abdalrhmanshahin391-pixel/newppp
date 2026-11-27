// Hand-drawn geometry for Uzyra's board: straight strokes bow a little, gentle curves (a wave, an
// arc) are drawn smooth instead of as a chain of corners, loops overshoot where they close, and a
// circled word sits in a hand-drawn rounded box. Deterministic: the same step always draws the
// same way (the seed is the stroke's place on the board).
export type Pt = readonly [number, number];

const r = (n: number) => Math.round(n * 10) / 10;

/** A repeatable 0–1 number for a seed. */
export function wobble(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** One straight stroke from the current point to `b`, bowed sideways a little. */
function bow(a: Pt, b: Pt, seed: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const off = (wobble(seed) - 0.5) * Math.min(6, len * 0.035);
  const mx = (a[0] + b[0]) / 2 - (dy / len) * off;
  const my = (a[1] + b[1]) / 2 + (dx / len) * off;
  return `Q${r(mx)} ${r(my)} ${r(b[0])} ${r(b[1])}`;
}

/** Straight strokes through the points, each one bowed a little. */
export function sketchPolyline(points: readonly Pt[], seed: number) {
  if (!points.length) return "";
  let d = `M${r(points[0][0])} ${r(points[0][1])}`;
  for (let i = 1; i < points.length; i += 1) d += " " + bow(points[i - 1], points[i], seed + i);
  return d;
}

/** A smooth curve through every point (Catmull-Rom, as cubic Béziers). */
export function smoothPath(points: readonly Pt[]) {
  if (points.length < 3) return sketchPolyline(points, 1);
  let d = `M${r(points[0][0])} ${r(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}

/** True when the points never turn sharply (a wave or an arc), so they read better smooth. */
export function isGentle(points: readonly Pt[]) {
  if (points.length < 4) return false;
  for (let i = 1; i < points.length - 1; i += 1) {
    const ax = points[i][0] - points[i - 1][0];
    const ay = points[i][1] - points[i - 1][1];
    const bx = points[i + 1][0] - points[i][0];
    const by = points[i + 1][1] - points[i][1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (!la || !lb) continue;
    // A turn of more than ~75 degrees is a corner the drawing meant.
    if ((ax * bx + ay * by) / (la * lb) < 0.26) return false;
  }
  return true;
}

/** An ellipse in the box from (x1, y1) to (x2, y2), drawn in one loop that overshoots its start. */
export function sketchEllipse(x1: number, y1: number, x2: number, y2: number, seed: number) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2 || 1;
  const ry = Math.abs(y2 - y1) / 2 || 1;
  const start = -2.3 + wobble(seed) * 0.6;
  const sweep = Math.PI * 2 + 0.42;
  const points: Pt[] = [];
  for (let i = 0; i <= 36; i += 1) {
    const t = start + (sweep * i) / 36;
    const grow = 1 + 0.03 * Math.sin(2 * t + seed) + (i / 36) * 0.04;
    points.push([cx + Math.cos(t) * rx * grow, cy + Math.sin(t) * ry * grow]);
  }
  return smoothPath(points);
}

/** A hand-drawn rounded box around a word `width` wide (the word's box is 0..width, -5..37). */
export function sketchBox(width: number, seed: number) {
  const left = -11;
  const right = width + 11;
  const top = -7;
  const bottom = 39;
  const k = 11;
  const o = (wobble(seed) - 0.5) * 3;
  return [
    `M${r(left + k + 3)} ${r(top + o)}`,
    `L${r(right - k)} ${r(top)}`,
    `Q${r(right)} ${r(top)} ${r(right)} ${r(top + k)}`,
    `L${r(right + o * 0.4)} ${r(bottom - k)}`,
    `Q${r(right)} ${r(bottom)} ${r(right - k)} ${r(bottom)}`,
    `L${r(left + k)} ${r(bottom + o * 0.3)}`,
    `Q${r(left)} ${r(bottom)} ${r(left)} ${r(bottom - k)}`,
    `L${r(left - o * 0.3)} ${r(top + k)}`,
    `Q${r(left)} ${r(top)} ${r(left + k)} ${r(top + 1)}`,
    `L${r(left + k + 16)} ${r(top - 0.5)}`,
  ].join(" ");
}
