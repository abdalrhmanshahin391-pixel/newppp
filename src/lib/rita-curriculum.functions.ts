// Server functions for Rita's curriculum lessons.
// Admin functions check the admin role and then use the service role. Learner
// functions read through RLS, and lesson progress is written only here with the
// service role so learners cannot award themselves marks.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import {
  LessonDraftSchema,
  MAX_EVALUATIONS_PER_ATTEMPT,
  WindowSummarySchema,
  buildWindowText,
  checkLessonPages,
  checkSummaryPages,
  checkWindow,
  cleanTurns,
  describeSchemaError,
  isLessonComplete,
  lessonPathStates,
  mergeObjectiveState,
  scoreLesson,
  starsFor,
  taughtCursorAfterPublish,
  type LessonDraft,
  type Objective,
  type ObjectiveState,
  type PathNodeState,
  type WindowSummary,
} from "@/lib/rita-curriculum";

type AuthContext = { supabase: any; userId: string };

async function assertAdmin(ctx: AuthContext) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: admin only");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  return supabaseAdmin;
}

async function ai() {
  return import("@/lib/rita-curriculum-ai.server");
}

function fail(error: { message?: string } | null, label: string): asserts error is null {
  if (error) throw new Error(`${label}: ${error.message ?? "database error"}`);
}

const uuid = z.string().uuid();
const kindSchema = z.enum(["grammar", "vocabulary"]);
const imageUrlSchema = z
  .string()
  .trim()
  .max(600)
  .refine((value) => value.startsWith("/curriculum/") || value.startsWith("https://"), "image url must be https or /curriculum/");

function parseWith<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(describeSchemaError(result.error));
  return result.data;
}

// ---------- shapes shared with the UI ----------

export type CurriculumRow = {
  id: string;
  kind: "grammar" | "vocabulary";
  title: string;
  title_ar: string | null;
  level: string;
  pdf_path: string | null;
  page_count: number;
  read_cursor: number;
  taught_cursor: number;
  image_url: string | null;
  status: "draft" | "published" | "archived";
  created_at: string;
};

export type WindowRow = {
  id: string;
  curriculum_id: string;
  from_page: number;
  to_page: number;
  summary: WindowSummary;
  source: "ai" | "manual";
  model: string | null;
  created_at: string;
};

export type LessonRow = {
  id: string;
  curriculum_id: string;
  lesson_no: number;
  path_order: number | null;
  title: string;
  title_ar: string;
  topic: string;
  source_from_page: number;
  source_to_page: number;
  objectives: Objective[];
  plan: LessonDraft["plan"];
  vocabulary: LessonDraft["vocabulary"];
  image_url: string | null;
  image_prompt: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  source: "ai" | "manual";
  model: string | null;
  updated_at: string;
};

const CURRICULUM_COLUMNS =
  "id, kind, title, title_ar, level, pdf_path, page_count, read_cursor, taught_cursor, image_url, status, created_at";
const LESSON_COLUMNS =
  "id, curriculum_id, lesson_no, path_order, title, title_ar, topic, source_from_page, source_to_page, objectives, plan, vocabulary, image_url, image_prompt, status, version, source, model, updated_at";

// ---------- admin: books ----------

export const adminCurriculumOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const [books, windows, lessons, pages] = await Promise.all([
      db.from("rita_curricula").select(CURRICULUM_COLUMNS).neq("status", "archived").order("created_at"),
      db
        .from("rita_curriculum_windows")
        .select("id, curriculum_id, from_page, to_page, summary, source, model, created_at")
        .order("from_page"),
      db.from("rita_lessons").select(LESSON_COLUMNS).neq("status", "archived").order("lesson_no"),
      db.from("rita_curriculum_pages").select("curriculum_id, page_no, has_text_layer, text"),
    ]);
    fail(books.error, "books");
    fail(windows.error, "windows");
    fail(lessons.error, "lessons");
    fail(pages.error, "pages");
    // Per book: which pages still need text (scanned pages that were not read yet).
    const missingText: Record<string, number[]> = {};
    for (const page of (pages.data ?? []) as { curriculum_id: string; page_no: number; text: string }[]) {
      if (page.text.trim().length >= 20) continue;
      (missingText[page.curriculum_id] ??= []).push(page.page_no);
    }
    return {
      curricula: (books.data ?? []) as CurriculumRow[],
      windows: (windows.data ?? []) as WindowRow[],
      lessons: (lessons.data ?? []) as LessonRow[],
      missingText,
    };
  });

