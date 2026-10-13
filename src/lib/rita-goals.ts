export type LessonModeName = "free_conversation" | "guided_lesson" | "pronunciation_drill";

export type LessonStats = {
  /** Final learner turns. */
  turns: number;
  /** Learner turns that contained German or English words. */
  targetTurns: number;
  /** Words or phrases collected in the learning tray. */
  items: number;
  /** Corrections the learner has tried to repeat. */
  retries: number;
  /** Corrections the learner repeated correctly. */
  fixed: number;
};

export type LessonTask = { id: string; label: string; done: boolean };
export type LessonGoal = { title: string; goal: string; tasks: LessonTask[] };

const COPY: Record<LessonModeName, { title: string; goal: string }> = {
  free_conversation: {
    title: "Conversation practice",
    goal: "Talk with Rita and pick up useful German or English as you go.",
  },
  guided_lesson: {
    title: "Guided lesson",
    goal: "Follow Rita's steps: one idea at a time, with a chance to repeat it.",
  },
  pronunciation_drill: {
    title: "Pronunciation drill",
    goal: "Say one word or phrase at a time and fix the sound that matters most.",
  },
};

/** Three small tasks per mode. Progress comes from what the learner actually did. */
export function lessonGoal(mode: LessonModeName, stats: LessonStats): LessonGoal {
  const copy = COPY[mode] ?? COPY.free_conversation;
  const tasks: LessonTask[] =
    mode === "pronunciation_drill"
      ? [
          { id: "say", label: "Say your first word or phrase", done: stats.targetTurns >= 1 },
          { id: "retry", label: "Repeat it after a correction", done: stats.retries >= 1 },
          { id: "fixed", label: "Get one phrase right", done: stats.fixed >= 1 },
        ]
      : mode === "guided_lesson"
        ? [
            { id: "answer", label: "Answer Rita's first question", done: stats.turns >= 1 },
            { id: "learn", label: "Learn two new words or phrases", done: stats.items >= 2 },
            { id: "fixed", label: "Repeat one corrected phrase", done: stats.fixed >= 1 },
          ]
        : [
            {
              id: "say",
              label: "Say something in German or English",
              done: stats.targetTurns >= 1,
            },
            { id: "learn", label: "Collect a new word or phrase", done: stats.items >= 1 },
            { id: "fixed", label: "Fix one correction", done: stats.fixed >= 1 },
          ];
  return { ...copy, tasks };
}

export function goalProgress(goal: LessonGoal) {
  const done = goal.tasks.filter((task) => task.done).length;
  return {
    done,
    total: goal.tasks.length,
    ratio: goal.tasks.length ? done / goal.tasks.length : 0,
  };
}
