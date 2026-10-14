// Pure rules for Rita's curriculum lessons: the JSON shapes the AI must return,
// how far each book has been read and taught, and how a lesson is scored.
// No server or browser imports here so the rules can be unit tested with node.
import { z } from "zod";

/** The AI reads at most this many book pages per request. */
export const CURRICULUM_WINDOW_PAGES = 10;
/** Characters kept per page and per window when sending page text to the AI. */
export const PAGE_TEXT_LIMIT = 6_000;
export const WINDOW_TEXT_LIMIT = 48_000;
/** A lesson attempt stops asking the AI to judge answers after this many turns. */
export const MAX_EVALUATIONS_PER_ATTEMPT = 120;

const pageNo = z.number().int().min(1).max(5_000);
const shortText = (max: number) => z.string().trim().max(max);

export const VocabularyItemSchema = z.object({
  word: shortText(80).min(1),
  meaning_ar: shortText(120).default(""),
  example: shortText(200).default(""),
});
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;

export const WindowTopicSchema = z.object({
  title: shortText(160).min(1),
  title_ar: shortText(160).default(""),
  from_page: pageNo,
  to_page: pageNo,
  key_points: z.array(shortText(300).min(1)).max(12).default([]),
  examples: z.array(shortText(200).min(1)).max(12).default([]),
  vocabulary: z.array(VocabularyItemSchema).max(40).default([]),
});

export const WindowSummarySchema = z.object({
  overview: shortText(1_200).min(1),
  overview_ar: shortText(1_200).default(""),
  topics: z.array(WindowTopicSchema).min(1).max(20),
  suggested_lessons: z
    .array(
      z.object({
        topic: shortText(160).min(1),
        title_ar: shortText(160).default(""),
        from_page: pageNo,
        to_page: pageNo,
      }),
    )
    .max(12)
    .default([]),
  /** true when the last topic carries on past this window */
  continues_next_window: z.boolean().default(false),
});
export type WindowSummary = z.infer<typeof WindowSummarySchema>;

export const ObjectiveSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9][a-z0-9-]{0,39}$/,
      "objective id must be lowercase letters, digits and dashes",
    ),
  text: shortText(240).min(3),
  text_ar: shortText(240).default(""),
  /** what the learner must say or do for the objective to count as met */
  criteria: shortText(400).min(3),
  /** questions Rita can ask to check the objective */
  check_prompts: z.array(shortText(240).min(1)).min(1).max(4),
  weight: z.number().int().min(1).max(5).default(1),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

export const LESSON_PHASES = ["warmup", "teach", "practice", "check", "wrap"] as const;

export const LessonPlanSchema = z.object({
  phases: z
    .array(
      z.object({
        phase: z.enum(LESSON_PHASES),
        minutes: z.number().min(1).max(10),
        steps: z.array(shortText(240).min(1)).min(1).max(6),
      }),
    )
    .min(2)
    .max(6),
  teacher_notes: shortText(1_200).default(""),
});
export type LessonPlan = z.infer<typeof LessonPlanSchema>;

export const LessonDraftSchema = z
  .object({
    title: shortText(160).min(1),
    title_ar: shortText(160).default(""),
    topic: shortText(160).min(1),
    source_from_page: pageNo,
    source_to_page: pageNo,
    summary: shortText(1_500).default(""),
    objectives: z.array(ObjectiveSchema).min(2).max(6),
    plan: LessonPlanSchema,
    vocabulary: z.array(VocabularyItemSchema).max(30).default([]),
    image_prompt: shortText(400).default(""),
  })
  .superRefine((lesson, ctx) => {
    if (lesson.source_to_page < lesson.source_from_page) {
      ctx.addIssue({
        code: "custom",
        path: ["source_to_page"],
        message: "to page is before from page",
      });
    }
    const seen = new Set<string>();
    lesson.objectives.forEach((objective, index) => {
      if (seen.has(objective.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["objectives", index, "id"],
          message: "duplicate objective id",
        });
      }
      seen.add(objective.id);
    });
  });
export type LessonDraft = z.infer<typeof LessonDraftSchema>;