export const adminCreateCurriculum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z.object({
        kind: kindSchema,
        title: z.string().trim().min(1).max(160),
        title_ar: z.string().trim().max(160).default(""),
        page_count: z.number().int().min(1).max(5_000),
        pdf_path: z.string().trim().max(400).nullable().default(null),
      }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: row, error } = await db
      .from("rita_curricula")
      .insert({ ...data, title_ar: data.title_ar || null, created_by: context.userId })
      .select(CURRICULUM_COLUMNS)
      .single();
    fail(error, "create book");
    return row as CurriculumRow;
  });

export const adminSaveCurriculumPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z.object({
        curriculumId: uuid,
        pages: z
          .array(
            z.object({
              page_no: z.number().int().min(1).max(5_000),
              text: z.string().max(20_000),
              has_text_layer: z.boolean(),
            }),
          )
          .min(1)
          .max(25),
      }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: book, error: bookError } = await db
      .from("rita_curricula")
      .select("page_count")
      .eq("id", data.curriculumId)
      .single();
    fail(bookError, "book");
    if (data.pages.some((page) => page.page_no > Number(book.page_count))) {
      throw new Error("A page number is past the end of the book.");
    }
    const { error } = await db.from("rita_curriculum_pages").upsert(
      data.pages.map((page) => ({ curriculum_id: data.curriculumId, ...page })),
      { onConflict: "curriculum_id,page_no" },
    );
    fail(error, "save pages");
    return { saved: data.pages.length };
  });

/** Scanned pages: the browser renders them to JPEG and the AI transcribes them. */
export const adminTranscribeCurriculumPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z.object({
        curriculumId: uuid,
        pages: z
          .array(z.object({ page_no: z.number().int().min(1), jpegBase64: z.string().min(100).max(1_500_000) }))
          .min(1)
          .max(4),
      }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { transcribePages } = await ai();
    const result = await transcribePages(data.pages);
    const db = await admin();
    if (result.pages.length) {
      const { error } = await db.from("rita_curriculum_pages").upsert(
        result.pages.map((page) => ({
          curriculum_id: data.curriculumId,
          page_no: page.page_no,
          text: page.text,
          has_text_layer: false,
        })),
        { onConflict: "curriculum_id,page_no" },
      );
      fail(error, "save transcription");
    }
    return { transcribed: result.pages.map((page) => page.page_no) };
  });

export const adminSetCurriculumStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ curriculumId: uuid, status: z.enum(["draft", "published", "archived"]) }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from("rita_curricula").update({ status: data.status }).eq("id", data.curriculumId);
    fail(error, "update book");
    return { ok: true };
  });

async function loadBook(curriculumId: string) {
  const db = await admin();
  const { data, error } = await db.from("rita_curricula").select(CURRICULUM_COLUMNS).eq("id", curriculumId).single();
  fail(error, "book");
  return data as CurriculumRow;
}

