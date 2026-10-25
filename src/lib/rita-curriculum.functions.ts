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
  ObjectiveSchema,
  WindowSummarySchema,
  buildWindowText,
  checkLessonPages,
  checkSummaryPages,
  checkWindow,
  cleanTurns,
  describeSchemaError,
  effectiveProgressStatus,
  isLessonComplete,
  lessonPathStates,
  mergeObjectiveState,
  missingPages,
  pageIsReady,
  reorderPositions,
  scoreLesson,
  starsFor,
  taughtCursorAfterPublish,
  type LessonDraft,
  type Objective,
  type ObjectiveState,
  type PathNodeState,
  type WindowSummary,
} from "@/lib/rita-curriculum";

import { SlideDeckSchema, type Slide } from "@/lib/rita-slides";
import {
  LessonContentSchema,
  contentProblems,
  findItem,
  parseLessonContent,
  type LessonContent,
} from "@/lib/rita-lesson-content";
import {
  MAX_RESOURCES,
  NewResourceSchema,
  RESOURCES_BUCKET,
  ResourceEditSchema,
  canAddResource,
  hostLabel,
  isCompleteOrder,
  isPdfPathFor,
  nextPosition,
  sortResources,
  type LearnerResource,
  type Resource,
} from "@/lib/rita-resources";

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthContext = { supabase: SupabaseClient<any, "public", any>; userId: string };

async function assertAdmin(ctx: AuthContext) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
  await primeSavedOpenAiKey(ctx);
}

/**
 * Lets the curriculum AI use the key saved on the AI keys page even where the
 * service-role reader is unavailable: the admin's own session can read it too.
 */
async function primeSavedOpenAiKey(ctx: AuthContext) {
  try {
    const { hasPrimedOpenAiKey, primeOpenAiKey } = await ai();
    if (hasPrimedOpenAiKey()) return;
    for (const purpose of ["rita", "shared"]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (ctx.supabase.from as any)("admin_ai_keys")
        .select("api_key")
        .eq("provider", "openai")
        .eq("purpose", purpose)
        .eq("slot", 1)
        .maybeSingle();
      const saved = String(data?.api_key ?? "").trim();
      if (saved.length > 20) {
        primeOpenAiKey(saved);
        return;
      }
    }
  } catch {
    /* the AI call itself reports a missing key */
  }
}

/**
 * Whether the 20261015120000 curriculum-gaps columns exist. True is cached for
 * the process; false is re-probed (a tiny query) so applying the migration is
 * picked up without a restart. When false, every read/write below omits the new
 * columns, so the site keeps working before the migration is applied. Only a
 * recognized missing-schema error means "migration not applied"; a service
 * failure is assumed compatible so it surfaces from the real query instead.
 */
let gapsColumnsReady = false;
function isMissingSchemaError(error: { message?: string } | null): boolean {
  const message = error?.message ?? "";
  return /could not find|does not exist|PGRST20[0-9]/i.test(message);
}
async function hasCurriculumGaps(db: AuthContext["supabase"]): Promise<boolean> {
  if (gapsColumnsReady) return true;
  try {
    const { error } = await db.from("rita_curriculum_pages").select("transcribed_at").limit(1);
    if (!error) {
      gapsColumnsReady = true;
      return true;
    }
    // Only a missing-column answer means the migration is absent.
    return isMissingSchemaError(error);
  } catch {
    return false;
  }
}

/**
 * Whether the 20261017120000 lesson-slides table exists. Like the gaps probe: a
 * missing-schema answer means "not applied yet" and the rest of the page keeps
 * working without slides; any other failure is assumed fine and surfaces from
 * the real query.
 */
let slidesTableReady = false;
async function hasSlidesTable(db: AuthContext["supabase"]): Promise<boolean> {
  if (slidesTableReady) return true;
  try {
    const { error } = await db.from("rita_lesson_slides").select("lesson_id").limit(1);
    if (!error) {
      slidesTableReady = true;
      return true;
    }
    return !isMissingSchemaError(error);
  } catch {
    return false;
  }
}

/**
 * Whether the 20261017180000 lesson-resources table exists. Same rule as the
 * slides probe: a missing-schema answer means "not applied yet" and lessons keep
 * working without resources.
 */
let resourcesTableReady = false;
async function hasResourcesTable(db: AuthContext["supabase"]): Promise<boolean> {
  if (resourcesTableReady) return true;
  try {
    const { error } = await db.from("rita_lesson_resources").select("id").limit(1);
    if (!error) {
      resourcesTableReady = true;
      return true;
    }
    return !isMissingSchemaError(error);
  } catch {
    return false;
  }
}

/**
 * Whether the 20261017200000 `shared` column exists on lesson slides. Without
 * it no slide is ever shown to a learner and the admin switch stays off.
 */
