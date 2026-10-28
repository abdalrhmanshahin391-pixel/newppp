// The book page's one list and its one button per lesson. A lesson is made in four steps (the
// lesson, its exercises, its PDF guide, then the guide checked and linked); these rules say which
// steps are still missing, what the row shows, and what its button does. Pure, so they are unit
// tested with node. The state comes from the database each time, so a closed page resumes where it
// stopped.
import type { TopicSuggestion } from "../rita-slides.ts";

export const MAKER_STEPS = ["lesson", "exercises", "guide", "link"] as const;
export type MakerStep = (typeof MAKER_STEPS)[number];

export const STEP_TEXT: Record<MakerStep, { label: string; doing: string }> = {
  lesson: { label: "الدرس", doing: "بكتب الدرس" },
  exercises: { label: "التمارين", doing: "بكتب التمارين" },
  guide: { label: "الدليل", doing: "بكتب الدليل" },
  link: { label: "فحص وربط", doing: "بفحص وبربط" },
};

/** What the database says about one lesson (nothing when it is only a suggestion). */
export type LessonFacts = {
  exists: boolean;
  status?: "draft" | "published" | "archived";
  exercises?: "none" | "draft" | "published";
  /** The code checks of its exercises fail: they cannot be published. */
  exerciseProblems?: number;
  /** A ready guide with its learners' copy is linked. */
  linked?: boolean;
};

/** Which parts of the database are there (a migration not yet applied skips its step). */
export type MakerSetup = { exercisesReady: boolean; studyReady: boolean };

/** What is happening to a row in this visit. */
export type RunState =
  | { state: "queued" }
  | { state: "running"; step: MakerStep }
  | { state: "failed"; step: MakerStep; message: string; detail?: string };

export function stepsDone(facts: LessonFacts, setup: MakerSetup): Record<MakerStep, boolean> {
  const exists = facts.exists;
  return {
    lesson: exists,
    exercises: !setup.exercisesReady || (exists && (facts.exercises ?? "none") !== "none"),
    guide: !setup.studyReady || (exists && Boolean(facts.linked)),
    link: !setup.studyReady || (exists && Boolean(facts.linked)),
  };
}

/** The steps the button still has to run, in order. The guide and its link always go together. */
export function missingSteps(facts: LessonFacts, setup: MakerSetup): MakerStep[] {
  const done = stepsDone(facts, setup);
  return MAKER_STEPS.filter((step) => !done[step]);
}

export type RowStatus =
  "new" | "queued" | "working" | "failed" | "incomplete" | "ready" | "published";

export const ROW_STATUS_TEXT: Record<RowStatus, string> = {
  new: "لسا",
  queued: "بالدور",
  working: "بينعمل",
  failed: "بدها إعادة",
  incomplete: "ناقص",
  ready: "جاهز",
  published: "منشور",
};

export function rowStatus(facts: LessonFacts, setup: MakerSetup, run?: RunState): RowStatus {
  if (run?.state === "running") return "working";
  if (run?.state === "queued") return "queued";
  if (run?.state === "failed") return "failed";
  if (!facts.exists) return "new";
  if (missingSteps(facts, setup).length) return "incomplete";
  return facts.status === "published" ? "published" : "ready";
}

/** The row's one button. */
export type RowAction = "make" | "continue" | "retry" | "publish" | "open" | null;

export function rowAction(status: RowStatus): RowAction {
  switch (status) {
    case "new":
      return "make";
    case "incomplete":
      return "continue";
    case "failed":
      return "retry";
    case "ready":
      return "publish";
    case "published":
      return "open";
    default:
      return null;
  }
}

export const ACTION_TEXT: Record<Exclude<RowAction, null>, string> = {
  make: "اصنع",
  continue: "كمّل",
  retry: "أعِد",
  publish: "انشر",
  open: "افتح",
};

