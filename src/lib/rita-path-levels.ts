// Levels on the learner's lesson path. A lesson's level is its book's level (rita_curricula.level,
// A1..C2). The road is cut into one section per level: a banner opens each section, and a finish
// stop closes it — either the admin's own finish stop (a path item, which they can move), or one
// drawn automatically after the level's last lesson. Pure: no React, no database.

export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof CEFR)[number];

/** A book's stored level as one of the six; anything unknown counts as A1 (the column's default). */
export function normalizeLevel(value: unknown): Level {
  const text = String(value ?? "")
    .trim()
    .toUpperCase();
  return (CEFR as readonly string[]).includes(text) ? (text as Level) : "A1";
}

export const levelRank = (level: Level) => CEFR.indexOf(level);

export function nextLevel(level: Level): Level | null {
  return CEFR[levelRank(level) + 1] ?? null;
}

/** What the sections need to know about one stop of the merged path. */
export type StopInfo = {
  /** The lesson's level; null for an item an admin placed (exercises, files, a finish stop). */
  level: Level | null;
  /** For an admin's finish stop: the level it closes. */
  finishOf: Level | null;
  done: boolean;
};

export type LevelCount = { lessons: number; done: number };

export type LevelRow<N> =
  | { type: "banner"; level: Level; count: LevelCount; first: boolean }
  | { type: "node"; node: N; nodeIndex: number; level: Level | null }
  | { type: "finish"; level: Level; count: LevelCount }
  | { type: "soon"; level: Level };

/**
 * The road with its level rows. Each run of lessons of one level gets a banner; the finish of a
 * level is drawn after its last lesson unless the admin placed their own finish stop for it. After
 * the highest level a «coming soon» banner names the next one.
 */
export function levelRows<N>(nodes: N[], info: (node: N) => StopInfo): LevelRow<N>[] {
  const infos = nodes.map(info);
  const counts = new Map<Level, LevelCount>();
  const lastLesson = new Map<Level, number>();
  const placedFinish = new Set<Level>();
  infos.forEach((stop, index) => {
    if (stop.finishOf) placedFinish.add(stop.finishOf);
    if (!stop.level) return;
    const count = counts.get(stop.level) ?? { lessons: 0, done: 0 };
    count.lessons += 1;
    if (stop.done) count.done += 1;
    counts.set(stop.level, count);
    lastLesson.set(stop.level, index);
  });
  if (counts.size === 0) {
    return nodes.map((node, nodeIndex) => ({ type: "node", node, nodeIndex, level: null }));
  }

  const countOf = (level: Level) => counts.get(level) ?? { lessons: 0, done: 0 };
  const rows: LevelRow<N>[] = [];
  let section: Level | null = null;
  const closeSection = (index: number) => {
    // Only after the level's last lesson (a level split by the admin's order closes once).
    if (!section || placedFinish.has(section) || (lastLesson.get(section) ?? -1) >= index) return;
    rows.push({ type: "finish", level: section, count: countOf(section) });
  };

  infos.forEach((stop, index) => {
    if (stop.level && stop.level !== section) {
      closeSection(index);
      rows.push({
        type: "banner",
        level: stop.level,
        count: countOf(stop.level),
        first: section === null,
      });
      section = stop.level;
    }
    rows.push({ type: "node", node: nodes[index], nodeIndex: index, level: section });
  });
  closeSection(nodes.length);

  const highest = [...counts.keys()].sort((a, b) => levelRank(b) - levelRank(a))[0];
  const next = nextLevel(highest);
  if (next) rows.push({ type: "soon", level: next });
  return rows;
}

export type ViewState = "done" | "current" | "locked" | "open";

/**
 * The learner chose to start at a later level ("start from here"). Lessons of the levels before it
 * stay open to visit (finished ones stay done); from that level on the path runs as usual: the
 * first unfinished lesson is the current one and the rest wait. Without a choice, or when the
 * choice is the first level, the server's states are kept.
 */
export function statesFrom<L extends { id: string; state: "done" | "current" | "locked" }>(
  lessons: L[],
  levelOf: (lesson: L) => Level,
  start: Level | null,
): Map<string, ViewState> {
  const states = new Map<string, ViewState>(lessons.map((lesson) => [lesson.id, lesson.state]));
  if (!start || lessons.length === 0) return states;
  const lowest = Math.min(...lessons.map((lesson) => levelRank(levelOf(lesson))));
  const from = levelRank(start);
  if (from <= lowest) return states;
  let current = false;
  for (const lesson of lessons) {
    if (lesson.state === "done") continue;
    if (levelRank(levelOf(lesson)) < from) {
      states.set(lesson.id, "open");
    } else if (!current) {
      current = true;
      states.set(lesson.id, "current");
    } else {
      states.set(lesson.id, "locked");
    }
  }
  return states;
}

/** The device remembers where a learner chose to start, per language. */
export const startLevelKey = (language: string | null) => `ritaStartLevel:${language ?? "default"}`;
