/**
 * Uzyra's body and eyes, drawn in the 100 × 100 box the SVG uses.
 *
 * The body is a soft cube: a rounded square with some thickness and fully rounded edges, like a
 * thick cookie. Mathematically it is a box, widened by a disc in its front plane (the rounded
 * corners) and then by a ball (the rounded edges). For any direction, the point of such a body
 * that reaches farthest that way has a closed form, so the outline at any turn is found by asking
 * that for a ring of directions around the screen. Those points move smoothly as it turns, so the
 * outline never shakes, and its rounded side comes into view as it turns away.
 *
 * The eyes are flat shapes on the front face, turned with the body (a flat shape turned and seen
 * straight on is an affine map of itself, so their Bézier outlines stay exact): they slide, narrow
 * and hide behind it as it turns. Lean, squash and moving are one more affine map on top.
 * Pure: no DOM, the same on the server and in tests.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export const CENTRE: Vec2 = [50, 50];

/**
 * The soft cube: 76 wide and tall, 32 deep. `corner` rounds the front square's corners and `edge`
 * rounds every edge, so seen from the front its corners are corner + edge = 16 round.
 */
export const BODY = { half: 38, halfDepth: 16, corner: 6, edge: 10 } as const;
const HX = BODY.half - BODY.corner - BODY.edge;
const HZ = BODY.halfDepth - BODY.edge;
/** The flat front face: the eyes are drawn on it. */
export const FACE_Z = BODY.halfDepth;
/** Half the size of the flat front face (the eyes must stay inside it). */
export const FACE_HALF = HX + BODY.corner;

/** Resting eyes: upright pills, a little below the middle. */
export const EYE = { w: 9.5, h: 20.5, gap: 20, y: 3 } as const;

/** The body's farthest point in direction `d` (body coordinates, any length). */
export function support(d: Vec3): Vec3 {
  const [dx, dy, dz] = d;
  const flat = Math.hypot(dx, dy);
  const len = Math.hypot(dx, dy, dz) || 1;
  const c = flat > 1e-9 ? BODY.corner / flat : 0;
  const e = BODY.edge / len;
  return [
    Math.sign(dx) * HX + dx * c + dx * e,
    Math.sign(dy) * HX + dy * c + dy * e,
    Math.sign(dz) * HZ + dz * e,
  ];
}

/**
 * A turn: `yaw` (degrees, positive turns the face to the viewer's right) then `pitch` (positive
 * tips the face down, negative looks up). View coordinates: x right, y down, z toward the viewer.
 */
export function turn(yawDeg: number, pitchDeg: number) {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  return {
    /** Body → view. */
    view(p: Vec3): Vec3 {
      const x1 = p[0] * cy + p[2] * sy;
      const z1 = -p[0] * sy + p[2] * cy;
      return [x1, p[1] * cp + z1 * sp, -p[1] * sp + z1 * cp];
    },
    /** View → body (the inverse turn). */
    body(v: Vec3): Vec3 {
      const y1 = v[1] * cp - v[2] * sp;
      const z1 = v[1] * sp + v[2] * cp;
      return [v[0] * cy - z1 * sy, y1, v[0] * sy + z1 * cy];
    },
    /** How squarely the front face looks at the viewer (1 straight on, ≤ 0 facing away). */
    facing: cy * cp,
  };
}

/** One closed outline: a start point and cubic segments [c1, c2, end]. */
export type Outline = { start: Vec2; curves: [Vec2, Vec2, Vec2][] };

