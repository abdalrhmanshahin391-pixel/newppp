// Lesson-with-exercises operations, runtime-neutral. Runs inside the `rita-lesson-run` Edge
// Function (which holds the server key), never in the browser. `db` is the server connection used
// for protected tables (contents, runs, results, progress) and is always scoped by hand to
// `userId`; `userDb` is the caller's own connection, so RLS decides which lessons they may see.
// Keep imports relative with `.ts` and pure: this file is copied into supabase/functions/_shared.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLessonContent, type LessonContent } from "./rita-lesson-content.ts";
import { initialState, stepOf, type RunState } from "./rita-lesson-engine.ts";
import {
  ChannelSchema,
  ClientEventSchema,
  ResponseSchema,
  SAMPLE_LESSONS,
  SampleKeySchema,
  applyAnswer,
  applyClientEvent,
  newSeed,
  progressPatch,
  runStatusOf,
  type RunView,
} from "./rita-lesson-run.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, "public", any>;
export type LessonDeps = { db: Db; userDb: Db; userId: string };

export class LessonRunError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function fail(error: { message?: string } | null, label: string): asserts error is null {
  if (error) {
    console.error(`rita-lesson-run ${label}:`, error.message);
    throw new LessonRunError("database_error", 500, "Something went wrong saving this lesson.");
  }
}

async function isAdmin(deps: LessonDeps): Promise<boolean> {
  const { data, error } = await deps.userDb.rpc("has_role", {
    _user_id: deps.userId,
    _role: "admin",
  });
  return !error && Boolean(data);
}

type RunRow = {
  id: string;
  user_id: string;
  lesson_id: string | null;
  sample: string | null;
  content: unknown;
  state: RunState;
  revision: number;
  status: string;
  preview: boolean;
};

const RUN_COLUMNS = "id, user_id, lesson_id, sample, content, state, revision, status, preview";

type LessonMeta = { title: string; title_ar: string };

/** The only shape that leaves the server: the current public step, never the content. */
export function viewOf(row: RunRow, content: LessonContent, meta: LessonMeta): RunView {
  return {
    run_id: row.id,
    step: stepOf(content, row.state),
    status: runStatusOf(row.state),
    title: meta.title,
    title_ar: meta.title_ar,
    estimated_minutes: content.estimated_minutes,
    section_count: content.sections.length,
    intro_ar: content.intro_ar,
    intro_en: content.intro_en,
    language: content.language,
  };
}

function sampleMeta(key: string): LessonMeta {
  return key === "property"
    ? { title: "Sample: property", title_ar: "درس تجريبي: كلمات البيت" }
    : { title: "Sample: am / is / are", title_ar: "درس تجريبي: am / is / are" };
}

async function lessonMeta(db: Db, row: RunRow): Promise<LessonMeta> {
  if (row.sample) return sampleMeta(row.sample);
  const { data } = await db
    .from("rita_lessons")
    .select("title, title_ar")
    .eq("id", row.lesson_id)
    .maybeSingle();
  return { title: String(data?.title ?? "Lesson"), title_ar: String(data?.title_ar ?? "") };
}

function contentOf(row: RunRow): LessonContent {
  const content = parseLessonContent(row.content);
  if (!content) throw new LessonRunError("bad_content", 500, "This lesson's exercises could not be read.");
  return content;
}

async function loadRun(db: Db, userId: string, runId: string): Promise<RunRow> {
  const { data, error } = await db
    .from("rita_lesson_runs")
    .select(RUN_COLUMNS)
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  fail(error, "lesson run");
  if (!data) throw new LessonRunError("run_not_found", 404, "This lesson attempt was not found.");
  return data as RunRow;
}

export const StartInput = z
  .object({
    lessonId: z.string().uuid().optional(),
    sample: SampleKeySchema.optional(),
    restart: z.boolean().default(false),
    preview: z.boolean().default(false),
  })
  .refine((value) => Boolean(value.lessonId) !== Boolean(value.sample), "lessonId or sample");

export const EventInput = z.object({
  runId: z.string().uuid(),
  revision: z.number().int().min(1),
  event: ClientEventSchema,
});

export const AnswerInput = z.object({
  runId: z.string().uuid(),
  revision: z.number().int().min(1),
  itemId: z.string().max(48),
  response: ResponseSchema,
  channel: ChannelSchema,
});

export type StartRunResult = { available: false } | ({ available: true } & RunView);
export type EventResult = RunView & { rejected: string | null };
export type AnswerResult = EventResult & { grade: "correct" | "wrong" | "unclear" | null };

