// Units on the learner's lesson path. A level's page is cut into short units, the way the big
// learning apps do it: the learner sees one unit at a time and the next one opens when this one is
// done, so the path never shows how many lessons there are in all.
//
// A unit starts at an admin's unit marker (a 'unit' path item; its title names the unit). Without
// markers in the level, a new unit starts every UNIT_SIZE lessons. Stops that are not lessons
// (quizzes, films, files, the level's finish) stay with the lesson before them; the ones before the
// first lesson join the first unit. The level's banner is not part of any unit. Pure: no React.
import type { Level, ViewState } from "./rita-path-levels";

export const UNIT_SIZE = 5;

/** What the split needs to know about one row of a level's page. */
export type UnitStop =
  | { kind: "banner" }
  | { kind: "marker"; id: string; title: string }
  | { kind: "lesson"; state: ViewState }
  | { kind: "stop" };

export type PathUnit = {
  /** Stable across visits: the marker's id, or `<level>:<number>` for a unit cut automatically. */
  key: string;
  /** 1-based, inside the level. */
  number: number;
  /** The admin's name for it (a marker's title); null for a unit cut automatically. */
  title: string | null;
  /** The page rows it holds: [start, end). A marker's own row is its first. */
  start: number;
  end: number;
  lessons: number;
  done: number;
  /** Lessons still waiting their turn (locked). */
  locked: number;
  /** It holds the learner's current lesson. */
  current: boolean;
};

export function unitsOf(level: Level, stops: UnitStop[], size = UNIT_SIZE): PathUnit[] {
  const units: PathUnit[] = [];
  const marked = stops.some((stop) => stop.kind === "marker");
  let unit: PathUnit | null = null;
  const open = (start: number, marker?: { id: string; title: string }) => {
    const number = units.length + 1;
    unit = {
      key: marker ? marker.id : `${level}:${number}`,
      number,
      title: marker ? marker.title.trim() || null : null,
      start,
      end: start,
      lessons: 0,
      done: 0,
      locked: 0,
      current: false,
    };
    units.push(unit);
    return unit;
  };

  stops.forEach((stop, index) => {
    if (stop.kind === "banner") return;
    if (stop.kind === "marker") {
      open(index, stop).end = index + 1;
      return;
    }
    let here: PathUnit = unit ?? open(index);
    if (stop.kind === "lesson") {
      if (!marked && here.lessons >= size) here = open(index);
      here.lessons += 1;
      if (stop.state === "done") here.done += 1;
      if (stop.state === "locked") here.locked += 1;
      if (stop.state === "current") here.current = true;
    }
    here.end = index + 1;
  });
  return units;
}

export const unitDone = (unit: PathUnit) => unit.done >= unit.lessons;

/**
 * The unit the learner is on: the one with the current lesson, else the first one not finished,
 * else the last. -1 when there are none.
 */
export function frontierUnit(units: PathUnit[]): number {
  if (units.length === 0) return -1;
  const current = units.findIndex((unit) => unit.current);
  if (current >= 0) return current;
  const unfinished = units.findIndex((unit) => unit.lessons > 0 && !unitDone(unit));
  return unfinished >= 0 ? unfinished : units.length - 1;
}

/**
 * A unit the learner may open: up to the one they are on, and any unit with no lesson waiting its
 * turn (a level they chose to skip leaves every lesson open).
 */
export function unitOpen(units: PathUnit[], index: number, frontier = frontierUnit(units)) {
  const unit = units[index];
  if (!unit) return false;
  return index <= frontier || unit.locked === 0;
}

/** The units a learner sees in the switcher: every open one, then the first closed one. */
export function visibleUnits(units: PathUnit[]): number {
  const frontier = frontierUnit(units);
  let count = 0;
  while (count < units.length && unitOpen(units, count, frontier)) count += 1;
  return Math.min(units.length, count + 1);
}

/** The device remembers which finished units were already celebrated, per language. */
export const celebratedKey = (language: string | null) =>
  `ritaUnitsCelebrated:${language ?? "default"}`;