const lineTo = (a: Vec2, b: Vec2): [Vec2, Vec2, Vec2] => [
  [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
  [a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3],
  b,
];

/** A pill standing in a w × h box centred at (cx, cy): straight sides and half-circle ends. */
export function stadium(cx: number, cy: number, w: number, h: number): Outline {
  const hw = Math.max(0.001, w / 2);
  const hh = Math.max(0.001, h / 2);
  const r = Math.min(hw, hh);
  const x0 = cx - hw,
    x1 = cx + hw,
    y0 = cy - hh,
    y1 = cy + hh;
  const curves: [Vec2, Vec2, Vec2][] = [];
  curves.push(lineTo([x0 + r, y0], [x1 - r, y0]));
  curves.push(...arcCurves([x1 - r, y0 + r], r, -Math.PI / 2, 0));
  curves.push(lineTo([x1, y0 + r], [x1, y1 - r]));
  curves.push(...arcCurves([x1 - r, y1 - r], r, 0, Math.PI / 2));
  curves.push(lineTo([x1 - r, y1], [x0 + r, y1]));
  curves.push(...arcCurves([x0 + r, y1 - r], r, Math.PI / 2, Math.PI));
  curves.push(lineTo([x0, y1 - r], [x0, y0 + r]));
  curves.push(...arcCurves([x0 + r, y0 + r], r, Math.PI, (Math.PI * 3) / 2));
  return { start: [x0 + r, y0], curves };
}

/** A circle arc from angle a to b (radians, y down), as cubic segments of at most 90° each. */
export function arcCurves(c: Vec2, r: number, a: number, b: number): [Vec2, Vec2, Vec2][] {
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / (Math.PI / 2) - 1e-9));
  const step = (b - a) / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: [Vec2, Vec2, Vec2][] = [];
  for (let i = 0; i < n; i += 1) {
    const s = a + step * i;
    const e = s + step;
    const p0: Vec2 = [c[0] + r * Math.cos(s), c[1] + r * Math.sin(s)];
    const p3: Vec2 = [c[0] + r * Math.cos(e), c[1] + r * Math.sin(e)];
    out.push([
      [p0[0] - k * r * Math.sin(s), p0[1] + k * r * Math.cos(s)],
      [p3[0] + k * r * Math.sin(e), p3[1] - k * r * Math.cos(e)],
      p3,
    ]);
  }
  return out;
}

/**
 * A thick arc (a pill bent along a circle of radius r, from angle a0 to a1, t thick), with round
 * ends: the happy ◠ and sleepy ◡ eyes.
 */
export function arcStroke(c: Vec2, r: number, a0: number, a1: number, t: number): Outline {
  const h = t / 2;
  const dir = a1 >= a0 ? 1 : -1;
  const end: Vec2 = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)];
  const begin: Vec2 = [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)];
  return {
    start: [c[0] + (r + h) * Math.cos(a0), c[1] + (r + h) * Math.sin(a0)],
    curves: [
      ...arcCurves(c, r + h, a0, a1),
      ...arcCurves(end, h, a1, a1 + dir * Math.PI),
      ...arcCurves(c, Math.max(0.01, r - h), a1, a0),
      ...arcCurves(begin, h, a0 + dir * Math.PI, a0 + dir * 2 * Math.PI),
    ],
  };
}

export function mapOutline(o: Outline, f: (p: Vec2) => Vec2): Outline {
  return {
    start: f(o.start),
    curves: o.curves.map(([a, b, c]) => [f(a), f(b), f(c)] as [Vec2, Vec2, Vec2]),
  };
}

/** A 2D affine map: [a, b, c, d, e, f] sends (x, y) to (a·x + c·y + e, b·x + d·y + f). */
export type Affine = [number, number, number, number, number, number];