/** Saves a window summary and moves the read cursor forward when it is the next window. */
async function storeWindow(input: {
  book: CurriculumRow;
  from: number;
  to: number;
  summary: WindowSummary;
  source: "ai" | "manual";
  model: string | null;
  userId: string;
}) {
  const check = checkWindow(input.book, input.from, input.to);
  if (!check.ok) throw new Error(check.reason);
  const pageProblem = checkSummaryPages(input.summary, input.from, input.to);
  if (pageProblem) throw new Error(pageProblem);
  const db = await admin();
  const { error } = await db.from("rita_curriculum_windows").upsert(
    {
      curriculum_id: input.book.id,
      from_page: input.from,
      to_page: input.to,
      summary: input.summary,
      source: input.source,
      model: input.model,
      created_by: input.userId,
    },
    { onConflict: "curriculum_id,from_page,to_page" },
  );
  fail(error, "save summary");
  // Only ever moves forward, so two admins reading at once cannot move it back.
  const { error: cursorError } = await db
    .from("rita_curricula")
    .update({ read_cursor: check.advancesTo })
    .eq("id", input.book.id)
    .lt("read_cursor", check.advancesTo);
  fail(cursorError, "move read cursor");
  return { readCursor: check.advancesTo };
}

async function pageText(curriculumId: string, from: number, to: number) {
  const db = await admin();
  const { data, error } = await db
    .from("rita_curriculum_pages")
    .select("page_no, text")
    .eq("curriculum_id", curriculumId)
    .gte("page_no", from)
    .lte("page_no", to);
  fail(error, "page text");
  const rows = (data ?? []) as { page_no: number; text: string }[];
  const missing = [];
  for (let page = from; page <= to; page += 1) {
    const row = rows.find((item) => item.page_no === page);
    if (!row || row.text.trim().length < 20) missing.push(page);
  }
  return { text: buildWindowText(rows, from, to), missing };
}

const windowInput = z.object({
  curriculumId: uuid,
  from: z.number().int().min(1),
  to: z.number().int().min(1),
});

export const adminReadCurriculumWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(windowInput, data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const book = await loadBook(data.curriculumId);
    const check = checkWindow(book, data.from, data.to);
    if (!check.ok) throw new Error(check.reason);
    const { text, missing } = await pageText(book.id, data.from, data.to);
    if (missing.length === data.to - data.from + 1) {
      throw new Error("These pages have no text yet. Read the scanned pages first.");
    }
    const { summarizeWindow } = await ai();
    const { summary, model } = await summarizeWindow({
      kind: book.kind,
      bookTitle: book.title,
      from: data.from,
      to: data.to,
      pageText: text,
    });
    return storeWindow({ book, from: data.from, to: data.to, summary, source: "ai", model, userId: context.userId });
  });

export const adminImportCurriculumWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(windowInput.extend({ summary: WindowSummarySchema }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const book = await loadBook(data.curriculumId);
    return storeWindow({
      book,
      from: data.from,
      to: data.to,
      summary: data.summary,
      source: "manual",
      model: null,
      userId: context.userId,
    });
  });

// ---------- admin: lessons ----------

async function insertLesson(input: {
  book: CurriculumRow;
  lesson: LessonDraft;
  source: "ai" | "manual";
  model: string | null;
  imageUrl: string | null;
  userId: string;
}) {
  const pageProblem = checkLessonPages(input.book, input.lesson.source_from_page, input.lesson.source_to_page);
  if (pageProblem) throw new Error(pageProblem);
  const db = await admin();
  // Two tries: a parallel insert can take the same lesson number.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: last } = await db
      .from("rita_lessons")
      .select("lesson_no")
      .eq("curriculum_id", input.book.id)
      .order("lesson_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lessonNo = Number(last?.lesson_no ?? 0) + 1;
    const { lesson } = input;
    const { data, error } = await db
      .from("rita_lessons")
      .insert({
        curriculum_id: input.book.id,
        lesson_no: lessonNo,
        title: lesson.title,
        title_ar: lesson.title_ar,
        topic: lesson.topic,
        source_from_page: lesson.source_from_page,
        source_to_page: lesson.source_to_page,
        objectives: lesson.objectives,
        plan: { ...lesson.plan, summary: lesson.summary },
        vocabulary: lesson.vocabulary,
        image_prompt: lesson.image_prompt || null,
        image_url: input.imageUrl,
        source: input.source,
        model: input.model,
        created_by: input.userId,
      })
      .select(LESSON_COLUMNS)
      .single();
    if (!error) return data as LessonRow;
    if (error.code !== "23505" || attempt === 1) fail(error, "save lesson");
  }
  throw new Error("Could not number the lesson. Try again.");
}

