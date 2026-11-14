// The study wheel's geometry. Pure: no DOM. The wheel is always whole, with its slices in the
// same places: when the circle sits near an edge or a corner, the wheel's centre (and the circle
// with it) moves inwards until the whole wheel fits, instead of the wheel losing slices.

/** Space around the wheel: its outer ring of ticks, and the name chip above it. */
export const WHEEL_TICKS = 22;
export const WHEEL_CHIP = 46;
const PAD = 10;
const MAX_R = 142;
const MIN_R = 104;

export type WheelInput = {
  /** The circle's centre, in the area's own pixels. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** Space kept free at the top (the strip that shows the selection). */
  top?: number;
};

export type WheelFit = {
  /** Where the wheel (and the circle) sits while open. */
  cx: number;
  cy: number;
  /** Inner radius (around the circle) and outer radius of the slices. */
  r0: number;
  r1: number;
};

const clamp = (value: number, min: number, max: number) =>
  min > max ? (min + max) / 2 : Math.min(max, Math.max(min, value));

/** The wheel's size and centre: as large as fits (up to 142px), moved inwards when needed. */
export function fitWheel(input: WheelInput): WheelFit {
  const top = input.top ?? 0;
  const room = Math.min(
    (input.width - 2 * PAD) / 2 - WHEEL_TICKS,
    (input.height - top - 2 * PAD - WHEEL_CHIP) / 2 - WHEEL_TICKS,
  );
  const r1 = Math.round(clamp(room, MIN_R, MAX_R));
  const r0 = Math.max(40, Math.round(r1 * 0.35));
  const reach = r1 + WHEEL_TICKS;
  return {
    cx: Math.round(clamp(input.cx, PAD + reach, input.width - PAD - reach)),
    cy: Math.round(clamp(input.cy, top + PAD + WHEEL_CHIP + reach, input.height - PAD - reach)),
    r0,
    r1,
  };
}

/** Degrees, clockwise from straight up, of the middle of slice `index` of `count`. */
export function sliceAngle(index: number, count: number): number {
  return (index * 360) / count;
}

/**
 * The slice a point points at (dx, dy from the wheel's centre, screen pixels: y grows down), or
 * -1 inside the dead zone around the circle. Only the direction counts beyond it, as on a game
 * controller's wheel: a short move up picks the top slice.
 */
export function sliceAt(dx: number, dy: number, count: number, dead: number): number {
  if (count <= 0 || Math.hypot(dx, dy) < dead) return -1;
  const degrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const step = 360 / count;
  return Math.floor(((degrees + step / 2) % 360) / step);
}

/** A point at `radius` and `degrees` (clockwise from up) around (cx, cy). */
export function polar(cx: number, cy: number, radius: number, degrees: number) {
  const a = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.sin(a), y: cy - radius * Math.cos(a) };
}

const n = (value: number) => Math.round(value * 100) / 100;

/** The ring piece between radii r0 and r1 from angle a0 to a1 (degrees, clockwise from up). */
export function ringPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const p1 = polar(cx, cy, r1, a0);
  const p2 = polar(cx, cy, r1, a1);
  const p3 = polar(cx, cy, r0, a1);
  const p4 = polar(cx, cy, r0, a0);
  return [
    `M${n(p1.x)} ${n(p1.y)}`,
    `A${r1} ${r1} 0 ${large} 1 ${n(p2.x)} ${n(p2.y)}`,
    `L${n(p3.x)} ${n(p3.y)}`,
    `A${r0} ${r0} 0 ${large} 0 ${n(p4.x)} ${n(p4.y)}`,
    "Z",
  ].join(" ");
}

/** An open arc at `radius` from a0 to a1 (for the slices' coloured rims). */
export function arcPath(cx: number, cy: number, radius: number, a0: number, a1: number): string {
  const p1 = polar(cx, cy, radius, a0);
  const p2 = polar(cx, cy, radius, a1);
  return `M${n(p1.x)} ${n(p1.y)} A${radius} ${radius} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${n(p2.x)} ${n(p2.y)}`;
}

/** The ring piece of slice `index` of `count`. */
export function slicePath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  index: number,
  count: number,
): string {
  const middle = sliceAngle(index, count);
  const half = 180 / count;
  return ringPath(cx, cy, r0, r1, middle - half, middle + half);
}
