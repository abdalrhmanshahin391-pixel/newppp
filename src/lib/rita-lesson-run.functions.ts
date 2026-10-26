// Server functions for lessons with exercises (content version 2). The page and Rita's worker go
// through these; the learner's browser never reads the content (it holds the answers) and never
// writes a run or a result. Everything is loaded and saved with the server key, scoped by hand to
// the signed-in learner; the rules themselves live in rita-lesson-run.ts and the engine.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { parseLessonContent, type LessonContent } from "@/lib/rita-lesson-content";
import { initialState, stepOf, type RunState } from "@/lib/rita-lesson-engine";
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
} from "@/lib/rita-lesson-run";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthContext = { supabase: SupabaseClient<any, "public", any>; userId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

async function serverDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  return supabaseAdmin as unknown as Db;
}

/**
 * Exercise content is intentionally server-only because it contains answer keys. Some Lovable
 * deployments do not provide the service-role connection used by this legacy server function.
 * In that case the lesson page must keep its normal spoken-lesson path instead of presenting the
 * learner with an implementation error. Do not broaden this catch: real database failures should
 * remain visible to us.
 */
function lessonBackendIsUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Missing server-only Lovable Cloud secret: SUPABASE_SERVICE_ROLE_KEY")
  );
}

async function isAdmin(ctx: AuthContext): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  return !error && Boolean(data);
}

function fail(error: { message?: string } | null, label: string): asserts error is null {
  if (error) throw new Error(`${label}: ${error.message ?? "database error"}`);
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

function viewOf(row: RunRow, content: LessonContent, meta: LessonMeta): RunView {
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
  if (!content) throw new Error("This lesson's exercises could not be read.");
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
  if (!data) throw new Error("This lesson attempt was not found.");
  return data as RunRow;
}

export type StartRunResult = { available: false } | ({ available: true } & RunView);

/**
 * Opens (or resumes) a lesson with exercises. A lesson without published version 2 content answers
 * { available: false } and the page keeps the spoken lesson. An admin can preview a draft or one of
 * the built-in sample lessons; previews never touch the learner's progress.
 */
export const startLessonRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        lessonId: z.string().uuid().optional(),
        sample: SampleKeySchema.optional(),
        restart: z.boolean().default(false),
        preview: z.boolean().default(false),
      })
      .refine((value) => Boolean(value.lessonId) !== Boolean(value.sample), "lessonId or sample")
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<StartRunResult> => {
    const ctx = context as AuthContext;
    let db: Db;
    try {
      db = await serverDb();
    } catch (error) {
      // The exercise backend is optional until it has a secure server runtime. Returning this
      // keeps Rita's spoken lesson usable while preserving the protected content and its RLS.
      if (lessonBackendIsUnavailable(error)) return { available: false };
      throw error;
    }
    const preview = data.preview || Boolean(data.sample);
    if (preview && !(await isAdmin(ctx))) throw new Error("Forbidden: admin only");

    let content: LessonContent;
    let contentVersion = 1;
    if (data.sample) {
      content = SAMPLE_LESSONS[data.sample];
    } else {
      // The learner's own client confirms they may see this lesson (RLS hides drafts).
      const { data: lesson, error } = await ctx.supabase
        .from("rita_lessons")
        .select("id, status")
        .eq("id", data.lessonId)
        .maybeSingle();
      fail(error, "lesson");
      if (!lesson || (lesson.status !== "published" && !(preview && lesson.status === "draft"))) {
        throw new Error("This lesson is not available.");
      }
      const { data: stored, error: contentError } = await db
        .from("rita_lesson_contents")
        .select("content, version, status")
        .eq("lesson_id", data.lessonId)
        .maybeSingle();
      // Before the migration is applied the table is missing: the spoken lesson carries on.
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
      .eq("user_id", ctx.userId)
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
        .eq("user_id", ctx.userId);
      fail(closeError, "restart lesson");
    }

    const state = initialState(content, newSeed());
    const { data: created, error: insertError } = await db
      .from("rita_lesson_runs")
      .insert({
        user_id: ctx.userId,
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
  });

/**
 * Saves the new state only if nobody saved a newer one in between (the stored revision must still
 * be the one this change started from). Returns false when another answer won the race.
 */
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

/** A finished real lesson updates the learner's progress, so the lesson map shows it as done. */
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

export type EventResult = RunView & { rejected: string | null };

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
      ...viewOf(
        { ...row, state: next, revision: next.revision },
        content,
        await lessonMeta(db, row),
      ),
      rejected,
    };
  }
  return { ...viewOf(row, content, await lessonMeta(db, row)), rejected };
}

/** Ready, a question, pause, hint and the other non-answer events. */
export const sendLessonEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        revision: z.number().int().min(1),
        event: ClientEventSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<EventResult> => {
    const ctx = context as AuthContext;
    const db = await serverDb();
    const row = await loadRun(db, ctx.userId, data.runId);
    const content = contentOf(row);
    const transition = applyClientEvent(content, row.state, data.event, data.revision);
    if (!transition.ok) return finish(db, row, content, null, transition.reason);
    return finish(db, row, content, transition.changed ? transition.state : row.state, null);
  });

export type AnswerResult = EventResult & { grade: "correct" | "wrong" | "unclear" | null };

/** One answer, graded here. The answer and the explanation come back only once the item is settled. */
export const answerLessonItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        revision: z.number().int().min(1),
        itemId: z.string().max(48),
        response: ResponseSchema,
        channel: ChannelSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<AnswerResult> => {
    const ctx = context as AuthContext;
    const db = await serverDb();
    const row = await loadRun(db, ctx.userId, data.runId);
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
      .insert({ run_id: row.id, user_id: ctx.userId, ...outcome.row });
    // The answer is already applied; a lost result row only costs a diagnostic, never the lesson.
    if (error) console.warn("Lesson answer could not be logged", error.message);
    return { ...result, grade: outcome.grade.status };
  });