export const adminGenerateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z.object({
        curriculumId: uuid,
        topic: z.string().trim().min(2).max(160),
        from: z.number().int().min(1),
        to: z.number().int().min(1),
      }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const book = await loadBook(data.curriculumId);
    if (data.to - data.from + 1 > 10) throw new Error("A lesson can use at most 10 pages.");
    const pageProblem = checkLessonPages(book, data.from, data.to);
    if (pageProblem) throw new Error(pageProblem);
    const db = await admin();
    const [{ text }, windows, lessons] = await Promise.all([
      pageText(book.id, data.from, data.to),
      db
        .from("rita_curriculum_windows")
        .select("from_page, to_page, summary")
        .eq("curriculum_id", book.id)
        .lte("from_page", data.to)
        .gte("to_page", data.from),
      db.from("rita_lessons").select("title").eq("curriculum_id", book.id).neq("status", "archived"),
    ]);
    fail(windows.error, "summaries");
    fail(lessons.error, "lessons");
    const { generateLesson } = await ai();
    const { lesson, model } = await generateLesson({
      kind: book.kind,
      bookTitle: book.title,
      topic: data.topic,
      from: data.from,
      to: data.to,
      summaries: ((windows.data ?? []) as { summary: WindowSummary }[]).map((row) => row.summary),
      pageText: text,
      previousTitles: ((lessons.data ?? []) as { title: string }[]).map((row) => row.title),
    });
    // The model is told the range; clamp anyway so a stray page number cannot fail the save.
    lesson.source_from_page = Math.max(data.from, Math.min(lesson.source_from_page, data.to));
    lesson.source_to_page = Math.max(lesson.source_from_page, Math.min(lesson.source_to_page, data.to));
    return insertLesson({ book, lesson, source: "ai", model, imageUrl: null, userId: context.userId });
  });

export const adminImportLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z.object({ curriculumId: uuid, lesson: LessonDraftSchema, image_url: imageUrlSchema.nullable().default(null) }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const book = await loadBook(data.curriculumId);
    return insertLesson({
      book,
      lesson: data.lesson,
      source: "manual",
      model: null,
      imageUrl: data.image_url,
      userId: context.userId,
    });
  });

export const adminUpdateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid, lesson: LessonDraftSchema }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: current, error } = await db
      .from("rita_lessons")
      .select("curriculum_id, status, version")
      .eq("id", data.lessonId)
      .single();
    fail(error, "lesson");
    const book = await loadBook(current.curriculum_id);
    const pageProblem = checkLessonPages(book, data.lesson.source_from_page, data.lesson.source_to_page);
    if (pageProblem) throw new Error(pageProblem);
    const { lesson } = data;
    const { data: row, error: updateError } = await db
      .from("rita_lessons")
      .update({
        title: lesson.title,
        title_ar: lesson.title_ar,
        topic: lesson.topic,
        source_from_page: lesson.source_from_page,
        source_to_page: lesson.source_to_page,
        objectives: lesson.objectives,
        plan: { ...lesson.plan, summary: lesson.summary },
        vocabulary: lesson.vocabulary,
        image_prompt: lesson.image_prompt || null,
        // A published lesson that changes gets a new version; old attempts keep only matching objectives.
        version: current.status === "published" ? Number(current.version) + 1 : current.version,
      })
      .eq("id", data.lessonId)
      .select(LESSON_COLUMNS)
      .single();
    fail(updateError, "update lesson");
    return row as LessonRow;
  });