let slidesSharedReady = false;
async function hasSlidesShared(db: AuthContext["supabase"]): Promise<boolean> {
  if (slidesSharedReady) return true;
  try {
    const { error } = await db.from("rita_lesson_slides").select("shared").limit(1);
    if (!error) {
      slidesSharedReady = true;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

const MISSING_RESOURCES =
  "Could not find the table rita_lesson_resources: apply migration 20261017180000.";

async function ai() {
  return import("@/lib/rita-curriculum-ai.server");
}

function fail(error: { message?: string } | null, label: string): asserts error is null {
  if (error) throw new Error(`${label}: ${error.message ?? "database error"}`);
}

const uuid = z.string().uuid();
/** A learning-language code (see the learning_languages table), e.g. "en", "de", "pt-br". */
const languageCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/);

const kindSchema = z.enum(["grammar", "vocabulary"]);
const imageUrlSchema = z
  .string()
  .trim()
  .max(600)
  .refine(
    (value) => value.startsWith("/curriculum/") || value.startsWith("https://"),
    "image url must be https or /curriculum/",
  );

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
  /** The language this book teaches (a learning_languages code). */
  target_language: string;
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

const RESOURCE_COLUMNS =
  "id, lesson_id, kind, title, note, url, file_path, file_name, file_size, position";
const CURRICULUM_COLUMNS =
  "id, kind, title, title_ar, target_language, level, pdf_path, page_count, read_cursor, taught_cursor, image_url, status, created_at";
const LESSON_COLUMNS =
  "id, curriculum_id, lesson_no, path_order, title, title_ar, topic, source_from_page, source_to_page, objectives, plan, vocabulary, image_url, image_prompt, status, version, source, model, updated_at";

/** Review suggestions appear for lessons finished more than a week ago. */
const REVIEW_AFTER_MS = 7 * 24 * 60 * 60 * 1_000;

// ---------- admin: books ----------

export const adminCurriculumOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const [books, windows, lessons] = await Promise.all([
      db
        .from("rita_curricula")
        .select(CURRICULUM_COLUMNS)
        .neq("status", "archived")
        .order("created_at"),
      db
        .from("rita_curriculum_windows")
        .select("id, curriculum_id, from_page, to_page, summary, source, model, created_at")
        .order("from_page"),
      db.from("rita_lessons").select(LESSON_COLUMNS).neq("status", "archived").order("lesson_no"),
    ]);
    fail(books.error, "books");
    fail(windows.error, "windows");
    fail(lessons.error, "lessons");
    const bookRows = (books.data ?? []) as CurriculumRow[];
    // Cheap per-book readiness report so the overview no longer downloads every
    // page's full text. Falls back to the legacy full-text query (read-only, so
    // still safe) when the 20261015120000 migration has not been applied yet.
    const missingText: Record<string, number[]> = {};
    let needsMigration = false;
    if (bookRows.length) {
      const gaps = await hasCurriculumGaps(db);
      let reports:
        | {
            rows: { page_no: number; text_len: number; blank_confirmed: boolean }[];
            error: { message?: string } | null;
          }[]
        | null = null;
      if (gaps) {
        reports = [];
        for (const book of bookRows) {
          // Paginated: a book may hold thousands of pages and one call is capped
          // by the API row limit.
          const rows: { page_no: number; text_len: number; blank_confirmed: boolean }[] = [];
          let from = 0;
          let reportError: { message?: string } | null = null;
          for (let guard = 0; guard < 30; guard += 1) {
            const result = (await db
              .rpc("rita_curriculum_page_report", { p_curriculum_id: book.id })
              .range(from, from + 999)) as unknown as {
              data: { page_no: number; text_len: number; blank_confirmed: boolean }[] | null;
              error: { message?: string } | null;
            };
            if (result.error) {
              reportError = result.error;
              break;
            }
            rows.push(...(result.data ?? []));
            if ((result.data ?? []).length < 1000) break;
            from += 1000;
          }
          reports.push({ rows: reportError ? [] : rows, error: reportError });
        }
      }
      if (reports && !reports.some((report) => report.error)) {
        for (let index = 0; index < bookRows.length; index += 1) {
          const book = bookRows[index];
          missingText[book.id] = missingPages(reports[index].rows, Number(book.page_count));
        }
      } else {
        const reportError = reports?.find((report) => report.error)?.error ?? null;
        if (reportError && !isMissingSchemaError(reportError)) {
          // A service failure must reach the error state, not be relabeled as
          // a missing migration.
          fail(reportError, "page report");
        }
        needsMigration = true;
        const { data: pages, error } = await db
          .from("rita_curriculum_pages")
          .select("curriculum_id, page_no, text")
          .range(0, 999);
        fail(error, "pages");
        const allPages = [
          ...(pages ?? []),
          // The legacy fallback is paginated too: books can hold thousands of
          // pages and one call is capped by the API row limit.
          ...(await legacyRemainingPages(db, (pages ?? []).length)),
        ] as { curriculum_id: string; page_no: number; text: string }[];
        const byBook: Record<
          string,
          { page_no: number; text_len: number; blank_confirmed: boolean }[]
        > = {};
        for (const page of allPages) {
          (byBook[page.curriculum_id] ??= []).push({
            page_no: page.page_no,
            text_len: page.text.trim().length,
            blank_confirmed: false,
          });
        }
        for (const book of bookRows) {
          missingText[book.id] = missingPages(byBook[book.id] ?? [], Number(book.page_count));
        }
      }
    }
    // Slide decks live in their own table so this page works before it exists.
    const slides: Record<string, Slide[]> = {};
    const slidesShared: Record<string, boolean> = {};
    const slidesReady = await hasSlidesTable(db);
    const sharedReady = slidesReady && (await hasSlidesShared(db));
    if (slidesReady) {
      const { data: decks, error: deckError } = await db
        .from("rita_lesson_slides")
        .select(sharedReady ? "lesson_id, slides, shared" : "lesson_id, slides");
      fail(deckError, "slides");
      for (const row of (decks ?? []) as unknown as {
        lesson_id: string;
        slides: Slide[];
        shared?: boolean;
      }[]) {
        if (Array.isArray(row.slides)) slides[row.lesson_id] = row.slides;
        slidesShared[row.lesson_id] = row.shared === true;
      }
    }
    // Resources too: their own table, so this page works before it exists.
    const resources: Record<string, Resource[]> = {};
    const resourcesReady = await hasResourcesTable(db);
    if (resourcesReady) {
      const { data: rows, error: resourceError } = await db
        .from("rita_lesson_resources")
        .select(RESOURCE_COLUMNS)
        .order("position");
      fail(resourceError, "resources");
      for (const row of (rows ?? []) as Resource[]) (resources[row.lesson_id] ??= []).push(row);
    }
    return {
      curricula: bookRows,
      windows: (windows.data ?? []) as WindowRow[],
      lessons: (lessons.data ?? []) as LessonRow[],
      missingText,
      needsMigration,
      slides,
      slidesReady,
      slidesShared,
      sharedReady,
      resources,
      resourcesReady,
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
        target_language: languageCodeSchema.default("en"),
        page_count: z.number().int().min(1).max(5_000),
        pdf_path: z.string().trim().max(400).nullable().default(null),
      }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const { data: row, error } = await db
      .from("rita_curricula")
      .insert({ ...data, title_ar: data.title_ar || null, created_by: context.userId })
      .select(CURRICULUM_COLUMNS)
      .single();
    fail(error, "create book");
    return row as CurriculumRow;
  });

/** Which language a book teaches. Its lessons then show only to learners of that language. */
export const adminSetCurriculumLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ curriculumId: uuid, language: languageCodeSchema }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("rita_curricula")
      .update({ target_language: data.language })
      .eq("id", data.curriculumId);
    fail(error, "set book language");
    return { ok: true };
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
    const db = context.supabase;
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
          .array(
            z.object({
              page_no: z.number().int().min(1),
              jpegBase64: z.string().min(100).max(1_500_000),
            }),
          )
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
    const db = context.supabase;
    const gaps = await hasCurriculumGaps(db);
    if (result.pages.length) {
      const { error } = await db.from("rita_curriculum_pages").upsert(
        result.pages.map((page) => ({
          curriculum_id: data.curriculumId,
          page_no: page.page_no,
          text: page.text,
          has_text_layer: false,
          // A page the AI looked at and found (almost) empty is a cover, a divider
          // or a picture: it is blank, not a gap that blocks the whole window.
          // A page the AI never answered for stays missing.
          ...(gaps
            ? {
                transcribed_at: new Date().toISOString(),
                blank_confirmed: page.text.trim().length < 20,
              }
            : {}),
        })),
        { onConflict: "curriculum_id,page_no" },
      );
      fail(error, "save transcription");
    }
    const transcribed = result.pages.map((page) => page.page_no);
    return {
      transcribed,
      stillMissing: data.pages
        .map((page) => page.page_no)
        .filter((pageNo) => !transcribed.includes(pageNo)),
      failures: result.failures,
    };
  });

/** "Can the AI read pages right now?" before a long run, so a bad key shows up in seconds. */
export const adminCheckVisionKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { checkVisionKey } = await ai();
    return checkVisionKey();
  });

export const adminSetCurriculumStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z.object({ curriculumId: uuid, status: z.enum(["draft", "published", "archived"]) }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const { error } = await db
      .from("rita_curricula")
      .update({ status: data.status })
      .eq("id", data.curriculumId);
    fail(error, "update book");
    return { ok: true };
  });

/** Marks a page as blank (a cover image, a divider) so it stops blocking reads. */
export const adminConfirmBlankPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ curriculumId: uuid, pageNo: z.number().int().min(1).max(5_000) }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const { error } = await db.rpc("rita_confirm_blank_page", {
      p_curriculum_id: data.curriculumId,
      p_page_no: data.pageNo,
    });
    fail(error, "confirm blank page");
    return { ok: true };
  });

