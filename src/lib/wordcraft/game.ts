// Wordcraft's game rules that are not the engine: tracing a path with a finger or keys, finding
// the tile under the finger, hints and the time shown at the end. No React, no DOM.
import { adjacent, type Path } from "./engine.ts";

/**
 * The traced path after the finger reaches `tile`: going back to the previous tile takes the
 * last step off; a neighbour that is free and not on the path yet is added; anything else
 * (a diagonal, a jump, a used tile, a tile already on the path) changes nothing.
 */
export function extendPath(
  path: Path,
  tile: number,
  cols: number,
  used: ReadonlySet<number>,
): Path {
  if (tile < 0 || used.has(tile)) return path;
  if (!path.length) return [tile];
  if (path.length >= 2 && path[path.length - 2] === tile) return path.slice(0, -1);
  if (path.includes(tile)) return path;
  return adjacent(cols, path[path.length - 1], tile) ? [...path, tile] : path;
}

export type BoardGeometry = {
  left: number;
  top: number;
  /** Distance from one tile's left edge to the next one's (tile + gap). */
  pitch: number;
  /** A tile's own size. */
  size: number;
  rows: number;
  cols: number;
};

/**
 * The tile under a point, or -1. Only the inner part of a tile counts (`inner` of its size), so
 * cutting across a corner never picks a diagonal tile by accident.
 */
export function tileAt(x: number, y: number, g: BoardGeometry, inner = 0.78): number {
  const cx = (x - g.left) / g.pitch;
  const cy = (y - g.top) / g.pitch;
  const col = Math.floor(cx);
  const row = Math.floor(cy);
  if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return -1;
  const half = (g.size * inner) / 2;
  const centreX = col * g.pitch + g.size / 2;
  const centreY = row * g.pitch + g.size / 2;
  const dx = x - g.left - centreX;
  const dy = y - g.top - centreY;
  return Math.abs(dx) <= half && Math.abs(dy) <= half ? row * g.cols + col : -1;
}

/**
 * The tiles a fast finger passed over between two pointer events, in order: points along the
 * segment every third of a tile, each turned into a tile (corners do not count).
 */
export function tilesAlong(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  g: BoardGeometry,
): number[] {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (g.pitch / 3)));
  const start = tileAt(x0, y0, g);
  const out: number[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = tileAt(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, g);
    if (t >= 0 && t !== start && out[out.length - 1] !== t) out.push(t);
  }
  return out;
}

/** How many tiles of the word a hint shows after `level` presses (at most the whole word). */
export function hintTiles(path: Path, level: number): Path {
  return path.slice(0, Math.min(path.length, Math.max(0, level)));
}

// ---- the sound setting (this device) --------------------------------------------------------

export const MUTE_KEY = "uzyra-wordcraft-muted";

/** "1:05", "12:30": a solve time for people. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
