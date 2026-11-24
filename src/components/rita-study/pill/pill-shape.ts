/**
 * Uzyra's body and eyes, drawn in the 100 × 100 box the SVG uses.
 *
 * The body is a pill (a stadium: a box whose short sides are half circles), seen as a thick slab.
 * It can turn (yaw), tip (pitch), lean (roll), squash and move. Turning and tipping change the
 * outline's width and height the way a real slab's would, and slide the eyes across its front
 * face, narrowing them, until they pass out of sight; leaning, squashing and moving are an affine
 * map applied to every Bézier control point, which keeps the outline exact and smooth at any size.
 * Pure: no DOM, the same on the server and in tests.
 */

export type Vec2 = [number, number];

/** The resting pill: 78 × 50 (about 1.56 : 1), 36 deep, centred in the box. */
export const BODY = { w: 78, h: 50, depth: 36 } as const;
export const CENTRE: Vec2 = [50, 50];

/** Resting eyes: two upright white pills on the front face. */
export const EYE = { w: 8, h: 17, gap: 23 } as const;

/** Circle arcs as cubic Béziers: control length for a quarter turn. */
const K = 0.5522847498;

/** One closed outline: a start point and cubic segments [c1, c2, end]. */
export type Outline = { start: Vec2; curves: [Vec2, Vec2, Vec2][] };

/**
 * A stadium (rounded box with radius = half its shorter side), centred at (cx, cy), as an outline
 * of straight sides and quarter circles (straight sides are written as flat cubics, so every
 * segment is the same kind and maps the same way).
 */