/** Reorders published lessons in the learner path (drag and drop). */
export const adminReorderLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonIds: z.array(uuid).min(1).max(500) }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const { data: rows, error } = await db
      .from("rita_lessons")
      .select("id, path_order")
      .eq("status", "published")
      .not("path_order", "is", null)
      .order("path_order");
    fail(error, "path");
    // The dragged lessons keep the actual position slots they already occupy,
    // so lessons from other books are never renumbered.
    const positions = reorderPositions(
      (rows ?? []) as { id: string; path_order: number }[],
      data.lessonIds,
    );
    const orders = data.lessonIds.map((id, index) => ({ id, path_order: positions[index] }));
    const { error: rpcError } = await db.rpc("rita_set_lesson_path_orders", { p_orders: orders });
    fail(rpcError, "reorder lessons");
    return { ok: true };
  });

async function loadBook(db: AuthContext["supabase"], curriculumId: string) {
  const { data, error } = await db
    .from("rita_curricula")
    .select(CURRICULUM_COLUMNS)
    .eq("id", curriculumId)
    .single();
  fail(error, "book");
  return data as CurriculumRow;
}

/** Saves a window summary and moves the read cursor forward when it is the next window. */
async function storeWindow(
  db: AuthContext["supabase"],
  input: {
    book: CurriculumRow;
    from: number;
    to: number;
    summary: WindowSummary;
    source: "ai" | "manual";
    model: string | null;
    userId: string;
  },
) {
  const check = checkWindow(input.book, input.from, input.to);
  if (!check.ok) throw new Error(check.reason);
  const pageProblem = checkSummaryPages(input.summary, input.from, input.to);
  if (pageProblem) throw new Error(pageProblem);
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

async function legacyRemainingPages(db: AuthContext["supabase"], alreadyFetched: number) {
  const rows: { curriculum_id: string; page_no: number; text: string }[] = [];
  let from = alreadyFetched;
  for (let guard = 0; guard < 30; guard += 1) {
    const { data, error } = await db
      .from("rita_curriculum_pages")
      .select("curriculum_id, page_no, text")
      .range(from, from + 999);
    fail(error, "pages");
    rows.push(...((data ?? []) as typeof rows));
    if ((data ?? []).length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function pageText(
  db: AuthContext["supabase"],
  curriculumId: string,
  from: number,
  to: number,
) {
  const gaps = await hasCurriculumGaps(db);
  const { data, error } = await db
    .from("rita_curriculum_pages")
    .select(gaps ? "page_no, text, blank_confirmed" : "page_no, text")
    .eq("curriculum_id", curriculumId)
    .gte("page_no", from)
    .lte("page_no", to);
  fail(error, "page text");
  const rows = (data ?? []) as unknown as {
    page_no: number;
    text: string;
    blank_confirmed?: boolean;
  }[];
  const missing: number[] = [];
  for (let page = from; page <= to; page += 1) {
    const row = rows.find((item) => item.page_no === page);
    if (!row || !pageIsReady(row.text.trim().length, row.blank_confirmed === true))
      missing.push(page);
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
    const book = await loadBook(context.supabase, data.curriculumId);
    const check = checkWindow(book, data.from, data.to);
    if (!check.ok) throw new Error(check.reason);
    const { text, missing } = await pageText(context.supabase, book.id, data.from, data.to);
    if (missing.length > 0) {
      throw new Error(
        `These pages have no text yet: ${missing.join(", ")}. Read the scanned pages first or confirm a page blank.`,
      );
    }
    const { summarizeWindow } = await ai();
    const { summary, model } = await summarizeWindow({
      kind: book.kind,
      bookTitle: book.title,
      from: data.from,
      to: data.to,
      pageText: text,
    });
    return storeWindow(context.supabase, {
      book,
      from: data.from,
      to: data.to,
      summary,
      source: "ai",
      model,
      userId: context.userId,
    });
  });

export const adminImportCurriculumWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(windowInput.extend({ summary: WindowSummarySchema }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const book = await loadBook(context.supabase, data.curriculumId);
    return storeWindow(context.supabase, {
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

async function insertLesson(
  db: AuthContext["supabase"],
  input: {
    book: CurriculumRow;
    lesson: LessonDraft;
    source: "ai" | "manual";
    model: string | null;
    imageUrl: string | null;
    userId: string;
  },
) {
  const pageProblem = checkLessonPages(
    input.book,
    input.lesson.source_from_page,
    input.lesson.source_to_page,
  );
  if (pageProblem) throw new Error(pageProblem);
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
    const book = await loadBook(context.supabase, data.curriculumId);
    if (data.to - data.from + 1 > 10) throw new Error("A lesson can use at most 10 pages.");
    const pageProblem = checkLessonPages(book, data.from, data.to);
    if (pageProblem) throw new Error(pageProblem);
    const db = context.supabase;
    const [{ text }, windows, lessons] = await Promise.all([
      pageText(context.supabase, book.id, data.from, data.to),
      db
        .from("rita_curriculum_windows")
        .select("from_page, to_page, summary")
        .eq("curriculum_id", book.id)
        .lte("from_page", data.to)
        .gte("to_page", data.from),
      db
        .from("rita_lessons")
        .select("title")
        .eq("curriculum_id", book.id)
        .neq("status", "archived"),
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
    lesson.source_to_page = Math.max(
      lesson.source_from_page,
      Math.min(lesson.source_to_page, data.to),
    );
    return insertLesson(context.supabase, {
      book,
      lesson,
      source: "ai",
      model,
      imageUrl: null,
      userId: context.userId,
    });
  });

export const adminImportLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z.object({
        curriculumId: uuid,
        lesson: LessonDraftSchema,
        image_url: imageUrlSchema.nullable().default(null),
      }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const book = await loadBook(context.supabase, data.curriculumId);
    return insertLesson(context.supabase, {
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
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, lesson: LessonDraftSchema }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const { data: current, error } = await db
      .from("rita_lessons")
      .select("curriculum_id, status, version")
      .eq("id", data.lessonId)
      .single();
    fail(error, "lesson");
    const book = await loadBook(context.supabase, current.curriculum_id);
    const pageProblem = checkLessonPages(
      book,
      data.lesson.source_from_page,
      data.lesson.source_to_page,
    );
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
    parseWith(
      z.object({ lessonId: uuid, status: z.enum(["draft", "published", "archived"]) }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
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
    const { error: updateError } = await db
      .from("rita_lessons")
      .update(patch)
      .eq("id", data.lessonId);
    fail(updateError, "update lesson");
    if (data.status === "published") {
      const book = await loadBook(context.supabase, lesson.curriculum_id);
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

/** Moves a lesson one step up or down in the learners' path (atomic swap). */
export const adminMoveLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, direction: z.enum(["up", "down"]) }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
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
    // One atomic call: both positions change together or not at all.
    const { error: rpcError } = await db.rpc("rita_set_lesson_path_orders", {
      p_orders: [
        { id: a.id, path_order: Number(b.path_order) },
        { id: b.id, path_order: Number(a.path_order) },
      ],
    });
    fail(rpcError, "move lesson");
    return { ok: true };
  });

/** Asks the AI to rewrite one objective (same id, new wording). */
export const adminRegenerateObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z.object({
        lessonId: uuid,
        // The objective as currently edited in the form, not the saved array
        // index — local edits must never regenerate different saved content.
        objective: ObjectiveSchema,
      }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    const { data: lesson, error } = await db
      .from("rita_lessons")
      .select("title, topic")
      .eq("id", data.lessonId)
      .single();
    fail(error, "lesson");
    const { regenerateObjective } = await ai();
    const objective = await regenerateObjective({
      lessonTitle: lesson.title,
      topic: lesson.topic,
      objective: data.objective,
    });
    return {
      // The id is kept so learners' earned progress for this objective survives.
      objective: { ...objective, id: data.objective.id },
    };
  });

export const adminGenerateLessonImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
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
    // The bucket is private (public buckets are blocked), so store a long-lived signed link.
    const signed = await db.storage
      .from("rita-lesson-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    fail(signed.error, "sign image");
    const imageUrl = signed.data!.signedUrl;
    const { error: updateError } = await db
      .from("rita_lessons")
      .update({ image_url: imageUrl })
      .eq("id", lesson.id);
    fail(updateError, "save image");
    return { imageUrl };
  });

export type SlidesResult = { slides: Slide[]; source: "ai" | "manual"; model: string | null };

async function saveDeck(
  db: AuthContext["supabase"],
  input: {
    lessonId: string;
    slides: Slide[];
    source: "ai" | "manual";
    model: string | null;
    userId: string;
  },
): Promise<SlidesResult> {
  // A freshly written AI deck has not been reviewed, so it stops being shared.
  const unshare = input.source === "ai" && (await hasSlidesShared(db));
  const { error } = await db.from("rita_lesson_slides").upsert(
    {
      lesson_id: input.lessonId,
      slides: input.slides,
      source: input.source,
      model: input.model,
      created_by: input.userId,
      ...(unshare ? { shared: false } : {}),
    },
    { onConflict: "lesson_id" },
  );
  fail(error, "save slides");
  return { slides: input.slides, source: input.source, model: input.model };
}

/** Writes a slide deck for one lesson from its own pages. Replaces any earlier deck. */
export const adminGenerateSlides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    if (!(await hasSlidesTable(db))) {
      throw new Error(
        "Could not find the table rita_lesson_slides: apply migration 20261017120000.",
      );
    }
    const { data: lesson, error } = await db
      .from("rita_lessons")
      .select(LESSON_COLUMNS)
      .eq("id", data.lessonId)
      .single();
    fail(error, "lesson");
    const row = lesson as unknown as LessonRow;
    const book = await loadBook(db, row.curriculum_id);
    const pageProblem = checkLessonPages(book, row.source_from_page, row.source_to_page);
    if (pageProblem) throw new Error(pageProblem);
    const { text, missing } = await pageText(db, book.id, row.source_from_page, row.source_to_page);
    if (missing.length > 0) {
      throw new Error(
        `These pages have no text yet: ${missing.join(", ")}. Read the scanned pages first.`,
      );
    }
    const { generateSlides } = await ai();
    const { slides, model } = await generateSlides({
      kind: book.kind,
      bookTitle: book.title,
      lessonTitle: row.title,
      topic: row.topic,
      objectives: row.objectives,
      from: row.source_from_page,
      to: row.source_to_page,
      pageText: text,
    });
    return saveDeck(db, { lessonId: row.id, slides, source: "ai", model, userId: context.userId });
  });

/** Saves a hand-edited deck. Source pages must stay inside the lesson's pages. */
export const adminSaveSlides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, slides: SlideDeckSchema }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    if (!(await hasSlidesTable(db))) {
      throw new Error(
        "Could not find the table rita_lesson_slides: apply migration 20261017120000.",
      );
    }
    const { data: lesson, error } = await db
      .from("rita_lessons")
      .select("id, source_from_page, source_to_page")
      .eq("id", data.lessonId)
      .single();
    fail(error, "lesson");
    const from = Number(lesson.source_from_page);
    const to = Number(lesson.source_to_page);
    const outside = data.slides.findIndex(
      (slide) => slide.source_page !== null && (slide.source_page < from || slide.source_page > to),
    );
    if (outside >= 0) {
      throw new Error(`slide ${outside + 1}: page is outside the lesson pages (${from}-${to})`);
    }
    return saveDeck(db, {
      lessonId: data.lessonId,
      slides: data.slides,
      source: "manual",
      model: null,
      userId: context.userId,
    });
  });

// ---------- admin: lesson resources ----------

async function loadResource(db: AuthContext["supabase"], id: string): Promise<Resource> {
  const { data, error } = await db
    .from("rita_lesson_resources")
    .select(RESOURCE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  fail(error, "resource");
  if (!data) throw new Error("This resource no longer exists.");
  return data as Resource;
}

/** Adds a PDF (already uploaded to the private bucket by the browser), a link or a video to a lesson. */
export const adminAddResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, resource: NewResourceSchema }), data),
  )
  .handler(async ({ data, context }): Promise<Resource> => {
    await assertAdmin(context);
    const db = context.supabase;
    if (!(await hasResourcesTable(db))) throw new Error(MISSING_RESOURCES);
    const { data: lesson, error: lessonError } = await db
      .from("rita_lessons")
      .select("id")
      .eq("id", data.lessonId)
      .maybeSingle();
    fail(lessonError, "lesson");
    if (!lesson) throw new Error("This lesson no longer exists.");
    const { data: existing, error: listError } = await db
      .from("rita_lesson_resources")
      .select("id, position")
      .eq("lesson_id", data.lessonId);
    fail(listError, "resources");
    const current = (existing ?? []) as { id: string; position: number }[];
    if (!canAddResource(current.length)) {
      throw new Error(`A lesson can hold at most ${MAX_RESOURCES} resources.`);
    }
    const resource = data.resource;
    let row: Record<string, unknown>;
    if (resource.kind === "pdf") {
      if (!isPdfPathFor(data.lessonId, resource.file_path)) {
        throw new Error("The file path does not belong to this lesson.");
      }
      // The browser uploaded it a moment ago; make sure it is really there.
      const folder = resource.file_path.slice(0, resource.file_path.lastIndexOf("/"));
      const name = resource.file_path.slice(resource.file_path.lastIndexOf("/") + 1);
      const { data: found, error: findError } = await db.storage
        .from(RESOURCES_BUCKET)
        .list(folder, { search: name, limit: 1 });
      fail(findError, "find file");
      if (!found?.some((object) => object.name === name)) {
        throw new Error("The file was not uploaded. Try again.");
      }
      row = {
        kind: "pdf",
        title: resource.title,
        note: resource.note,
        file_path: resource.file_path,
        file_name: resource.file_name,
        file_size: resource.file_size,
      };
    } else {
      row = { kind: resource.kind, title: resource.title, note: resource.note, url: resource.url };
    }
    const { data: created, error } = await db
      .from("rita_lesson_resources")
      .insert({
        ...row,
        lesson_id: data.lessonId,
        position: nextPosition(current),
        created_by: context.userId,
      })
      .select(RESOURCE_COLUMNS)
      .single();
    fail(error, "add resource");
    return created as Resource;
  });

/** Renames a resource or changes its note. The file or address itself never changes: add a new one instead. */
export const adminUpdateResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ id: uuid, edit: ResourceEditSchema }), data),
  )
  .handler(async ({ data, context }): Promise<Resource> => {
    await assertAdmin(context);
    const db = context.supabase;
    if (!(await hasResourcesTable(db))) throw new Error(MISSING_RESOURCES);
    const { data: updated, error } = await db
      .from("rita_lesson_resources")
      .update({ title: data.edit.title, note: data.edit.note })
      .eq("id", data.id)
      .select(RESOURCE_COLUMNS)
      .maybeSingle();
    fail(error, "update resource");
    if (!updated) throw new Error("This resource no longer exists.");
    return updated as Resource;
  });

