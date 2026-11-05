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