export async function startRun(
  deps: LessonDeps,
  data: z.infer<typeof StartInput>,
): Promise<StartRunResult> {
  const { db, userDb, userId } = deps;
  const preview = data.preview || Boolean(data.sample);
  if (preview && !(await isAdmin(deps))) {
    throw new LessonRunError("forbidden", 403, "Forbidden: admin only");
  }

  let content: LessonContent;
  let contentVersion = 1;
  if (data.sample) {
    content = SAMPLE_LESSONS[data.sample];
  } else {
    // The learner's own connection confirms they may see this lesson (RLS hides drafts).
    const { data: lesson, error } = await userDb
      .from("rita_lessons")
      .select("id, status")
      .eq("id", data.lessonId)
      .maybeSingle();
    fail(error, "lesson");
    if (!lesson) throw new LessonRunError("lesson_not_found", 404, "This lesson is not available.");
    if (lesson.status !== "published" && !(preview && lesson.status === "draft")) {
      throw new LessonRunError("lesson_unavailable", 403, "This lesson is not available.");
    }
    const { data: stored, error: contentError } = await db
      .from("rita_lesson_contents")
      .select("content, version, status")
      .eq("lesson_id", data.lessonId)
      .maybeSingle();
    if (contentError || !stored) return { available: false };
    if (stored.status !== "published" && !preview) return { available: false };
    const parsed = parseLessonContent(stored.content);
    if (!parsed) return { available: false };
    content = parsed;
    contentVersion = Number(stored.version) || 1;
  }

  let query = db
    .from("rita_lesson_runs")
    .select(RUN_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("preview", preview)
    .order("started_at", { ascending: false })
    .limit(1);
  query = data.sample ? query.eq("sample", data.sample) : query.eq("lesson_id", data.lessonId!);
  const { data: open, error: openError } = await query;
  fail(openError, "lesson run");
  const existing = (open?.[0] as RunRow | undefined) ?? null;

  if (existing && !data.restart) {
    return {
      available: true,
      ...viewOf(existing, contentOf(existing), await lessonMeta(db, existing)),
    };
  }
  if (existing) {
    const { error: closeError } = await db
      .from("rita_lesson_runs")
      .update({ status: "abandoned" })
      .eq("id", existing.id)
      .eq("user_id", userId);
    fail(closeError, "restart lesson");
  }

  const state = initialState(content, newSeed());
  const { data: created, error: insertError } = await db
    .from("rita_lesson_runs")
    .insert({
      user_id: userId,
      lesson_id: data.lessonId ?? null,
      sample: data.sample ?? null,
      content_version: contentVersion,
      content,
      state,
      revision: state.revision,
      preview,
    })
    .select(RUN_COLUMNS)
    .single();
  fail(insertError, "start lesson");
  const row = created as RunRow;
  return { available: true, ...viewOf(row, content, await lessonMeta(db, row)) };
}

async function saveState(db: Db, row: RunRow, state: RunState): Promise<boolean> {
  const status = runStatusOf(state);
  const { data, error } = await db
    .from("rita_lesson_runs")
    .update({
      state,
      revision: state.revision,
      status,
      completed_at: status === "active" ? null : new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id)
    .eq("revision", row.revision)
    .select("id");
  fail(error, "save lesson");
  return Boolean(data?.length);
}

async function recordCompletion(db: Db, row: RunRow, state: RunState) {
  if (row.preview || !row.lesson_id) return;
  const { data: previous } = await db
    .from("rita_lesson_progress")
    .select("id, best_score, stars, attempts")
    .eq("user_id", row.user_id)
    .eq("lesson_id", row.lesson_id)
    .maybeSingle();
  const now = new Date().toISOString();
  const patch = progressPatch(
    state,
    previous ? { best_score: Number(previous.best_score), stars: Number(previous.stars) } : null,
    now,
  );
  if (!patch) return;
  if (previous) {
    const { error } = await db
      .from("rita_lesson_progress")
      .update(patch)
      .eq("id", previous.id)
      .eq("user_id", row.user_id);
    fail(error, "save progress");
  } else {
    const { error } = await db.from("rita_lesson_progress").insert({
      user_id: row.user_id,
      lesson_id: row.lesson_id,
      started_at: now,
      ...patch,
    });
    fail(error, "save progress");
  }
}

async function finish(
  db: Db,
  row: RunRow,
  content: LessonContent,
  next: RunState | null,
  rejected: string | null,
): Promise<EventResult> {
  if (next && next !== row.state) {
    const saved = await saveState(db, row, next);
    if (!saved) {
      const fresh = await loadRun(db, row.user_id, row.id);
      return { ...viewOf(fresh, content, await lessonMeta(db, fresh)), rejected: "stale" };
    }
    if (runStatusOf(next) === "completed") await recordCompletion(db, row, next);
    return {
      ...viewOf({ ...row, state: next, revision: next.revision }, content, await lessonMeta(db, row)),
      rejected,
    };
  }
  return { ...viewOf(row, content, await lessonMeta(db, row)), rejected };
}

export async function sendEvent(
  deps: LessonDeps,
  data: z.infer<typeof EventInput>,
): Promise<EventResult> {
  const row = await loadRun(deps.db, deps.userId, data.runId);
  const content = contentOf(row);
  const transition = applyClientEvent(content, row.state, data.event, data.revision);
  if (!transition.ok) return finish(deps.db, row, content, null, transition.reason);
  return finish(deps.db, row, content, transition.changed ? transition.state : row.state, null);
}

export async function answerItem(
  deps: LessonDeps,
  data: z.infer<typeof AnswerInput>,
): Promise<AnswerResult> {
  const { db, userId } = deps;
  const row = await loadRun(db, userId, data.runId);
  const content = contentOf(row);
  const outcome = applyAnswer(content, row.state, {
    item_id: data.itemId,
    revision: data.revision,
    response: data.response,
    channel: data.channel,
  });
  if (!outcome.ok) {
    return { ...(await finish(db, row, content, null, outcome.reason)), grade: null };
  }
  const result = await finish(db, row, content, outcome.state, null);
  if (result.rejected) return { ...result, grade: null };
  const { error } = await db
    .from("rita_lesson_item_results")
    .insert({ run_id: row.id, user_id: userId, ...outcome.row });
  if (error) console.warn("Lesson answer could not be logged", error.message);
  return { ...result, grade: outcome.grade.status };
}