/** Removes a resource, and its stored file when it is a PDF. */
export const adminDeleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ id: uuid }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    if (!(await hasResourcesTable(db))) throw new Error(MISSING_RESOURCES);
    const row = await loadResource(db, data.id);
    const { error } = await db.from("rita_lesson_resources").delete().eq("id", row.id);
    fail(error, "delete resource");
    if (row.file_path) {
      // The row is already gone; a leftover file is harmless and only logged.
      const removed = await db.storage.from(RESOURCES_BUCKET).remove([row.file_path]);
      if (removed.error) console.warn("Could not remove resource file", removed.error.message);
    }
    return { id: row.id };
  });

/** Saves a new order. The list must name exactly this lesson's resources, once each. */
export const adminReorderResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, ids: z.array(uuid).max(MAX_RESOURCES) }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    if (!(await hasResourcesTable(db))) throw new Error(MISSING_RESOURCES);
    const { data: rows, error } = await db
      .from("rita_lesson_resources")
      .select("id")
      .eq("lesson_id", data.lessonId);
    fail(error, "resources");
    const current = ((rows ?? []) as { id: string }[]).map((row) => row.id);
    if (!isCompleteOrder(current, data.ids)) {
      throw new Error("The list changed. Reload the page and try again.");
    }
    for (let index = 0; index < data.ids.length; index += 1) {
      const result = await db
        .from("rita_lesson_resources")
        .update({ position: index })
        .eq("id", data.ids[index])
        .eq("lesson_id", data.lessonId);
      fail(result.error, "reorder resources");
    }
    return { ids: data.ids };
  });

