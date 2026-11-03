// Where the round options sit around the circle. Pure: no DOM. Given the circle's centre inside the
// study area and how many options there are, it picks the smallest ring that fits, and uses the
// longest stretch of the ring that stays inside the area (a full circle in the middle of the
// screen, an arc near an edge, a smaller arc in a corner), so nothing is ever cut off.

export type RadialLayoutInput = {
  /** The circle's centre, in the study area's own pixels. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  count: number;
  /** Space kept free at the top (the strip that shows the selection). */
  topReserve?: number;
  pad?: number;
};

export type RadialSlot = { x: number; y: number };

export type RadialLayout = {
  radius: number;
  slots: RadialSlot[];
  /** How many options fit around the ring; more than that go on a second page. */
  capacity: number;
};

export const RADII = [104, 120, 138, 158, 180];
/** An option's box around its centre: the round button, and its name under it. */
const HALF_W = 52;
const UP = 30;
const DOWN = 58;
/** Centres of neighbouring options are at least this far apart (labels must not touch). */
const SPACING = 96;
const MAX_STEP = 54;
const SAMPLE = 3;

const rad = (degrees: number) => (degrees * Math.PI) / 180;

function minAngle(radius: number): number {
  return (2 * Math.asin(Math.min(1, SPACING / (2 * radius))) * 180) / Math.PI;
}

/** The longest run of free directions on a ring, as a start angle and a span in degrees. */
function freeArc(input: RadialLayoutInput, radius: number) {
  const pad = input.pad ?? 12;
  const top = pad + (input.topReserve ?? 0);
  const steps = 360 / SAMPLE;
  const free: boolean[] = [];
  for (let i = 0; i < steps; i += 1) {
    const a = rad(i * SAMPLE);
    const px = input.cx + radius * Math.cos(a);
    const py = input.cy + radius * Math.sin(a);
    free.push(
      px - HALF_W >= pad &&
        px + HALF_W <= input.width - pad &&
        py - UP >= top &&
        py + DOWN <= input.height - pad,
    );
  }
  if (free.every(Boolean)) return { full: true as const, start: 0, span: 360 };
  let best = { start: 0, length: 0 };
  for (let i = 0; i < steps; i += 1) {
    if (!free[i] || free[(i - 1 + steps) % steps]) continue; // only count from where a run starts
    let length = 0;
    while (length < steps && free[(i + length) % steps]) length += 1;
    if (length > best.length) best = { start: i, length };
  }
  return {
    full: false as const,
    start: best.start * SAMPLE,
    span: Math.max(0, (best.length - 1) * SAMPLE),
    length: best.length,
  };
}

export function layoutRadial(input: RadialLayoutInput): RadialLayout {
  const n = Math.max(0, input.count);
  let chosen: { radius: number; arc: ReturnType<typeof freeArc> } | null = null;
  let widest: { radius: number; arc: ReturnType<typeof freeArc> } | null = null;
  for (const radius of RADII) {
    const arc = freeArc(input, radius);
    const step = minAngle(radius);
    const room = arc.full ? 360 - n * step : arc.span - Math.max(0, n - 1) * step;
    const has = arc.full || (arc.length ?? 0) > 0;
    if (has && (!widest || arc.span >= widest.arc.span)) widest = { radius, arc };
    if (has && room >= 0) {
      chosen = { radius, arc };
      break;
    }
  }
  const pick = chosen ?? widest;
  if (!pick) {
    // No free direction at all (a tiny area): line them up towards the middle of the area.
    const toward =
      (Math.atan2(input.height / 2 - input.cy, input.width / 2 - input.cx) * 180) / Math.PI;
    const slots = Array.from({ length: n }, (_, i) => {
      const a = rad(toward + (i - (n - 1) / 2) * 40);
      return { x: RADII[0] * Math.cos(a), y: RADII[0] * Math.sin(a) };
    });
    return { radius: RADII[0], slots, capacity: n };
  }
  const { radius, arc } = pick;
  const step = minAngle(radius);
  const capacity = Math.max(2, arc.full ? Math.floor(360 / step) : Math.floor(arc.span / step) + 1);
  const shown = Math.min(n, capacity);
  const slots: RadialSlot[] = [];
  if (arc.full) {
    const each = 360 / Math.max(shown, 1);
    for (let i = 0; i < shown; i += 1) {
      const a = rad(-90 + i * each);
      slots.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
    }
  } else {
    const gap = shown > 1 ? Math.min(arc.span / (shown - 1), MAX_STEP) : 0;
    const first = arc.start + (arc.span - gap * (shown - 1)) / 2;
    for (let i = 0; i < shown; i += 1) {
      const a = rad(first + i * gap);
      slots.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
    }
  }
  return { radius, slots, capacity };
}

/** The slot nearest to a point (offsets from the circle's centre), if one is within `reach`. */
export function nearestSlot(slots: RadialSlot[], dx: number, dy: number, reach = 46): number {
  let best = -1;
  let bestDistance = reach;
  slots.forEach((slot, index) => {
    const distance = Math.hypot(slot.x - dx, slot.y - dy);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}
