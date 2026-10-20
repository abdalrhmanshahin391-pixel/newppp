// Pure rules for the learning home (/learn): which single step to suggest next, the greeting,
// and the small labels shown beside tools. Kept free of React and alias imports so node can test it.

export type LessonLite = {
  id: string;
  title: string;
  title_ar: string;
  state: "done" | "current" | "locked";
  in_progress: boolean;
};

export type ContinueChoice =
  | { kind: "signin" }
  | { kind: "lesson"; lessonId: string; title: string; titleAr: string; started: boolean }
  | { kind: "review"; due: number }
  | { kind: "talk" };

/**
 * The one suggested next step, in a fixed order the learner can predict:
 * a lesson already started, then cards due for review, then the next lesson, then a talk with Rita.
 * `lessons` and `due` are null while still loading or when they could not be read.
 */
export function pickContinue(input: {
  signedIn: boolean;
  lessons: LessonLite[] | null;
  due: number | null;
}): ContinueChoice {
  if (!input.signedIn) return { kind: "signin" };
  const lessons = input.lessons ?? [];
  const started = lessons.find((lesson) => lesson.in_progress && lesson.state !== "done");
  if (started) {
    return {
      kind: "lesson",
      lessonId: started.id,
      title: started.title,
      titleAr: started.title_ar,
      started: true,
    };
  }
  if ((input.due ?? 0) > 0) return { kind: "review", due: input.due as number };
  const next = lessons.find((lesson) => lesson.state === "current");
  if (next) {
    return {
      kind: "lesson",
      lessonId: next.id,
      title: next.title,
      titleAr: next.title_ar,
      started: false,
    };
  }
  return { kind: "talk" };
}

/** First word of the learner's name, or of the email before the @; empty when there is neither. */
export function firstName(fullName?: string | null, email?: string | null): string {
  const fromName = String(fullName ?? "")
    .trim()
    .split(/\s+/)[0];
  if (fromName) return fromName;
  const local = String(email ?? "").split("@")[0] ?? "";
  return (
    local
      .replace(/[._\d]+/g, " ")
      .trim()
      .split(/\s+/)[0] ?? ""
  );
}

export type DayPart = "morning" | "afternoon" | "evening";

/** Part of the day from the learner's local hour (0 to 23). */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

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