/** A short-lived link so an admin can open a stored PDF. */
export const adminResourceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ id: uuid }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = await loadResource(context.supabase, data.id);
    if (row.url) return { href: row.url };
    if (!row.file_path) throw new Error("This resource has no file.");
    const signed = await context.supabase.storage
      .from(RESOURCES_BUCKET)
      .createSignedUrl(row.file_path, 60 * 10);
    fail(signed.error, "sign file");
    return { href: signed.data!.signedUrl };
  });

/**
 * The resources a learner (or an admin previewing) sees with a lesson. Rows are
 * read through RLS, so a draft lesson shows nothing to a learner; PDF links are
 * signed here and expire in an hour. Any failure leaves the lesson without
 * resources instead of breaking it.
 */
async function lessonResourcesFor(ctx: AuthContext, lessonId: string): Promise<LearnerResource[]> {
  try {
    if (!(await hasResourcesTable(ctx.supabase))) return [];
    const { data, error } = await ctx.supabase
      .from("rita_lesson_resources")
      .select(RESOURCE_COLUMNS)
      .eq("lesson_id", lessonId);
    if (error || !data?.length) return [];
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/legacy-client.server");
    const out: LearnerResource[] = [];
    for (const row of sortResources(data as Resource[])) {
      if (row.url) {
        out.push({
          id: row.id,
          kind: row.kind,
          title: row.title,
          note: row.note,
          href: row.url,
          host: hostLabel(row.url),
          size: null,
        });
      } else if (row.file_path) {
        const signed = await admin.storage
          .from(RESOURCES_BUCKET)
          .createSignedUrl(row.file_path, 60 * 60);
        if (signed.error || !signed.data) continue;
        out.push({
          id: row.id,
          kind: row.kind,
          title: row.title,
          note: row.note,
          href: signed.data.signedUrl,
          host: "",
          size: row.file_size,
        });
      }
    }
    return out;
  } catch (cause) {
    console.warn("Lesson resources unavailable", cause);
    return [];
  }
}

/** Shows a lesson's slides to learners, or hides them again. Only a saved deck can be shared. */
export const adminSetSlidesShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, shared: z.boolean() }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase;
    if (!(await hasSlidesShared(db))) {
      throw new Error("Could not find the column shared: apply migration 20261017200000.");
    }
    const { data: updated, error } = await db
      .from("rita_lesson_slides")
      .update({ shared: data.shared })
      .eq("lesson_id", data.lessonId)
      .select("lesson_id")
      .maybeSingle();
    fail(error, "share slides");
    if (!updated) throw new Error("Save the slides first, then share them.");
    return { lessonId: data.lessonId, shared: data.shared };
  });

const AUTO_IMAGE_COOLDOWN_MS = 10 * 60 * 1000;

/** A picture that is still a placeholder: none yet, or one of the bundled drawings. */
function needsRealImage(imageUrl: string | null) {
  return !imageUrl || imageUrl.startsWith("/curriculum/");
}

export type EnsureImageResult = {
  status: "ready" | "generated" | "busy" | "unavailable";
  imageUrl: string | null;
};

/**
 * Makes a real picture for a lesson the learner opened, once. The scene is the
 * lesson's own saved prompt (nothing from the browser), and a short lock in the
 * database stops two learners paying for the same picture. Every failure is
 * quiet: the lesson keeps its current picture.
 */
export const ensureLessonImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid }), data))
  .handler(async ({ data, context }): Promise<EnsureImageResult> => {
    // Row-level security hides unpublished lessons from learners.
    const lesson = await loadPublishedLesson(context, data.lessonId);
    if (!needsRealImage(lesson.image_url)) return { status: "ready", imageUrl: lesson.image_url };
    try {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/legacy-client.server");
      const now = new Date();
      const staleBefore = new Date(now.getTime() - AUTO_IMAGE_COOLDOWN_MS).toISOString();
      const { data: claimed, error: claimError } = await admin
        .from("rita_lessons")
        .update({ image_generating_at: now.toISOString() })
        .eq("id", lesson.id)
        .or("image_url.is.null,image_url.like./curriculum/*")
        .or(`image_generating_at.is.null,image_generating_at.lt.${staleBefore}`)
        .select("id, title, topic, image_prompt")
        .maybeSingle();
      // The lock column comes from a migration; without it the feature is off.
      if (claimError) {
        if (!isMissingSchemaError(claimError))
          console.warn("Lesson image claim failed", claimError);
        return { status: "unavailable", imageUrl: null };
      }
      if (!claimed) return { status: "busy", imageUrl: null };
      const release = () =>
        admin.from("rita_lessons").update({ image_generating_at: null }).eq("id", lesson.id);
      try {
        const scene = String(claimed.image_prompt || `${claimed.title}: ${claimed.topic}`);
        const { generateLessonImage } = await ai();
        const image = await generateLessonImage(scene);
        const path = `lessons/${lesson.id}-${Date.now()}.webp`;
        const upload = await admin.storage
          .from("rita-lesson-images")
          .upload(path, image.bytes, { contentType: image.contentType, upsert: true });
        fail(upload.error, "upload image");
        const signed = await admin.storage
          .from("rita-lesson-images")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        fail(signed.error, "sign image");
        const imageUrl = signed.data!.signedUrl;
        const { error: saveError } = await admin
          .from("rita_lessons")
          .update({ image_url: imageUrl, image_generating_at: null })
          .eq("id", lesson.id);
        fail(saveError, "save image");
        return { status: "generated", imageUrl };
      } catch (cause) {
        // No API key yet: free the lock so adding the key works straight away.
        // Any other failure keeps the lock as a cool-down before the next try.
        if (cause instanceof Error && (cause as { status?: number }).status === 503)
          await release();
        console.warn("Lesson image generation failed", cause);
        return { status: "unavailable", imageUrl: null };
      }
    } catch (cause) {
      console.warn("Lesson image generation unavailable", cause);
      return { status: "unavailable", imageUrl: null };
    }
  });

