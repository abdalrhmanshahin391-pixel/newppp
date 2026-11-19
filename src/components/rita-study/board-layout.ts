import type { BoardCommand } from "@/lib/study/whiteboard";

type Point = [number, number];
type Box = { x: number; y: number; w: number; h: number };
const margin = 7;
function intersects([x, y]: Point, [ex, ey]: Point, box: Box) {
  // Clip the segment against the rectangle on both axes.
  let start = 0,
    end = 1;
  for (const [origin, delta, min, max] of [
    [x, ex - x, box.x, box.x + box.w],
    [y, ey - y, box.y, box.y + box.h],
  ]) {
    if (!delta) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const a = (min - origin) / delta,
      b = (max - origin) / delta;
    start = Math.max(start, Math.min(a, b));
    end = Math.min(end, Math.max(a, b));
  }
  return start <= end;
}
const grow = (b: Box, n: number): Box => ({
  x: b.x - n,
  y: b.y - n,
  w: b.w + 2 * n,
  h: b.h + 2 * n,
});
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function route(start: Point, end: Point, boxes: Box[]): Point[] {
  const clear = (a: Point, b: Point) => !boxes.some((box) => intersects(a, b, box));
  if (clear(start, end)) return [start, end];
  // The edges of padded labels form a small orthogonal routing grid.
  const sorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
  const xs = sorted([start[0], end[0], -5, 605, ...boxes.flatMap((b) => [b.x - 1, b.x + b.w + 1])]);
  const ys = sorted([start[1], end[1], -5, ...boxes.flatMap((b) => [b.y - 1, b.y + b.h + 1])]);
  const id = (p: Point) => ys.indexOf(p[1]) * xs.length + xs.indexOf(p[0]);
  const point = (i: number): Point => [xs[i % xs.length], ys[Math.floor(i / xs.length)]];
  const first = id(start),
    last = id(end),
    queue = [first],
    prev = new Map([[first, -1]]);
  for (let i = 0; i < queue.length && !prev.has(last); i++) {
    const cur = queue[i],
      col = cur % xs.length,
      row = Math.floor(cur / xs.length);
    for (const [cx, cy] of [
      [col + 1, row],
      [col - 1, row],
      [col, row + 1],
      [col, row - 1],
    ]) {
      if (cx < 0 || cy < 0 || cx >= xs.length || cy >= ys.length) continue;
      const next = cy * xs.length + cx;
      if (!prev.has(next) && clear(point(cur), point(next))) {
        prev.set(next, cur);
        queue.push(next);
      }
    }
  }
  if (!prev.has(last)) return [];
  const points: Point[] = [];
  for (let n = last; n !== -1; n = prev.get(n)!) points.unshift(point(n));
  return points.filter(
    (p, i) =>
      i === 0 ||
      i === points.length - 1 ||
      !(
        (points[i - 1][0] === p[0] && p[0] === points[i + 1][0]) ||
        (points[i - 1][1] === p[1] && p[1] === points[i + 1][1])
      ),
  );
}

export function layoutBoard(commands: BoardCommand[]) {
  const labels = new Map<BoardCommand, { original: Box; box: Box }>();
  for (const c of commands) {
    if (c.op !== "write") continue;
    const w =
      c.width ??
      Math.min(560, Array.from(c.text).length * (/[\u0600-\u06ff]/.test(c.text) ? 12 : 17));
    const original = {
      x: Math.max(12, Math.min(588 - w, c.at[0])),
      y: Math.max(10, c.at[1]),
      w,
      h: 38,
    };
    labels.set(c, { original, box: { ...original } });
  }
  const underlines = new Map<BoardCommand, Box>();
  const fixed: [Point, Point][] = [];
  for (const c of commands) {
    if (c.op === "path") c.points.forEach((p, i) => fixed.push([i ? c.points[i - 1] : c.at, p]));
    if (c.op === "line") {
      const left = Math.min(c.at[0], c.to[0]),
        right = Math.max(c.at[0], c.to[0]);
      const owner = [...labels.values()].find(
        ({ original: b }) =>
          Math.abs(c.at[1] - c.to[1]) <= 3 &&
          left >= b.x - 6 &&
          right <= b.x + b.w + 6 &&
          c.at[1] >= b.y + 19 &&
          c.at[1] <= b.y + 46,
      );
      if (owner) underlines.set(c, owner.box);
      else fixed.push([c.at, c.to]);
    }
    if (c.op === "ellipse") {
      const [x, y] = c.at,
        [u, v] = c.to;
      const edge = (i: number): Point => [
        (x + u) / 2 + ((u - x) / 2) * Math.cos((i * Math.PI) / 16),
        (y + v) / 2 + ((v - y) / 2) * Math.sin((i * Math.PI) / 16),
      ];
      for (let i = 0; i < 32; i++) fixed.push([edge(i), edge(i + 1)]);
    }
  }
  const placed: Box[] = [];
  for (const { box } of labels.values()) {
    while (
      placed.some((b) => overlaps(grow(box, 18), b)) ||
      fixed.some(([a, b]) => intersects(a, b, grow(box, 5)))
    )
      box.y += 12;
    placed.push(box);
  }
  const boxes = [...labels.values()].map((l) => grow(l.box, margin));
  const anchor = (p: Point, other: Point): Point => {
    const label =
      [...labels.values()].find((l) => intersects(p, p, grow(l.original, margin))) ??
      [...labels.values()].find((l) => intersects(p, p, grow(l.box, margin)));
    if (!label) return p;
    const b = grow(label.box, margin + 2);
    const ports: Point[] = [
      [b.x, b.y + b.h / 2],
      [b.x + b.w, b.y + b.h / 2],
      [b.x + b.w / 2, b.y],
      [b.x + b.w / 2, b.y + b.h],
    ];
    const dist = (q: Point) => Math.hypot(q[0] - other[0], q[1] - other[1]);
    return (
      ports
        .filter((q) => !boxes.some((box) => intersects(q, q, box)))
        .sort((a, b) => dist(a) - dist(b))[0] ?? ports[0]
    );
  };
  return {
    labels,
    underlines,
    height: Math.max(
      275,
      ...boxes.map((b) => b.y + b.h + 20),
      ...commands.flatMap((c) =>
        c.op === "path"
          ? c.points.map((p) => p[1] + 16)
          : "to" in c
            ? [c.to[1] + 16, c.at[1] + 16]
            : [],
      ),
    ),
    arrow: (a: Point, b: Point) => route(anchor(a, b), anchor(b, a), boxes),
  };
}
