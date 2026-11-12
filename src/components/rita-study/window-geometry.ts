// Geometry of the study page's floating window: Apple's "continuous" (squircle) corners as an SVG
// path, and the rules for moving and resizing inside the work area. Pure, tested with node.

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };
export type Corner = "tl" | "tr" | "bl" | "br";

export const MIN_SIZE: Size = { w: 300, h: 220 };
/** Space kept between the window and the edges of the work area. */
export const EDGE = 8;

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * A rounded rectangle with continuous corners, the shape Apple uses for windows and app icons: the
 * curve starts further from the corner and eases into a short circular arc, instead of a plain arc
 * meeting a straight edge. `smoothing` 0 is an ordinary rounded corner; 0.6 is Apple's look. This is
 * the published Figma corner-smoothing construction (two cubic curves around a circular arc).
 */
export function squirclePath(w: number, h: number, radius: number, smoothing = 0.6): string {
  const budget = Math.min(w, h) / 2;
  const r = Math.max(0, Math.min(radius, budget));
  if (r === 0) return `M0 0 H${w} V${h} H0 Z`;
  let s = smoothing;
  let p = (1 + s) * r;
  // Not enough room for the full smoothing: shorten it so the corners never overlap.
  s = Math.max(0, Math.min(s, budget / r - 1));
  p = Math.min(p, budget);
  const arcMeasure = 90 * (1 - s);
  const arc = Math.sin(rad(arcMeasure / 2)) * r * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p3p4 = r * Math.tan(rad(alpha / 2));
  const beta = 45 * s;
  const c = p3p4 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  const f = (n: number) => Number(n.toFixed(3));
  const [A, B, C, D, P, ARC, R] = [a, b, c, d, p, arc, r].map(f);
  const ab = f(a + b);
  const abc = f(a + b + c);
  const bc = f(b + c);
  return [
    `M${f(w - p)} 0`,
    `c${A} 0 ${ab} 0 ${abc} ${D}`,
    `a${R} ${R} 0 0 1 ${ARC} ${ARC}`,
    `c${D} ${C} ${D} ${bc} ${D} ${abc}`,
    `L${f(w)} ${f(h - p)}`,
    `c0 ${A} 0 ${ab} ${-D} ${abc}`,
    `a${R} ${R} 0 0 1 ${-ARC} ${ARC}`,
    `c${-C} ${D} ${-bc} ${D} ${-abc} ${D}`,
    `L${P} ${f(h)}`,
    `c${-A} 0 ${-ab} 0 ${-abc} ${-D}`,
    `a${R} ${R} 0 0 1 ${-ARC} ${-ARC}`,
    `c${-D} ${-C} ${-D} ${-bc} ${-D} ${-abc}`,
    `L0 ${P}`,
    `c0 ${-A} 0 ${-ab} ${D} ${-abc}`,
    `a${R} ${R} 0 0 1 ${ARC} ${-ARC}`,
    `c${C} ${-D} ${bc} ${-D} ${abc} ${-D}`,
    "Z",
  ].join(" ");
}

/** Keeps a window inside the area: never smaller than the minimum, never bigger than the area. */
export function clampRect(rect: Rect, area: Size, min: Size = MIN_SIZE): Rect {
  const maxW = Math.max(120, area.w - EDGE * 2);
  const maxH = Math.max(120, area.h - EDGE * 2);
  const w = Math.min(Math.max(rect.w, Math.min(min.w, maxW)), maxW);
  const h = Math.min(Math.max(rect.h, Math.min(min.h, maxH)), maxH);
  const x = Math.min(Math.max(rect.x, EDGE), area.w - EDGE - w);
  const y = Math.min(Math.max(rect.y, EDGE), area.h - EDGE - h);
  return { x, y, w, h };
}

/** Moves a window by a finger's travel, kept inside the area. */
export function moveRect(start: Rect, dx: number, dy: number, area: Size): Rect {
  return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, area);
}

/** Resizes from one corner: the opposite corner stays where it is. */
export function resizeRect(
  start: Rect,
  corner: Corner,
  dx: number,
  dy: number,
  area: Size,
  min: Size = MIN_SIZE,
): Rect {
  const left = corner === "tl" || corner === "bl";
  const top = corner === "tl" || corner === "tr";
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  let x = start.x;
  let y = start.y;
  let w = start.w + (left ? -dx : dx);
  let h = start.h + (top ? -dy : dy);
  w = Math.max(min.w, Math.min(w, (left ? right : area.w - start.x) - EDGE));
  h = Math.max(min.h, Math.min(h, (top ? bottom : area.h - start.y) - EDGE));
  if (left) x = right - w;
  if (top) y = bottom - h;
  return clampRect({ x, y, w, h }, area, min);
}

/** Where a window first opens: centred, about two thirds of the area, kept to a pleasant size. */
export function defaultRect(area: Size): Rect {
  const w = Math.min(560, Math.max(MIN_SIZE.w, area.w * 0.62));
  const h = Math.min(420, Math.max(MIN_SIZE.h, area.h * 0.55));
  return clampRect({ x: (area.w - w) / 2, y: (area.h - h) / 2.4, w, h }, area);
}