/** The step a running row shows as current, and the ones before it as done. */
export function pipelineView(
  facts: LessonFacts,
  setup: MakerSetup,
  run: RunState | undefined,
): { step: MakerStep; state: "done" | "now" | "failed" | "todo" }[] {
  const done = stepsDone(facts, setup);
  const current = run && run.state !== "queued" ? run.step : null;
  const currentIndex = current ? MAKER_STEPS.indexOf(current) : -1;
  return MAKER_STEPS.filter((step) => setup.studyReady || (step !== "guide" && step !== "link"))
    .filter((step) => setup.exercisesReady || step !== "exercises")
    .map((step) => {
      const index = MAKER_STEPS.indexOf(step);
      if (current && index === currentIndex) {
        return { step, state: run?.state === "failed" ? ("failed" as const) : ("now" as const) };
      }
      if (done[step] || (current && index < currentIndex)) return { step, state: "done" as const };
      return { step, state: "todo" as const };
    });
}

/** One row of the book page: a lesson that exists, or a suggested one not made yet. */
export type BookRow = {
  key: string;
  lessonId: string | null;
  no: number | null;
  title: string;
  titleEn: string;
  topic: string;
  from: number;
  to: number;
};

export type LessonLike = {
  id: string;
  lesson_no: number;
  title: string;
  title_ar: string;
  topic: string;
  source_from_page: number;
  source_to_page: number;
  status: "draft" | "published" | "archived";
};

export const suggestionKey = (item: TopicSuggestion) =>
  `s:${item.topic}:${item.from_page}-${item.to_page}`;

/** Lessons and the suggestions not made yet, in one list in page order. Archived lessons are left out. */
export function bookRows(lessons: LessonLike[], suggestions: TopicSuggestion[]): BookRow[] {
  const rows: BookRow[] = lessons
    .filter((lesson) => lesson.status !== "archived")
    .map((lesson) => ({
      key: lesson.id,
      lessonId: lesson.id,
      no: lesson.lesson_no,
      title: lesson.title_ar || lesson.title,
      titleEn: lesson.title,
      topic: lesson.topic,
      from: lesson.source_from_page,
      to: lesson.source_to_page,
    }));
  for (const item of suggestions) {
    rows.push({
      key: suggestionKey(item),
      lessonId: null,
      no: null,
      title: item.title_ar || item.topic,
      titleEn: item.topic,
      topic: item.topic,
      from: item.from_page,
      to: item.to_page,
    });
  }
  return rows.sort(
    (a, b) =>
      a.from - b.from ||
      a.to - b.to ||
      // A made lesson before a suggestion on the same pages.
      Number(a.lessonId === null) - Number(b.lessonId === null) ||
      (a.no ?? 0) - (b.no ?? 0),
  );
}

/** The rows the hero button makes: everything not finished, in page order. */
export function makeAllQueue(statuses: { key: string; status: RowStatus }[]): string[] {
  return statuses
    .filter((row) => row.status === "new" || row.status === "incomplete" || row.status === "failed")
    .map((row) => row.key);
}

/** The counts under the book title, and one segment per row for the thin bar. */
export function bookSummary(statuses: RowStatus[]): {
  published: number;
  ready: number;
  working: number;
  left: number;
  segments: ("published" | "ready" | "working" | "left")[];
} {
  const segments = statuses.map((status) =>
    status === "published"
      ? ("published" as const)
      : status === "ready"
        ? ("ready" as const)
        : status === "working" || status === "queued"
          ? ("working" as const)
          : ("left" as const),
  );
  const count = (value: (typeof segments)[number]) => segments.filter((s) => s === value).length;
  return {
    published: count("published"),
    ready: count("ready"),
    working: count("working"),
    left: count("left"),
    segments,
  };
}

/** A guide covers at most 10 pages, like a lesson. */
export function guidePages(from: number, to: number): { fromPage: number; toPage: number } {
  return { fromPage: from, toPage: Math.max(from, Math.min(to, from + 9)) };
}
