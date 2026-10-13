import type { CorrectionRecord } from "./rita-correction.ts";
import { normalizeForMatch } from "./rita-correction.ts";
import type { LearningItem } from "./rita-learning.ts";

export type LessonSummary = {
  durationMs: number;
  /** Time the learner actually spoke, from the voice activity events. */
  speakMs: number;
  turns: number;
  newWords: LearningItem[];
  corrections: CorrectionRecord[];
  /** Same phrase corrected more than once, or retried and still not fixed. */
  repeated: CorrectionRecord[];
  retries: { attempted: number; fixed: number };
  nextGoal: string;
};

export type SummaryInput = {
  startedAt: number;
  endedAt: number;
  speakMs: number;
  turns: number;
  learning: LearningItem[];
  corrections: CorrectionRecord[];
};

export function formatMinutes(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1_000));
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest >= 30 && minutes < 10 ? `${minutes + 1} min` : `${minutes} min`;
}

export function buildSummary(input: SummaryInput): LessonSummary {
  const byPhrase = new Map<string, CorrectionRecord[]>();
  for (const record of input.corrections) {
    const key = normalizeForMatch(record.better);
    byPhrase.set(key, [...(byPhrase.get(key) ?? []), record]);
  }
  const repeated = [...byPhrase.values()].flatMap((records) => {
    const first = records[0];
    const unresolved =
      records.every((record) => !record.fixed) && records.some((record) => record.attempts >= 1);
    return records.length >= 2 || unresolved ? [first] : [];
  });
  const retried = input.corrections.filter((record) => record.attempts > 0);
  const unfinished = input.corrections.find((record) => !record.fixed);
  const nextGoal = unfinished
    ? `Say it again: “${unfinished.better}”`
    : input.learning.length
      ? `Review ${input.learning.length} new ${input.learning.length === 1 ? "item" : "items"} from today`
      : "Start a guided lesson and build on today";
  return {
    durationMs: Math.max(0, input.endedAt - input.startedAt),
    speakMs: Math.max(0, input.speakMs),
    turns: input.turns,
    newWords: input.learning,
    corrections: input.corrections,
    repeated,
    retries: {
      attempted: retried.length,
      fixed: retried.filter((record) => record.fixed).length,
    },
    nextGoal,
  };
}