/** The whole area less the margin (the green button). */
export function maximisedRect(area: Size): Rect {
  return {
    x: EDGE,
    y: EDGE,
    w: Math.max(120, area.w - EDGE * 2),
    h: Math.max(120, area.h - EDGE * 2),
  };
}

// ---- sliding the window off the right edge and back (as iPad's Slide Over) --------------------

/** Room kept beside the window when it comes back against the right edge. */
export const DOCK_GAP = 8;
/** Extra travel past the edge, so the window's shadow leaves the screen too. */
export const OFF_MARGIN = 48;
/** A window goes to the side when this share of it would end up past the edge. */
export const TUCK_SHARE = 0.4;
/** Faster than this (px/s) back the other way, the release keeps the window where it was. */
export const TURN_BACK_SPEED = 150;

/**
 * Where a moving finger's flick comes to rest: Apple's scroll deceleration (the function in
 * "Designing Fluid Interfaces"). 1000 px/s travels about 500 px more.
 */
export function project(velocity: number, rate = 0.998): number {
  return ((velocity / 1000) * rate) / (1 - rate);
}

/** Resistance past a limit: the further past, the less the window follows. */
export function rubberband(over: number, dimension: number, constant = 0.55): number {
  if (over <= 0 || dimension <= 0) return 0;
  return (over * dimension * constant) / (dimension + constant * over);
}

/** The x of a window that touches the right edge (less the margin). */
export function rightLimit(rect: Rect, area: Size): number {
  return area.w - EDGE - rect.w;
}

/** How far a window dragged to `x` is pushed past the right edge (0 while it is inside). */
export function overflowRight(x: number, rect: Rect, area: Size): number {
  return Math.max(0, x - rightLimit(rect, area));
}

/**
 * Whether a released window goes off the right edge: where the flick would carry it, at least
 * 40% of it past the edge. A release moving back to the left never sends it away.
 */
export function shouldTuck(overflow: number, velocityX: number, width: number): boolean {
  if (velocityX < -TURN_BACK_SPEED) return false;
  return overflow + Math.max(0, project(velocityX)) > width * TUCK_SHARE;
}

/** How far right a window at `rect` moves to be fully out of the area, shadow and all. */
export function tuckedOffset(rect: Rect, area: Size): number {
  return Math.max(0, area.w - rect.x) + OFF_MARGIN;
}

/** Where a window comes back from the side: against the right edge, at the same height. */
export function dockedRect(rect: Rect, area: Size): Rect {
  return clampRect({ ...rect, x: area.w - EDGE - DOCK_GAP - rect.w }, area);
}

/**
 * Whether a window pulled in from the side opens: `shown` px of it are in, and where the flick
 * would carry it shows at least 40%. A release moving back to the right puts it away again.
 */
export function shouldOpen(shown: number, velocityX: number, width: number): boolean {
  if (velocityX > TURN_BACK_SPEED) return false;
  return shown + Math.max(0, project(-velocityX)) > width * TUCK_SHARE;
}

/** The middle of the tab on the right edge: level with the window, kept inside the area. */
export function tabCenter(rect: Rect, area: Size, half = 44): number {
  const middle = rect.y + rect.h / 2;
  return Math.min(Math.max(middle, half + EDGE), Math.max(half + EDGE, area.h - half - EDGE));
}

/** A finger's speed (px/s) from its recent places: the last 100 ms, 0 when too short to tell. */
export function velocityOf(samples: { t: number; x: number }[], window = 100): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const recent = samples.filter((s) => last.t - s.t <= window);
  const first = recent[0];
  const dt = last.t - first.t;
  if (dt < 8) return 0;
  return ((last.x - first.x) / dt) * 1000;
}

/**
 * A spring in Apple's terms: `response` is about how long it takes (seconds), `damping` 1 settles
 * without overshoot and less than 1 overshoots. As stiffness and damping for a mass of 1.
 */
export function springFrom(response: number, damping: number) {
  const omega = (2 * Math.PI) / response;
  return { stiffness: omega * omega, damping: 2 * damping * omega, mass: 1 };
}

export type SpringParams = { stiffness: number; damping: number; mass: number };

/**
 * Moves a spring on by `dt` seconds towards `target` (small fixed steps, so a slow frame does not
 * make it jump). Returns the new place and speed (px/s). Starting with the finger's speed is what
 * makes the window carry on from a flick without a seam.
 */
export function springStep(
  x: number,
  v: number,
  target: number,
  dt: number,
  p: SpringParams,
): [number, number] {
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const a = (-p.stiffness * (x - target) - p.damping * v) / p.mass;
    v += a * h;
    x += v * h;
  }
  return [x, v];
}

/** Close enough and slow enough to stop (half a pixel, a crawl). */
export function springAtRest(x: number, v: number, target: number): boolean {
  return Math.abs(x - target) < 0.5 && Math.abs(v) < 12;
}