// ---------- learners ----------

type PathSourceRow = {
  id: string;
  title: string;
  title_ar: string;
  topic: string;
  image_url: string | null;
  objectives: unknown;
  curriculum: { kind?: string } | null;
};

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
  /** Slides an admin chose to share, and attached resources: shown before the lesson starts. */
  slide_count: number;
  resource_count: number;
};

/** A finished lesson suggested for review after a week. */
export type ReviewSuggestion = {
  id: string;
  title: string;
  daysAgo: number;
};

export const getLessonPath = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z
        .object({ language: languageCodeSchema.nullable().default(null) })
        .default({ language: null }),
      data,
    ),
  )
  .handler(async ({ data, context }) => {
    // RLS limits this to published lessons of published books. With a language, only the books
    // that teach it (each language has its own path); with none, as before.
    let query = context.supabase
      .from("rita_lessons")
      .select(
        "id, title, title_ar, topic, image_url, objectives, path_order, curriculum:rita_curricula!inner(kind, status)",
      )
      .eq("status", "published")
      .eq("curriculum.status", "published");
    if (data.language) query = query.eq("curriculum.target_language", data.language);
    const { data: lessons, error } = await query.order("path_order", {
      ascending: true,
      nullsFirst: false,
    });
    fail(error, "lessons");
    // Before the 20261015120000 migration is applied, last_completed_at does not
    // exist yet and must not be requested (completed_at still backs the logic).
    const gaps = await hasCurriculumGaps(context.supabase);
    const { data: progress, error: progressError } = await context.supabase
      .from("rita_lesson_progress")
      .select(
        gaps
          ? "lesson_id, status, stars, best_score, completed_at, last_completed_at"
          : "lesson_id, status, stars, best_score, completed_at",
      )
      .eq("user_id", context.userId);
    fail(progressError, "progress");
    type ProgressRow = {
      lesson_id: string;
      status: string;
      stars: number;
      best_score: number;
      completed_at: string | null;
      last_completed_at: string | null;
    };
    const byLesson: Record<string, ProgressRow> = {};
    for (const row of (progress ?? []) as unknown as ProgressRow[]) {
      byLesson[row.lesson_id] = row;
    }
    // A lesson completed once stays done while the learner retries it, so a
    // replay never locks the frontier lesson.
    const pathProgress: Record<string, { status: string; stars: number }> = {};
    for (const [lessonId, row] of Object.entries(byLesson)) {
      pathProgress[lessonId] = { status: effectiveProgressStatus(row), stars: row.stars };
    }
    const slideCounts: Record<string, number> = {};
    const resourceCounts: Record<string, number> = {};
    try {
      if (await hasSlidesShared(context.supabase)) {
        const { data: decks } = await context.supabase
          .from("rita_lesson_slides")
          .select("lesson_id, slides")
          .eq("shared", true);
        for (const row of (decks ?? []) as { lesson_id: string; slides: unknown }[]) {
          if (Array.isArray(row.slides)) slideCounts[row.lesson_id] = row.slides.length;
        }
      }
      if (await hasResourcesTable(context.supabase)) {
        const { data: rows } = await context.supabase
          .from("rita_lesson_resources")
          .select("lesson_id");
        for (const row of (rows ?? []) as { lesson_id: string }[]) {
          resourceCounts[row.lesson_id] = (resourceCounts[row.lesson_id] ?? 0) + 1;
        }
      }
    } catch (cause) {
      // The map works without the extras.
      console.warn("Lesson extras unavailable", cause);
    }
    const nodes = lessonPathStates((lessons ?? []) as PathSourceRow[], pathProgress).map(
      (lesson): PathLesson => ({
        id: lesson.id,
        kind: lesson.curriculum?.kind === "vocabulary" ? "vocabulary" : "grammar",
        title: lesson.title,
        title_ar: lesson.title_ar,
        topic: lesson.topic,
        image_url: lesson.image_url,
        objective_count: Array.isArray(lesson.objectives) ? lesson.objectives.length : 0,
        state: lesson.state,
        stars: Math.max(lesson.stars, starsFor(byLesson[lesson.id]?.best_score ?? 0)),
        best_score: byLesson[lesson.id]?.best_score ?? 0,
        in_progress: byLesson[lesson.id]?.status === "in_progress",
        slide_count: slideCounts[lesson.id] ?? 0,
        resource_count: resourceCounts[lesson.id] ?? 0,
      }),
    );
    // Spaced review: lessons finished more than a week ago come back as
    // suggestions (a replay never locks the learner's frontier lesson).
    const now = Date.now();
    const reviews: ReviewSuggestion[] = [];
    for (const lesson of (lessons ?? []) as { id: string; title: string; title_ar: string }[]) {
      const row = byLesson[lesson.id];
      const finishedAt = row?.last_completed_at ?? row?.completed_at;
      if (!finishedAt) continue;
      const age = now - Date.parse(finishedAt);
      if (!Number.isFinite(age) || age < REVIEW_AFTER_MS) continue;
      reviews.push({
        id: lesson.id,
        title: lesson.title_ar || lesson.title,
        daysAgo: Math.floor(age / 86_400_000),
      });
    }
    return { lessons: nodes, reviews };
  });

/** What a learner can look at before starting a lesson. Reading it records nothing. */
export type LessonPreview = {
  lesson: {
    id: string;
    title: string;
    title_ar: string;
    topic: string;
    image_url: string | null;
    objectives: { id: string; text: string; text_ar: string }[];
  };
  slides: Slide[];
  resources: LearnerResource[];
};

export const getLessonPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid }), data))
  .handler(async ({ data, context }): Promise<LessonPreview> => {
    // RLS plus the published check keep drafts and archived lessons out.
    const lesson = await loadPublishedLesson(context, data.lessonId);
    let slides: Slide[] = [];
    try {
      if (await hasSlidesShared(context.supabase)) {
        const { data: deck } = await context.supabase
          .from("rita_lesson_slides")
          .select("slides")
          .eq("lesson_id", lesson.id)
          .eq("shared", true)
          .maybeSingle();
        const parsed = SlideDeckSchema.safeParse(deck?.slides);
        if (parsed.success) slides = parsed.data;
      }
    } catch (cause) {
      console.warn("Lesson slides unavailable", cause);
    }
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
        })),
      },
      slides,
      resources: await lessonResourcesFor(context, lesson.id),
    };
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
  progress: {
    status: string;
    objectives: ObjectiveState;
    score: number;
    stars: number;
    attempts: number;
  };
  nextLessonId: string | null;
  /** Study material the admin attached to this lesson (optional, never required to start). */
  resources: LearnerResource[];
};

