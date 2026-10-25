// The rules between the lesson engine and the database: which events the page may send, how an
// answer becomes a saved result, and what a finished run writes to the learner's progress.
// Pure, so the server functions only load and save; everything they decide is tested here.
import { z } from "zod";
import { findItem, type LessonContent } from "./rita-lesson-content.ts";
import {
  isFinished,
  lessonScore,
  lessonStars,
  reduce,
  stepOf,
  type LessonEvent,
  type LessonStep,
  type RunState,
  type Transition,
} from "./rita-lesson-engine.ts";
import { gradeItem, type Grade, type LearnerResponse } from "./rita-lesson-grader.ts";
import { SAMPLE_PROPERTY, SAMPLE_TO_BE } from "./rita-lesson-samples.ts";

export const SAMPLE_LESSONS = { to_be: SAMPLE_TO_BE, property: SAMPLE_PROPERTY } as const;
export type SampleKey = keyof typeof SAMPLE_LESSONS;
export const SampleKeySchema = z.enum(["to_be", "property"]);

/** Events the page may send. Answers go through their own call so the server grades them. */
export const ClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("no_question") }),
  z.object({ type: z.literal("question") }),
  z.object({ type: z.literal("repeat") }),
  z.object({ type: z.literal("off_topic") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("timeout") }),
  z.object({ type: z.literal("end") }),
  z.object({ type: z.literal("hint"), item_id: z.string().max(48) }),
  z.object({ type: z.literal("reveal"), item_id: z.string().max(48) }),
]);
export type ClientEvent = z.infer<typeof ClientEventSchema>;

export const ResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), value: z.string().max(120) }),
  z.object({ kind: z.literal("tiles"), order: z.array(z.string().max(8)).max(12) }),
  z.object({ kind: z.literal("spoken"), text: z.string().max(400) }),
]);

export const ChannelSchema = z.enum(["tap", "typed", "voice"]);
export type Channel = z.infer<typeof ChannelSchema>;

export type RunStatus = "active" | "completed" | "abandoned";

export function runStatusOf(state: RunState): RunStatus {
  if (state.phase !== "done") return "active";
  return isFinished(state) ? "completed" : "abandoned";
}

/** A fresh seed for a run: the order of options and tiles for this attempt. */
export function newSeed(random: () => number = Math.random): string {
  return Math.floor(random() * 2 ** 48).toString(36);
}

export function applyClientEvent(
  content: LessonContent,
  state: RunState,
  event: ClientEvent,
  revision: number,
): Transition {
  return reduce(content, state, event as LessonEvent, revision);
}

export type ItemResultRow = {
  item_id: string;
  skill_tag: string;
  phase: string;
  revision: number;
  channel: Channel;
  status: "correct" | "wrong" | "unclear" | "revealed";
  given: string;
  independent: boolean;
  hint_used: boolean;
  stt_suspect: boolean;
};

export type AnswerOutcome =
  | { ok: true; state: RunState; grade: Grade; row: ItemResultRow }
  | { ok: false; reason: string; state: RunState };

/**
 * Grades an answer on the server and moves the engine. The row is what is saved for this answer;
 * its revision is the step it answered, so a second answer to the same step is refused by the
 * database as well as by the engine.
 */
export function applyAnswer(
  content: LessonContent,
  state: RunState,
  input: { item_id: string; revision: number; response: LearnerResponse; channel: Channel },
): AnswerOutcome {
  const found = findItem(content, input.item_id);
  if (!found) return { ok: false, reason: "wrong_item", state };
  const grade = gradeItem(found.item, input.response, state.seed);
  const hintBefore = state.current?.hint ?? false;
  const triesBefore = state.current?.tries ?? 0;
  const transition = reduce(
    content,
    state,
    { type: "graded", item_id: input.item_id, grade },
    input.revision,
  );
  if (!transition.ok) return { ok: false, reason: transition.reason, state: transition.state };
  const next = transition.state;
  const feedback = next.last;
  const status: ItemResultRow["status"] =
    feedback?.status === "revealed" ? "revealed" : grade.status;
  return {
    ok: true,
    state: next,
    grade,
    row: {
      item_id: input.item_id,
      skill_tag: found.item.skill_tag,
      phase: state.phase,
      revision: input.revision,
      channel: input.channel,
      status,
      given: grade.given.slice(0, 400),
      independent: grade.status === "correct" && triesBefore === 0 && !hintBefore,
      hint_used: hintBefore,
      stt_suspect: grade.status === "unclear" && input.channel === "voice",
    },
  };
}

/** What a finished run writes to rita_lesson_progress; null while it is still open or was ended. */
export function progressPatch(
  state: RunState,
  previous: { best_score: number; stars: number } | null,
  now: string,
) {
  if (!isFinished(state)) return null;
  const score = lessonScore(state);
  const stars = lessonStars(state);
  return {
    status: "completed",
    score,
    best_score: Math.max(previous?.best_score ?? 0, score),
    stars: Math.max(previous?.stars ?? 0, stars),
    completed_at: now,
  };
}

export type RunView = {
  run_id: string;
  step: LessonStep;
  status: RunStatus;
  title: string;
  title_ar: string;
  estimated_minutes: number;
  intro_ar: string;
  intro_en: string;
  language: string;
};
