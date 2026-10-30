// The green lesson (guide + Rita), made in one press: the lesson, its exercises, its PDF guide, then
// the guide checked and linked. These rules say which steps are still missing and what the step line
// shows; the two kinds' names and colours live with the book page. Pure, so they are unit tested
// with node. The state comes from the database each time, so a closed page resumes where it stopped.
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

/** One lesson to make: a suggestion not made yet (no id), or a made lesson to finish. */
export type BookRow = {
  key: string;
  lessonId: string | null;
  title: string;
  titleEn: string;
  topic: string;
  from: number;
  to: number;
};

export type LessonKind = "classic" | "study";

/** The two kinds, as the admin sees them: red for Rita's lesson, green for the guide + Rita. */
export const KIND_TEXT: Record<LessonKind, { name: string; short: string; about: string }> = {
  classic: {
    name: "درس ريتا",
    short: "ريتا",
    about: "ريتا بتشرح وبتعطي تمارين، مثل ما كانت الدروس دايماً.",
  },
  study: {
    name: "ملف + ريتا",
    short: "ملف + ريتا",
    about: "دليل PDF يمين وريتا يسار. بينصنع الدرس وتمارينه ودليله وبينربط لحاله.",
  },
};

/**
 * A green lesson whose guide is not linked yet: learners still get the red lesson until it is, so
 * the review list offers to finish it. Without the study tables there is nothing to finish.
 */
export function needsGuide(kind: LessonKind, linked: boolean, studyReady: boolean): boolean {
  return studyReady && kind === "study" && !linked;
}

/** How many lessons of each kind, for the review filter. */
export function kindCounts(kinds: LessonKind[]): Record<LessonKind | "all", number> {
  return {
    all: kinds.length,
    classic: kinds.filter((kind) => kind === "classic").length,
    study: kinds.filter((kind) => kind === "study").length,
  };
}

/** A guide covers at most 10 pages, like a lesson. */
export function guidePages(from: number, to: number): { fromPage: number; toPage: number } {
  return { fromPage: from, toPage: Math.max(from, Math.min(to, from + 9)) };
}