async function loadPublishedLesson(ctx: AuthContext, lessonId: string, allowDraft = false) {
  const { data, error } = await ctx.supabase
    .from("rita_lessons")
    .select(
      "id, title, title_ar, topic, image_url, objectives, plan, vocabulary, version, path_order, status",
    )
    .eq("id", lessonId)
    .maybeSingle();
  fail(error, "lesson");
  if (!data) throw new Error("This lesson is not available.");
  // Admin preview may open a draft; RLS already hides drafts from learners.
  if (data.status !== "published" && !(allowDraft && data.status === "draft")) {
    throw new Error("This lesson is not available.");
  }
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
    status: string;
  };
}

/** Keeps only objectives that still exist after the lesson was edited. */
function currentState(objectives: Objective[], stored: unknown): ObjectiveState {
  const state: ObjectiveState = {};
  const raw = (stored && typeof stored === "object" ? stored : {}) as ObjectiveState;
  for (const objective of objectives)
    if (raw[objective.id]?.met) state[objective.id] = raw[objective.id];
  return state;
}

/**
 * Lesson progress is written with the server key, never the learner's. The live database only lets
 * learners read their rows (the write policies were never added to its migrations), so a write
 * through the learner's client was refused or, for an update, silently changed nothing. Every
 * write below is scoped to the signed-in user by hand.
 */
async function progressWriter() {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  return supabaseAdmin;
}

/**
 * Opens a lesson for the learner. A finished lesson starts a fresh attempt
 * (best score kept); an unfinished one resumes with the objectives already met.
 */
export const startLessonAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(
      z.object({
        lessonId: uuid,
        restart: z.boolean().default(false),
        preview: z.boolean().default(false),
      }),
      data,
    ),
  )
  .handler(async ({ data, context }): Promise<LessonSession> => {
    if (data.preview) await assertAdmin(context);
    const lesson = await loadPublishedLesson(context, data.lessonId, data.preview);
    const resources = await lessonResourcesFor(context, lesson.id);
    const lessonPayload = {
      resources,
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
    };
    if (data.preview) {
      // Admin preview: the session is transient and no progress row is written.
      const next = await nextLessonAfter(context, lesson.path_order);
      return {
        ...lessonPayload,
        progress: { status: "in_progress", objectives: {}, score: 0, stars: 0, attempts: 0 },
        nextLessonId: next,
      };
    }
    const db = context.supabase;
    const { data: existing, error } = await db
      .from("rita_lesson_progress")
      .select("id, status, objectives, score, stars, attempts")
      .eq("user_id", context.userId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    fail(error, "progress");
    let row = existing as {
      id: string;
      status: string;
      objectives: unknown;
      score: number;
      stars: number;
      attempts: number;
    } | null;
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
      const writer = await progressWriter();
      const { data: created, error: insertError } = await writer
        .from("rita_lesson_progress")
        .upsert(
          { user_id: context.userId, lesson_id: lesson.id, ...fresh },
          { onConflict: "user_id,lesson_id" },
        )
        .select("id, status, objectives, score, stars, attempts")
        .single();
      fail(insertError, "start lesson");
      row = created;
    } else if (row.status === "completed" || data.restart) {
      const writer = await progressWriter();
      const { data: updated, error: updateError } = await writer
        .from("rita_lesson_progress")
        .update({ ...fresh, attempts: row.attempts + 1 })
        .eq("id", row.id)
        .eq("user_id", context.userId)
        .select("id, status, objectives, score, stars, attempts")
        .single();
      fail(updateError, "restart lesson");
      row = updated;
    }
    const state = currentState(lesson.objectives, row!.objectives);
    const next = await nextLessonAfter(context, lesson.path_order);
    // last_completed_at is never cleared on a restart, so a replay keeps the
    // lesson marked done in the learner path.
    return {
      ...lessonPayload,
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
    parseWith(
      z.object({
        lessonId: uuid,
        turns: z.array(z.unknown()).max(20),
        preview: z.boolean().default(false),
        // Transient preview state kept client-side between checks, so objectives
        // met earlier in the preview are never forgotten. Never persisted.
        previewState: z.record(z.string(), z.unknown()).nullable().default(null),
      }),
      data,
    ),
  )
  .handler(async ({ data, context }): Promise<LessonEvaluationResult> => {
    if (data.preview) await assertAdmin(context);
    const lesson = await loadPublishedLesson(context, data.lessonId, data.preview);
    if (data.preview) {
      // Admin preview: the objectives are judged but nothing is saved.
      const previous =
        data.previewState && typeof data.previewState === "object"
          ? (data.previewState as ObjectiveState)
          : {};
      const turns = cleanTurns(data.turns);
      const learnerText = turns
        .filter((turn) => turn.role === "user")
        .map((turn) => turn.text)
        .join("\n");
      if (learnerText.replace(/\s+/g, "").length < 2) {
        // No answer: the transient state is preserved, not wiped.
        return {
          objectives: previous,
          newlyMet: [],
          score: scoreLesson(lesson.objectives, previous),
          stars: starsFor(scoreLesson(lesson.objectives, previous)),
          completed: isLessonComplete(lesson.objectives, previous),
          skipped: "no_answer",
        };
      }
      const open = lesson.objectives.filter((objective) => objective.id);
      const { evaluateTurns } = await ai();
      const { evaluation } = await evaluateTurns({
        lessonTitle: lesson.title,
        objectives: open,
        turns,
      });
      const merged = mergeObjectiveState(
        previous,
        evaluation,
        open,
        learnerText,
        new Date().toISOString(),
      );
      const score = scoreLesson(lesson.objectives, merged.state);
      return {
        objectives: merged.state,
        newlyMet: merged.newlyMet,
        score,
        stars: starsFor(score),
        completed: isLessonComplete(lesson.objectives, merged.state),
      };
    }
    const db = context.supabase;
    const gaps = await hasCurriculumGaps(db);
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
    const { evaluation } = await evaluateTurns({
      lessonTitle: lesson.title,
      objectives: open,
      turns,
    });
    const merged = mergeObjectiveState(
      state,
      evaluation,
      open,
      learnerText,
      new Date().toISOString(),
    );
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
      // Remembers "completed at least once" across future restarts. Omitted
      // before the migration is applied so the write keeps working.
      if (gaps) patch.last_completed_at = patch.completed_at;
    }
    // Guard on in_progress so two overlapping calls cannot complete twice.
    const writer = await progressWriter();
    const { error: updateError } = await writer
      .from("rita_lesson_progress")
      .update(patch)
      .eq("id", row.id)
      .eq("user_id", context.userId)
      .eq("status", "in_progress");
    fail(updateError, "save progress");
    return { objectives: merged.state, newlyMet: merged.newlyMet, score, stars, completed };
  });

// ---------- admin: lesson exercises (content version 2) ----------

export type ExercisesView = {
  /** False until the lessons v2 migration is applied. */
  ready: boolean;
  status: "none" | "draft" | "published";
  version: number;
  content: LessonContent | null;
  /** From the offline review: things for the admin to look at. */
  warnings: string[];
  /** From the code checks: these block publishing. */
  problems: string[];
  updated_at: string | null;
};

/** The content table holds answers, so it is read and written with the server key only. */
async function contentsDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as unknown as SupabaseClient<any, "public", any>;
}