export function applyAffine(m: Affine, p: Vec2): Vec2 {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

/**
 * Lean (degrees), squash (sx, sy about `anchor`), scale and move, as one map: squash first (about
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
  const qx = scale * (ax - sx * ax) - cx;
  const qy = scale * (ay - sy * ay) - cy;
  return [
    scale * sx * c,
    scale * sx * s,
    -scale * sy * s,
    scale * sy * c,
    cx + c * qx - s * qy + x,
    cy + s * qx + c * qy + y,
  ];
}

export type Pose = {
  /** Move, in box units. */
  x: number;
  y: number;
  /** Lean in degrees (positive leans right). */
  roll: number;
  /** Turn (positive shows the face to the right) and tip (negative looks up), in degrees. */
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

/** One eye: an upright pill, or a thick arc (`up`: ◠ happy, otherwise ◡ sleepy). */
export type EyeShape =
  | { kind: "pill"; w: number; h: number; tilt: number; dx: number; dy: number }
  | {
      kind: "arc";
      r: number;
      span: number;
      t: number;
      up: boolean;
      tilt: number;
      dx: number;
      dy: number;
    };

/** Both eyes: left and right (tilt and dx are mirrored on the right one). */
export type EyePair = [EyeShape, EyeShape];

/** An eye's outline on the front face (coordinates from the body's centre). */
export function eyeOutline(e: EyeShape, side: -1 | 1, look: Vec2, squeeze = 1): Outline {
  const cx = side * (EYE.gap / 2 + e.dx) + look[0];
  const cy = EYE.y + e.dy + look[1];
  let o: Outline;
  if (e.kind === "pill") {
    o = stadium(cx, cy, e.w, e.h);
  } else {
    const half = (e.span * Math.PI) / 360;
    const mid = e.up ? -Math.PI / 2 : Math.PI / 2;
    // The circle sits so the arc's own middle height is on the eye's line.
    const offset = (e.r * (1 + Math.cos(half))) / 2;
    o = arcStroke([cx, e.up ? cy + offset : cy - offset], e.r, mid - half, mid + half, e.t);
  }
  const t = (side * e.tilt * Math.PI) / 180;
  const c = Math.cos(t),
    s = Math.sin(t);
  return mapOutline(o, ([x, y]) => {
    const dx = x - cx,
      dy = (y - cy) * squeeze;
    return [cx + c * dx - s * dy, cy + s * dx + c * dy];
  });
}

export type MascotGeometry = {
  /** The outline, as points around the body (in order). */
  body: Vec2[];
  /** The eyes' outlines, or null when the face is turned away. */
  eyes: [Outline, Outline] | null;
};

/**
 * The outline and the eyes for one pose. `samples` directions around the screen give as many
 * outline points (more on the round corners, where the direction changes fastest, and only the
 * two ends on a straight side). `lid` closes the eyes (0 open, 1 shut).
 */
export function mascotGeometry(
  pose: Pose,
  eyes: EyePair,
  opts: { samples?: number; lid?: number; scale?: number } = {},
): MascotGeometry {
  const samples = opts.samples ?? 144;
  const lid = opts.lid ?? 0;
  const view = turn(pose.yaw, pose.pitch);
  const m = placement({
    roll: pose.roll,
    sx: pose.sx,
    sy: pose.sy,
    scale: opts.scale ?? 1,
    x: pose.x,
    y: pose.y,
    anchor: [CENTRE[0], CENTRE[1] + BODY.half],
  });
  const toScreen = (p: Vec3): Vec2 => applyAffine(m, [CENTRE[0] + p[0], CENTRE[1] + p[1]]);

  const body: Vec2[] = [];
  for (let k = 0; k < samples; k += 1) {
    const a = (k / samples) * Math.PI * 2;
    const p = toScreen(view.view(support(view.body([Math.cos(a), Math.sin(a), 0]))));
    const last = body[body.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.02) body.push(p);
  }

  // Nearly edge on, the eyes would be slivers on the rim: they hide a moment before.
  if (view.facing <= 0.12) return { body, eyes: null };
  const squeeze = 1 - 0.9 * lid;
  const look: Vec2 = [pose.lx, pose.ly];
  const onFace = (o: Outline) => mapOutline(o, ([x, y]) => toScreen(view.view([x, y, FACE_Z])));
  return {
    body,
    eyes: [
      onFace(eyeOutline(eyes[0], -1, look, squeeze)),
      onFace(eyeOutline(eyes[1], 1, look, squeeze)),
    ],
  };
}

const fmt = (v: number, decimals: number) => {
  const r = Number(v.toFixed(decimals));
  return Object.is(r, -0) ? "0" : String(r);
};

export function outlinePath(o: Outline, decimals = 2): string {
  const p = (v: Vec2) => `${fmt(v[0], decimals)} ${fmt(v[1], decimals)}`;
  let d = `M${p(o.start)}`;
  for (const [c1, c2, end] of o.curves) d += `C${p(c1)} ${p(c2)} ${p(end)}`;
  return d + "Z";
}

/** A closed polyline (after the first point, SVG reads the pairs as straight lines). */
export function polygonPath(points: Vec2[], decimals = 2): string {
  return `M${points.map((p) => `${fmt(p[0], decimals)} ${fmt(p[1], decimals)}`).join(" ")}Z`;
}

export type MascotFrame = { body: string; eyes: [string, string] | null };

export function mascotFrame(
  pose: Pose,
  eyes: EyePair,
  opts: { samples?: number; lid?: number; scale?: number; decimals?: number } = {},
): MascotFrame {
  const g = mascotGeometry(pose, eyes, opts);
  const decimals = opts.decimals ?? 2;
  return {
    body: polygonPath(g.body, decimals),
    eyes: g.eyes ? [outlinePath(g.eyes[0], decimals), outlinePath(g.eyes[1], decimals)] : null,
  };
}