export const adminSetLessonStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, status: z.enum(["draft", "published", "archived"]) }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: lesson, error } = await db
      .from("rita_lessons")
      .select("id, curriculum_id, path_order, source_to_page")
      .eq("id", data.lessonId)
      .single();
    fail(error, "lesson");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "published") {
      patch.published_at = new Date().toISOString();
      if (lesson.path_order == null) {
        const { data: last } = await db
          .from("rita_lessons")
          .select("path_order")
          .not("path_order", "is", null)
          .order("path_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        patch.path_order = Number(last?.path_order ?? 0) + 1;
      }
    }
    const { error: updateError } = await db.from("rita_lessons").update(patch).eq("id", data.lessonId);
    fail(updateError, "update lesson");
    if (data.status === "published") {
      const book = await loadBook(lesson.curriculum_id);
      const taught = taughtCursorAfterPublish(book, Number(lesson.source_to_page));
      if (taught > book.taught_cursor) {
        const { error: cursorError } = await db
          .from("rita_curricula")
          .update({ taught_cursor: taught })
          .eq("id", book.id)
          .lt("taught_cursor", taught);
        fail(cursorError, "move taught cursor");
      }
    }
    return { ok: true };
  });

/** Moves a lesson one step up or down in the learners' path. */
export const adminMoveLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid, direction: z.enum(["up", "down"]) }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: rows, error } = await db
      .from("rita_lessons")
      .select("id, path_order")
      .eq("status", "published")
      .not("path_order", "is", null)
      .order("path_order");
    fail(error, "path");
    const list = (rows ?? []) as { id: string; path_order: number }[];
    const index = list.findIndex((row) => row.id === data.lessonId);
    const swapWith = data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= list.length) return { ok: true };
    const a = list[index];
    const b = list[swapWith];
    const first = await db.from("rita_lessons").update({ path_order: b.path_order }).eq("id", a.id);
    fail(first.error, "move lesson");
    const second = await db.from("rita_lessons").update({ path_order: a.path_order }).eq("id", b.id);
    fail(second.error, "move lesson");
    return { ok: true };
  });

export const adminGenerateLessonImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: lesson, error } = await db
      .from("rita_lessons")
      .select("id, title, topic, image_prompt")
      .eq("id", data.lessonId)
      .single();
    fail(error, "lesson");
    const scene = String(lesson.image_prompt || `${lesson.title}: ${lesson.topic}`);
    const { generateLessonImage } = await ai();
    const image = await generateLessonImage(scene);
    const path = `lessons/${lesson.id}-${Date.now()}.webp`;
    const upload = await db.storage
      .from("rita-lesson-images")
      .upload(path, image.bytes, { contentType: image.contentType, upsert: true });
    fail(upload.error, "upload image");
    const { data: publicUrl } = db.storage.from("rita-lesson-images").getPublicUrl(path);
    const { error: updateError } = await db
      .from("rita_lessons")
      .update({ image_url: publicUrl.publicUrl })
      .eq("id", lesson.id);
    fail(updateError, "save image");
    return { imageUrl: publicUrl.publicUrl };
  });

// ---------- learners ----------

export type PathLesson = {
  id: string;
  kind: "grammar" | "vocabulary";
  title: string;
  title_ar: string;
  topic: string;
  image_url: string | null;
  objective_count: number;
  state: PathNodeState;
  stars: number;
  best_score: number;
  in_progress: boolean;
};