async function readExercises(lessonId: string): Promise<ExercisesView> {
  const db = await contentsDb();
  const { data, error } = await db
    .from("rita_lesson_contents")
    .select("content, version, status, warnings, updated_at")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) {
      return {
        ready: false,
        status: "none",
        version: 0,
        content: null,
        warnings: [],
        problems: [],
        updated_at: null,
      };
    }
    fail(error, "exercises");
  }
  if (!data) {
    return {
      ready: true,
      status: "none",
      version: 0,
      content: null,
      warnings: [],
      problems: [],
      updated_at: null,
    };
  }
  const content = parseLessonContent(data.content);
  return {
    ready: true,
    status: data.status === "published" ? "published" : "draft",
    version: Number(data.version) || 1,
    content,
    warnings: Array.isArray(data.warnings) ? data.warnings.map(String).slice(0, 40) : [],
    problems: content ? contentProblems(content) : ["The saved exercises could not be read."],
    updated_at: data.updated_at ? String(data.updated_at) : null,
  };
}

async function writeExercises(
  lessonId: string,
  patch: {
    content?: LessonContent;
    status?: "draft" | "published";
    warnings?: string[];
    version?: number;
  },
) {
  const db = await contentsDb();
  const { data: existing } = await db
    .from("rita_lesson_contents")
    .select("lesson_id, version")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (existing) {
    const { error } = await db.from("rita_lesson_contents").update(patch).eq("lesson_id", lessonId);
    fail(error, "save exercises");
  } else {
    if (!patch.content) throw new Error("Generate the exercises first.");
    const { error } = await db.from("rita_lesson_contents").insert({
      lesson_id: lessonId,
      content: patch.content,
      status: patch.status ?? "draft",
      warnings: patch.warnings ?? [],
      version: patch.version ?? 1,
    });
    fail(error, "save exercises");
  }
}

/** The lesson, its book and its page text, as the exercise generator needs them. */
async function lessonWithPages(ctx: AuthContext, lessonId: string) {
  const db = ctx.supabase;
  const { data: lesson, error } = await db
    .from("rita_lessons")
    .select(LESSON_COLUMNS)
    .eq("id", lessonId)
    .single();
  fail(error, "lesson");
  const row = lesson as unknown as LessonRow;
  const book = await loadBook(db, row.curriculum_id);
  const pageProblem = checkLessonPages(book, row.source_from_page, row.source_to_page);
  if (pageProblem) throw new Error(pageProblem);
  const { text, missing } = await pageText(db, book.id, row.source_from_page, row.source_to_page);
  if (missing.length > 0) {
    throw new Error(
      `These pages have no text yet: ${missing.join(", ")}. Read the scanned pages first.`,
    );
  }
  return { row, book, text };
}

export const adminLessonExercises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid }), data))
  .handler(async ({ data, context }): Promise<ExercisesView> => {
    await assertAdmin(context);
    return readExercises(data.lessonId);
  });

/**
 * Writes the exercises for a lesson from its pages, then has them checked a second time by a
 * separate review. The result is a draft: nothing reaches learners until an admin publishes it.
 */
export const adminGenerateExercises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(z.object({ lessonId: uuid }), data))
  .handler(async ({ data, context }): Promise<ExercisesView> => {
    await assertAdmin(context);
    const current = await readExercises(data.lessonId);
    if (!current.ready) {
      throw new Error("Apply migration 20261025100000_rita_lessons_v2 in Lovable Cloud first.");
    }
    const { row, book, text } = await lessonWithPages(context, data.lessonId);
    const { generateLessonContent, reviewLessonContent } = await ai();
    const { content } = await generateLessonContent({
      kind: book.kind,
      bookTitle: book.title,
      lessonTitle: row.title,
      topic: row.topic,
      objectives: row.objectives,
      vocabulary: (row.vocabulary ?? []).map((item) => ({
        word: item.word,
        meaning_ar: item.meaning_ar,
      })),
      from: row.source_from_page,
      to: row.source_to_page,
      pageText: text,
    });
    let warnings: string[];
    try {
      const review = await reviewLessonContent({ content, pageText: text });
      warnings = review.warnings.map((warning) =>
        warning.item_id ? `${warning.item_id}: ${warning.problem}` : warning.problem,
      );
    } catch (error) {
      warnings = [
        `The second review could not run (${error instanceof Error ? error.message : "error"}). Check the questions yourself.`,
      ];
    }
    await writeExercises(data.lessonId, {
      content,
      status: "draft",
      warnings,
      version: current.version || 1,
    });
    return readExercises(data.lessonId);
  });

/** Saves hand edits as a draft. Content that fails the code checks is refused with the reasons. */
export const adminSaveExercises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, content: z.unknown() }), data),
  )
  .handler(async ({ data, context }): Promise<ExercisesView> => {
    await assertAdmin(context);
    const parsed = LessonContentSchema.safeParse(data.content);
    if (!parsed.success) throw new Error(describeSchemaError(parsed.error));
    const problems = contentProblems(parsed.data);
    if (problems.length) throw new Error(problems.slice(0, 5).join(" "));
    await writeExercises(data.lessonId, { content: parsed.data, status: "draft" });
    return readExercises(data.lessonId);
  });

/** One new question in place of one item (same kind and skill), saved as a draft. */
export const adminRegenerateExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, itemId: z.string().max(48) }), data),
  )
  .handler(async ({ data, context }): Promise<ExercisesView> => {
    await assertAdmin(context);
    const current = await readExercises(data.lessonId);
    if (!current.content) throw new Error("Generate the exercises first.");
    const found = findItem(current.content, data.itemId);
    if (!found) throw new Error("That question was not found.");
    const { text } = await lessonWithPages(context, data.lessonId);
    const { regenerateExerciseItem } = await ai();
    const { item } = await regenerateExerciseItem({
      section: found.section,
      item: found.item,
      pageText: text,
    });
    const content: LessonContent = {
      ...current.content,
      sections: current.content.sections.map((section) =>
        section.id !== found.section.id
          ? section
          : {
              ...section,
              [found.bank]: section[found.bank].map((old) => (old.id === item.id ? item : old)),
            },
      ),
    };
    await writeExercises(data.lessonId, {
      content,
      status: "draft",
      warnings: current.warnings.filter((warning) => !warning.startsWith(`${item.id}:`)),
    });
    return readExercises(data.lessonId);
  });

/**
 * Publishes the exercises (learners get them on their next attempt; an attempt in progress keeps
 * its own copy) or takes them back to a draft (learners get the spoken lesson again).
 */
export const adminPublishExercises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parseWith(z.object({ lessonId: uuid, publish: z.boolean() }), data),
  )
  .handler(async ({ data, context }): Promise<ExercisesView> => {
    await assertAdmin(context);
    const current = await readExercises(data.lessonId);
    if (!current.content) throw new Error("Generate the exercises first.");
    if (data.publish) {
      if (current.problems.length) {
        throw new Error(`Fix these first: ${current.problems.slice(0, 3).join(" ")}`);
      }
      await writeExercises(data.lessonId, {
        status: "published",
        version: current.status === "published" ? current.version : current.version + 1,
      });
    } else {
      await writeExercises(data.lessonId, { status: "draft" });
    }
    return readExercises(data.lessonId);
  });
