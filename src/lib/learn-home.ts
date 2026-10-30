// Pure rules for the learning home (/learn): the lesson count, the goal bar and the small labels
// shown beside tools. Kept free of React and alias imports so node can test it.

export type LessonLite = {
  id: string;
  title: string;
  title_ar: string;
  state: "done" | "current" | "locked";
  in_progress: boolean;
};

export function lessonsDone(lessons: LessonLite[] | null): { done: number; total: number } {
  const list = lessons ?? [];
  return { done: list.filter((lesson) => lesson.state === "done").length, total: list.length };
}

/** "1 card" / "10 cards". */
export function cardsLabel(count: number): string {
  return `${count} card${count === 1 ? "" : "s"}`;
}

/** Share of the daily goal done, 0 to 100, never NaN. */
export function goalPercent(done: number, goal: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(goal) || goal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / goal) * 100)));
}