export const getLessonPath = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // RLS limits this to published lessons of published books.
    const { data: lessons, error } = await context.supabase
      .from("rita_lessons")
      .select("id, title, title_ar, topic, image_url, objectives, path_order, curriculum:rita_curricula!inner(kind, status)")
      .eq("status", "published")
      .eq("curriculum.status", "published")
      .order("path_order", { ascending: true, nullsFirst: false });
    fail(error, "lessons");
    const { data: progress, error: progressError } = await context.supabase
      .from("rita_lesson_progress")
      .select("lesson_id, status, stars, best_score")
      .eq("user_id", context.userId);
    fail(progressError, "progress");
    const byLesson: Record<string, { status: string; stars: number; best_score: number }> = {};
    for (const row of (progress ?? []) as { lesson_id: string; status: string; stars: number; best_score: number }[]) {
      byLesson[row.lesson_id] = row;
    }
    const nodes = lessonPathStates((lessons ?? []) as any[], byLesson).map(
      (lesson): PathLesson => ({
        id: lesson.id,
        kind: lesson.curriculum?.kind === "vocabulary" ? "vocabulary" : "grammar",
        title: lesson.title,
        title_ar: lesson.title_ar,
        topic: lesson.topic,
        image_url: lesson.image_url,
        objective_count: Array.isArray(lesson.objectives) ? lesson.objectives.length : 0,
        state: lesson.state,
        // Show the best result even while a retry is in progress.
        stars: Math.max(lesson.stars, starsFor(byLesson[lesson.id]?.best_score ?? 0)),
        best_score: byLesson[lesson.id]?.best_score ?? 0,
        in_progress: byLesson[lesson.id]?.status === "in_progress",
      }),
    );
    return { lessons: nodes };
  });

export type LessonSession = {
  lesson: {
    id: string;
    title: string;
    title_ar: string;
    topic: string;
    image_url: string | null;
    objectives: { id: string; text: string; text_ar: string; weight: number }[];
  };
  progress: { status: string; objectives: ObjectiveState; score: number; stars: number; attempts: number };
  nextLessonId: string | null;
};

async function loadPublishedLesson(ctx: AuthContext, lessonId: string) {
  const { data, error } = await ctx.supabase
    .from("rita_lessons")
    .select("id, title, title_ar, topic, image_url, objectives, plan, vocabulary, version, path_order, status")
    .eq("id", lessonId)
    .eq("status", "published")
    .maybeSingle();
  fail(error, "lesson");
  if (!data) throw new Error("This lesson is not available.");
  return data as {
    id: string;
    title: string;
    title_ar: string;
    topic: string;
    image_url: string | null;
    objectives: Objective[];
    plan: LessonDraft["plan"] & { summary?: string };
    vocabulary: LessonDraft["vocabulary"];
    version: number;
    path_order: number | null;
  };
}

/** Keeps only objectives that still exist after the lesson was edited. */
function currentState(objectives: Objective[], stored: unknown): ObjectiveState {
  const state: ObjectiveState = {};
  const raw = (stored && typeof stored === "object" ? stored : {}) as ObjectiveState;
  for (const objective of objectives) if (raw[objective.id]?.met) state[objective.id] = raw[objective.id];
  return state;
}

/**
 * Opens a lesson for the learner. A finished lesson starts a fresh attempt
 * (best score kept); an unfinished one resumes with the objectives already met.
 */
export const startLessonAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid, restart: z.boolean().default(false) }), data))
  .handler(async ({ data, context }): Promise<LessonSession> => {
    const lesson = await loadPublishedLesson(context, data.lessonId);
    const db = await admin();
    const { data: existing, error } = await db
      .from("rita_lesson_progress")
      .select("id, status, objectives, score, stars, attempts")
      .eq("user_id", context.userId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    fail(error, "progress");
    let row = existing as
      | { id: string; status: string; objectives: unknown; score: number; stars: number; attempts: number }
      | null;
    const fresh = {
      status: "in_progress",
      objectives: {},
      score: 0,
      stars: 0,
      evaluations: 0,
      lesson_version: lesson.version,
      started_at: new Date().toISOString(),
      completed_at: null,
    };
    if (!row) {
      const { data: created, error: insertError } = await db
        .from("rita_lesson_progress")
        .upsert({ user_id: context.userId, lesson_id: lesson.id, ...fresh }, { onConflict: "user_id,lesson_id" })
        .select("id, status, objectives, score, stars, attempts")
        .single();
      fail(insertError, "start lesson");
      row = created;
    } else if (row.status === "completed" || data.restart) {
      const { data: updated, error: updateError } = await db
        .from("rita_lesson_progress")
        .update({ ...fresh, attempts: row.attempts + 1 })
        .eq("id", row.id)
        .select("id, status, objectives, score, stars, attempts")
        .single();
      fail(updateError, "restart lesson");
      row = updated;
    }
    const state = currentState(lesson.objectives, row!.objectives);
    const next = await nextLessonAfter(context, lesson.path_order);
    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        title_ar: lesson.title_ar,
        topic: lesson.topic,
        image_url: lesson.image_url,
        objectives: lesson.objectives.map((objective) => ({
          id: objective.id,
          text: objective.text,
          text_ar: objective.text_ar,
          weight: objective.weight,
        })),
      },
      progress: {
        status: row!.status,
        objectives: state,
        score: scoreLesson(lesson.objectives, state),
        stars: row!.stars,
        attempts: row!.attempts,
      },
      nextLessonId: next,
    };
  });