export const EvaluationSchema = z.object({
  updates: z
    .array(
      z.object({
        objective_id: z.string().trim().min(1).max(40),
        met: z.boolean(),
        quality: z.number().min(0).max(1),
        /** the learner's own words, quoted exactly */
        evidence: shortText(240).default(""),
      }),
    )
    .max(6)
    .default([]),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export type ObjectiveProgress = { met: boolean; quality: number; evidence: string; at: string };
export type ObjectiveState = Record<string, ObjectiveProgress>;

export type CurriculumCursor = { page_count: number; read_cursor: number; taught_cursor: number };

/** Formats a zod error into one short line an admin can act on. */
export function describeSchemaError(error: z.ZodError): string {
  const first = error.issues.slice(0, 3).map((issue) => {
    const where = issue.path.length ? issue.path.join(".") : "root";
    return `${where}: ${issue.message}`;
  });
  return first.join("; ");
}

/** The next unread window, or null when the whole book has been read. */
export function nextWindow(cursor: Pick<CurriculumCursor, "page_count" | "read_cursor">) {
  if (cursor.read_cursor >= cursor.page_count) return null;
  const from = cursor.read_cursor + 1;
  const to = Math.min(cursor.page_count, cursor.read_cursor + CURRICULUM_WINDOW_PAGES);
  return { from, to };
}

/**
 * Checks a window before it is read or imported. Windows are read in order so
 * the read cursor never skips pages; reading an earlier window again is allowed
 * (it replaces that summary) but does not move the cursor.
 */
export function checkWindow(
  cursor: Pick<CurriculumCursor, "page_count" | "read_cursor">,
  from: number,
  to: number,
): { ok: true; advancesTo: number } | { ok: false; reason: string } {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return { ok: false, reason: "invalid page range" };
  }
  if (to - from + 1 > CURRICULUM_WINDOW_PAGES) {
    return { ok: false, reason: `at most ${CURRICULUM_WINDOW_PAGES} pages per window` };
  }
  if (to > cursor.page_count) return { ok: false, reason: "range goes past the last page" };
  if (from > cursor.read_cursor + 1) {
    return { ok: false, reason: `read pages in order: the next page is ${cursor.read_cursor + 1}` };
  }
  return { ok: true, advancesTo: Math.max(cursor.read_cursor, to) };
}

/** Topic page ranges must stay inside the window that was read. */
export function checkSummaryPages(summary: WindowSummary, from: number, to: number): string | null {
  const ranges = [...summary.topics, ...summary.suggested_lessons];
  for (const range of ranges) {
    if (range.from_page < from || range.to_page > to || range.to_page < range.from_page) {
      return `pages ${range.from_page}-${range.to_page} are outside the window ${from}-${to}`;
    }
  }
  return null;
}

/** A lesson may only use pages the AI has already read. */
export function checkLessonPages(
  cursor: Pick<CurriculumCursor, "read_cursor">,
  from: number,
  to: number,
): string | null {
  if (to < from) return "to page is before from page";
  if (to > cursor.read_cursor) {
    return `page ${to} has not been read yet (read up to page ${cursor.read_cursor})`;
  }
  return null;
}

/** Publishing a lesson moves the taught cursor forward, never past the read cursor. */
export function taughtCursorAfterPublish(
  cursor: Pick<CurriculumCursor, "read_cursor" | "taught_cursor">,
  lessonToPage: number,
): number {
  return Math.min(cursor.read_cursor, Math.max(cursor.taught_cursor, lessonToPage));
}

export function cursorLabelAr(cursor: CurriculumCursor): string {
  if (!cursor.page_count) return "لم تُرفع صفحات بعد";
  return `قُرئ حتى ص${cursor.read_cursor} من ${cursor.page_count}، والدروس تغطي حتى ص${cursor.taught_cursor}`;
}

export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** Joins page text for the AI with page markers, trimmed to the size limits. */
export function buildWindowText(
  pages: { page_no: number; text: string }[],
  from: number,
  to: number,
) {
  let total = 0;
  const parts: string[] = [];
  const sorted = [...pages]
    .filter((page) => page.page_no >= from && page.page_no <= to)
    .sort((a, b) => a.page_no - b.page_no);
  for (const page of sorted) {
    const text = page.text.replace(/\s+\n/g, "\n").trim().slice(0, PAGE_TEXT_LIMIT);
    const block = `=== Page ${page.page_no} ===\n${text || "(no text on this page)"}`;
    if (total + block.length > WINDOW_TEXT_LIMIT) break;
    parts.push(block);
    total += block.length;
  }
  return parts.join("\n\n");
}

function normaliseForQuote(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The evaluator must quote the learner. A "met" verdict whose evidence is not
 * in what the learner actually said is rejected, so the AI cannot invent answers.
 */
export function evidenceIsQuoted(evidence: string, learnerText: string): boolean {
  const quote = normaliseForQuote(evidence);
  if (quote.length < 2) return false;
  return normaliseForQuote(learnerText).includes(quote);
}

/**
 * Applies one evaluation to the stored state. Objectives only move forward:
 * once met they stay met, and quality keeps the best value seen.
 */
export function mergeObjectiveState(
  previous: ObjectiveState,
  evaluation: Evaluation,
  objectives: Pick<Objective, "id">[],
  learnerText: string,
  now: string,
): { state: ObjectiveState; newlyMet: string[] } {
  const known = new Set(objectives.map((objective) => objective.id));
  const state: ObjectiveState = { ...previous };
  const newlyMet: string[] = [];
  for (const update of evaluation.updates) {
    if (!known.has(update.objective_id) || !update.met) continue;
    if (!evidenceIsQuoted(update.evidence, learnerText)) continue;
    const quality = Math.max(0, Math.min(1, update.quality));
    const before = state[update.objective_id];
    if (before?.met) {
      if (quality > before.quality) {
        state[update.objective_id] = { ...before, quality, evidence: update.evidence, at: now };
      }
      continue;
    }
    state[update.objective_id] = { met: true, quality, evidence: update.evidence, at: now };
    newlyMet.push(update.objective_id);
  }
  return { state, newlyMet };
}

export function isLessonComplete(objectives: Pick<Objective, "id">[], state: ObjectiveState) {
  return (
    objectives.length > 0 && objectives.every((objective) => state[objective.id]?.met === true)
  );
}

/** 0-100: the weighted quality of met objectives. */
export function scoreLesson(objectives: Pick<Objective, "id" | "weight">[], state: ObjectiveState) {
  const totalWeight = objectives.reduce((sum, objective) => sum + objective.weight, 0);
  if (totalWeight <= 0) return 0;
  const earned = objectives.reduce((sum, objective) => {
    const progress = state[objective.id];
    return progress?.met ? sum + objective.weight * progress.quality : sum;
  }, 0);
  return Math.round((earned / totalWeight) * 100);
}

export function starsFor(score: number): 0 | 1 | 2 | 3 {
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  if (score >= 50) return 1;
  return 0;
}

export type PathNodeState = "done" | "current" | "locked";

/**
 * Lessons in path order. Completed lessons are done, the first unfinished one
 * is current and the rest are locked until the learner reaches them.
 */
export function lessonPathStates<T extends { id: string }>(
  lessons: T[],
  progress: Record<string, { status: string; stars: number } | undefined>,
): (T & { state: PathNodeState; stars: number })[] {
  let currentAssigned = false;
  return lessons.map((lesson) => {
    const row = progress[lesson.id];
    if (row?.status === "completed") return { ...lesson, state: "done", stars: row.stars };
    if (!currentAssigned) {
      currentAssigned = true;
      return { ...lesson, state: "current", stars: 0 };
    }
    return { ...lesson, state: "locked", stars: 0 };
  });
}

export type LessonBriefInput = {
  title: string;
  title_ar: string;
  topic: string;
  summary?: string;
  objectives: Objective[];
  plan: LessonPlan;
  vocabulary: VocabularyItem[];
};

/**
 * Compact lesson notes for the voice worker's system prompt. Unmet objectives
 * are listed first so a resumed lesson starts where the learner stopped.
 */
export function buildLessonBrief(
  lesson: LessonBriefInput,
  state: ObjectiveState = {},
  limit = 3_500,
) {
  const ordered = [...lesson.objectives].sort(
    (a, b) => Number(state[a.id]?.met === true) - Number(state[b.id]?.met === true),
  );
  const lines = [
    `Lesson: ${lesson.title}${lesson.title_ar ? ` (${lesson.title_ar})` : ""}`,
    `Topic: ${lesson.topic}`,
  ];
  if (lesson.summary) lines.push(`Teacher summary: ${lesson.summary}`);
  lines.push(
    "Objectives (teach and check each one; the learner must produce it in their own words):",
  );
  for (const objective of ordered) {
    const done = state[objective.id]?.met ? " [already met - only review briefly]" : "";
    lines.push(`- [${objective.id}] ${objective.text}${done}`);
    lines.push(`  Met when: ${objective.criteria}`);
    lines.push(`  Ask: ${objective.check_prompts.join(" | ")}`);
  }
  lines.push("Plan:");
  for (const phase of lesson.plan.phases) {
    lines.push(`- ${phase.phase} (~${phase.minutes} min): ${phase.steps.join("; ")}`);
  }
  if (lesson.plan.teacher_notes) lines.push(`Notes: ${lesson.plan.teacher_notes}`);
  if (lesson.vocabulary.length) {
    const words = lesson.vocabulary
      .slice(0, 20)
      .map((item) => (item.meaning_ar ? `${item.word} = ${item.meaning_ar}` : item.word));
    lines.push(`Vocabulary: ${words.join(", ")}`);
  }
  const text = lines.join("\n");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export type LessonTurn = { role: "user" | "assistant"; text: string };

/** Keeps the last few turns, trimmed, for the evaluator. */
export function cleanTurns(input: unknown, keep = 8): LessonTurn[] {
  if (!Array.isArray(input)) return [];
  const turns: LessonTurn[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const text = String((item as { text?: unknown }).text ?? "").trim();
    if ((role !== "user" && role !== "assistant") || !text) continue;
    turns.push({ role, text: text.slice(0, 600) });
  }
  return turns.slice(-keep);
}

/** Parses a JSON object out of a model reply that may be wrapped in a code fence. */
export function parseJsonObject(raw: string): unknown {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI reply had no JSON object.");
  return JSON.parse(trimmed.slice(start, end + 1));
}