export function stadium(cx: number, cy: number, w: number, h: number): Outline {
  const hw = Math.max(0.001, w / 2);
  const hh = Math.max(0.001, h / 2);
  const r = Math.min(hw, hh);
  const k = r * K;
  const x0 = cx - hw,
    x1 = cx + hw,
    y0 = cy - hh,
    y1 = cy + hh;
  const line = (a: Vec2, b: Vec2): [Vec2, Vec2, Vec2] => [
    [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
    [a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3],
    b,
  ];
  const curves: [Vec2, Vec2, Vec2][] = [];
  // Top edge left to right, then clockwise.
  curves.push(line([x0 + r, y0], [x1 - r, y0]));
  curves.push([
    [x1 - r + k, y0],
    [x1, y0 + r - k],
    [x1, y0 + r],
  ]);
  curves.push(line([x1, y0 + r], [x1, y1 - r]));
  curves.push([
    [x1, y1 - r + k],
    [x1 - r + k, y1],
    [x1 - r, y1],
  ]);
  curves.push(line([x1 - r, y1], [x0 + r, y1]));
  curves.push([
    [x0 + r - k, y1],
    [x0, y1 - r + k],
    [x0, y1 - r],
  ]);
  curves.push(line([x0, y1 - r], [x0, y0 + r]));
  curves.push([
    [x0, y0 + r - k],
    [x0 + r - k, y0],
    [x0 + r, y0],
  ]);
  return { start: [x0 + r, y0], curves };
}

/** A 2D affine map: [a, b, c, d, e, f] sends (x, y) to (a·x + c·y + e, b·x + d·y + f). */
export type Affine = [number, number, number, number, number, number];

export function applyAffine(m: Affine, p: Vec2): Vec2 {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

/**
 * Lean (degrees), squash (sx, sy about `anchor`), scale and move, as one map. Squash first (about
 * the anchor, so a hop squashes from the feet), then lean about the centre, then scale and move.
 */
export function placement(opts: {
  roll: number;
  sx: number;
  sy: number;
  scale: number;
  x: number;
  y: number;
  anchor: Vec2;
}): Affine {
  const { roll, sx, sy, scale, x, y, anchor } = opts;
  const [ax, ay] = anchor;
  const [cx, cy] = CENTRE;
  const c = Math.cos((roll * Math.PI) / 180);
  const s = Math.sin((roll * Math.PI) / 180);
  // p' = C + R·(scale·(A + S·(p − A)) − C) + T
  const a = scale * sx * c;
  const b = scale * sx * s;
  const cc = -scale * sy * s;
  const d = scale * sy * c;
  const qx = scale * (ax - sx * ax) - cx;
  const qy = scale * (ay - sy * ay) - cy;
  const e = cx + c * qx - s * qy + x;
  const f = cy + s * qx + c * qy + y;
  return [a, b, cc, d, e, f];
}

const fmt = (v: number, decimals: number) => {
  const r = Number(v.toFixed(decimals));
  return Object.is(r, -0) ? "0" : String(r);
};

/** An outline through a map, as SVG path data. */
export function outlinePath(o: Outline, m: Affine, decimals = 2): string {
  const p = (v: Vec2) => {
    const [x, y] = applyAffine(m, v);
    return `${fmt(x, decimals)} ${fmt(y, decimals)}`;
  };
  let d = `M${p(o.start)}`;
  for (const [c1, c2, end] of o.curves) d += `C${p(c1)} ${p(c2)} ${p(end)}`;
  return d + "Z";
}

/** One eye's shape before it is placed: size, its own lean, and how far it sits off the line. */
export type EyeShape = { w: number; h: number; tilt: number; dy: number };

/** Both eyes: left and right (the right one's tilt is mirrored when drawn). */
export type EyePair = [EyeShape, EyeShape];

export type Pose = {
  /** Move, in box units. */
  x: number;
  y: number;
  /** Lean in degrees (positive leans right). */
  roll: number;
  /** Turn (positive shows the right side) and tip (negative looks up), in degrees. */
  yaw: number;
  pitch: number;
  /** Squash and stretch (1 = none). */
  sx: number;
  sy: number;
  /** Where the eyes look on the face, in box units. */
  lx: number;
  ly: number;
};

export const REST_POSE: Pose = {
  x: 0,
  y: 0,
  roll: 0,
  yaw: 0,
  pitch: 0,
  sx: 1,
  sy: 1,
  lx: 0,
  ly: 0,
};

export const REST_EYES: EyePair = [
  { w: EYE.w, h: EYE.h, tilt: 0, dy: 0 },
  { w: EYE.w, h: EYE.h, tilt: 0, dy: 0 },
];

export type PillFrame = { body: string; eyes: [string, string] | null };

/**
 * The outline and eyes for one pose.
 *
 * Turning by `yaw`: the outline's width is W·|cos| + D·|sin| (the side of the slab comes into
 * view), and the front face, with its eyes, slides toward the turn by D/2·sin and narrows by cos;
 * past 90° the eyes are on the back and are not drawn. Tipping by `pitch` does the same up and
 * down. Then lean, squash and move apply to everything as one exact map.
 */
export function pillFrame(
  pose: Pose,
  eyes: EyePair,
  opts: { scale?: number; decimals?: number } = {},
): PillFrame {
  const scale = opts.scale ?? 1;
  const decimals = opts.decimals ?? 2;
  const yaw = (pose.yaw * Math.PI) / 180;
  const pitch = (pose.pitch * Math.PI) / 180;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const w = BODY.w * Math.abs(cy) + BODY.depth * Math.abs(sy);
  const h = BODY.h * Math.abs(cp) + BODY.depth * Math.abs(sp);
  const [cx, cyy] = CENTRE;
  const anchor: Vec2 = [cx, cyy + h / 2];
  const m = placement({
    roll: pose.roll,
    sx: pose.sx,
    sy: pose.sy,
    scale,
    x: pose.x,
    y: pose.y,
    anchor,
  });
  const body = outlinePath(stadium(cx, cyy, w, h), m, decimals);

  // The front face: visible while it faces the reader (cos > 0 on both axes).
  const facing = Math.min(cy, cp);
  if (facing <= 0.08) return { body, eyes: null };
  const faceX = cx + (BODY.depth / 2) * sy;
  // Negative pitch tips the face up (looking up), positive tips it down (nodding, leaning in).
  const faceY = cyy + (BODY.depth / 2) * sp;
  // Eyes keep inside the face as it narrows: their look is scaled the same way.
  const lookX = pose.lx * cy;
  const lookY = pose.ly * cp;
  const fade = Math.min(1, (facing - 0.08) / 0.3);
  const drawn = eyes.map((eye, i) => {
    const side = i === 0 ? -1 : 1;
    const ex = faceX + (side * EYE.gap * cy) / 2 + lookX;
    const ey = faceY + eye.dy * cp + lookY;
    const ew = Math.max(0.2, eye.w * Math.abs(cy) * fade);
    const eh = Math.max(0.2, eye.h * Math.abs(cp) * (0.6 + 0.4 * fade));
    const tilt = eye.tilt * side;
    // The eye's own lean, about its own centre, then the body's map.
    const t = (tilt * Math.PI) / 180;
    const c = Math.cos(t),
      s = Math.sin(t);
    const own: Affine = [c, s, -s, c, ex - c * ex + s * ey, ey - s * ex - c * ey];
    const both: Affine = [
      m[0] * own[0] + m[2] * own[1],
      m[1] * own[0] + m[3] * own[1],
      m[0] * own[2] + m[2] * own[3],
      m[1] * own[2] + m[3] * own[3],
      m[0] * own[4] + m[2] * own[5] + m[4],
      m[1] * own[4] + m[3] * own[5] + m[5],
    ];
    return outlinePath(stadium(ex, ey, ew, eh), both, decimals);
  });
  return { body, eyes: [drawn[0], drawn[1]] };
}