async function nextLessonAfter(ctx: AuthContext, pathOrder: number | null) {
  if (pathOrder == null) return null;
  const { data } = await ctx.supabase
    .from("rita_lessons")
    .select("id, curriculum:rita_curricula!inner(status)")
    .eq("status", "published")
    .eq("curriculum.status", "published")
    .gt("path_order", pathOrder)
    .order("path_order")
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export type LessonEvaluationResult = {
  objectives: ObjectiveState;
  newlyMet: string[];
  score: number;
  stars: number;
  completed: boolean;
  skipped?: "finished" | "limit" | "no_answer";
};

/**
 * Called after each learner turn with the last few turns. The AI judges the
 * open objectives; only verdicts that quote the learner are kept.
 */
export const evaluateLessonTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, turns: z.array(z.unknown()).max(20) }), data),
  )
  .handler(async ({ data, context }): Promise<LessonEvaluationResult> => {
    const lesson = await loadPublishedLesson(context, data.lessonId);
    const db = await admin();
    const { data: row, error } = await db
      .from("rita_lesson_progress")
      .select("id, status, objectives, best_score, evaluations")
      .eq("user_id", context.userId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    fail(error, "progress");
    if (!row) throw new Error("Start the lesson first.");
    const state = currentState(lesson.objectives, row.objectives);
    const summary = (skipped: LessonEvaluationResult["skipped"]): LessonEvaluationResult => {
      const score = scoreLesson(lesson.objectives, state);
      return {
        objectives: state,
        newlyMet: [],
        score,
        stars: starsFor(score),
        completed: row.status === "completed",
        skipped,
      };
    };
    if (row.status === "completed") return summary("finished");
    if (Number(row.evaluations) >= MAX_EVALUATIONS_PER_ATTEMPT) return summary("limit");

    const turns = cleanTurns(data.turns);
    const learnerText = turns
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text)
      .join("\n");
    if (learnerText.replace(/\s+/g, "").length < 2) return summary("no_answer");

    const open = lesson.objectives.filter((objective) => !state[objective.id]?.met);
    const { evaluateTurns } = await ai();
    const { evaluation } = await evaluateTurns({ lessonTitle: lesson.title, objectives: open, turns });
    const merged = mergeObjectiveState(state, evaluation, open, learnerText, new Date().toISOString());
    const score = scoreLesson(lesson.objectives, merged.state);
    const completed = isLessonComplete(lesson.objectives, merged.state);
    const stars = starsFor(score);
    const patch: Record<string, unknown> = {
      objectives: merged.state,
      score,
      evaluations: Number(row.evaluations) + 1,
    };
    if (completed) {
      patch.status = "completed";
      patch.stars = stars;
      patch.best_score = Math.max(Number(row.best_score), score);
      patch.completed_at = new Date().toISOString();
    }
    // Guard on in_progress so two overlapping calls cannot complete twice.
    const { error: updateError } = await db
      .from("rita_lesson_progress")
      .update(patch)
      .eq("id", row.id)
      .eq("status", "in_progress");
    fail(updateError, "save progress");
    return { objectives: merged.state, newlyMet: merged.newlyMet, score, stars, completed };
  });
