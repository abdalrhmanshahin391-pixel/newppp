// Server functions for "Rita - interactive study", admin side: choose a lesson's experience, link a
// PDF guide to it (printing the learners' final copy first), and the feature switch. Everything runs
// with the admin's own session under row level security, like the guide functions: no service key.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { GuideContentSchema } from "@/lib/guides/guide-content";
import { STUDY_FLAG, studyBlocker, type Experience } from "./study-experience";
import type { StudyLessonData } from "./study-types";
import {
  LINK_PROBLEM_TEXT,
  coversLesson,
  highWarnings,
  learnerGuidePath,
  linkProblem,
} from "./study-link";

const uuid = z.string().uuid();

function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error("Bad request.");
  return result.data;
}

function describe(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? "")).slice(0, 240);
}

const NOT_APPLIED = /could not find|does not exist|schema cache|PGRST20[0-9]|42703|42P01/i;

export type StudyGuideOption = {
  id: string;
  title: string;
  version: number;
  status: string;
  from_page: number;
  to_page: number;
  high_warnings: number;
  warnings: number;
  learner_ready: boolean;
  allow_download: boolean;
  created_at: string;
  /** Why this guide cannot be linked, in Arabic; empty when it can. */
  problem: string;
};

export type StudyLessonState =
  | { ready: false }
  | {
      ready: true;
      lessonId: string;
      lessonStatus: string;
      experience: Experience;
      linkedGuideId: string | null;
      switchOn: boolean;
      /** Why learners do not get the study page yet ("" when they do). */
      blocker: "" | "not_study" | "no_guide" | "switch_off";
      guides: StudyGuideOption[];
    };

export const adminStudyLessonState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ lessonId: uuid }), data))
  .handler(async ({ data, context }): Promise<StudyLessonState> => {
    const { assertGuideAdmin } = await import("@/lib/guides/guide-admin.server");
    await assertGuideAdmin(context);
    const db = context.supabase;
    const { data: lesson, error } = await db
      .from("rita_lessons")
      .select(
        "id, curriculum_id, status, source_from_page, source_to_page, experience, study_guide_id",
      )
      .eq("id", data.lessonId)
      .maybeSingle();
    if (error) {
      if (NOT_APPLIED.test(`${error.code ?? ""} ${error.message}`)) return { ready: false };
      throw new Error(`lesson: ${error.message}`);
    }
    if (!lesson) throw new Error("This lesson was not found.");
    const [{ data: rows, error: guidesError }, { data: flag }] = await Promise.all([
      db
        .from("rita_lesson_guides")
        .select(
          "id, curriculum_id, title, version, status, from_page, to_page, warnings, content, learner_path, allow_download, created_at",
        )
        .eq("curriculum_id", lesson.curriculum_id)
        .order("created_at", { ascending: false })
        .limit(60),
      db.from("rita_feature_flags").select("enabled").eq("key", STUDY_FLAG).maybeSingle(),
    ]);
    if (guidesError) {
      if (NOT_APPLIED.test(`${guidesError.code ?? ""} ${guidesError.message}`))
        return { ready: false };
      throw new Error(`guides: ${guidesError.message}`);
    }
    const lessonPages = {
      curriculum_id: String(lesson.curriculum_id),
      source_from_page: Number(lesson.source_from_page),
      source_to_page: Number(lesson.source_to_page),
    };
    const guides: StudyGuideOption[] = [];
    for (const row of rows ?? []) {
      const guide = {
        curriculum_id: String(row.curriculum_id),
        status: String(row.status),
        from_page: Number(row.from_page),
        to_page: Number(row.to_page),
        warnings: row.warnings,
        content_ok: GuideContentSchema.safeParse(row.content).success,
      };
      // The linked guide always shows; others only when their pages meet the lesson's pages.
      if (row.id !== lesson.study_guide_id && !coversLesson(guide, lessonPages)) continue;
      const problem = linkProblem(guide, lessonPages);
      guides.push({
        id: String(row.id),
        title: String(row.title),
        version: Number(row.version),
        status: guide.status,
        from_page: guide.from_page,
        to_page: guide.to_page,
        high_warnings: highWarnings(row.warnings),
        warnings: Array.isArray(row.warnings) ? row.warnings.length : 0,
        learner_ready: Boolean(row.learner_path),
        allow_download: row.allow_download !== false,
        created_at: String(row.created_at),
        problem: problem ? LINK_PROBLEM_TEXT[problem] : "",
      });
    }
    const switchOn = Boolean(flag?.enabled);
    const linked = guides.find((guide) => guide.id === lesson.study_guide_id) ?? null;
    const experience: Experience = lesson.experience === "study" ? "study" : "classic";
    return {
      ready: true,
      lessonId: String(lesson.id),
      lessonStatus: String(lesson.status),
      experience,
      linkedGuideId: lesson.study_guide_id ? String(lesson.study_guide_id) : null,
      switchOn,
      blocker: studyBlocker({
        experience,
        guide: linked
          ? { status: linked.status, learner_path: linked.learner_ready ? "yes" : null }
          : null,
        switchOn,
      }),
      guides,
    };
  });

export const adminSetLessonExperience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parse(z.object({ lessonId: uuid, experience: z.enum(["classic", "study"]) }), data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertGuideAdmin } = await import("@/lib/guides/guide-admin.server");
    await assertGuideAdmin(context);
    const { error } = await context.supabase
      .from("rita_lessons")
      .update({ experience: data.experience })
      .eq("id", data.lessonId);
    if (error) throw new Error(`lesson: ${error.message}`);
    return { ok: true };
  });

export type LinkGuideResult = { ok: true } | { ok: false; message: string };

/**
 * Links a guide to a lesson. The learners' copy is printed first, without the draft footer, and
 * stored next to the draft; only then does the lesson point at the guide. A failure leaves the
 * lesson exactly as it was (still showing its previous guide, if any).
 */
export const adminLinkStudyGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ lessonId: uuid, guideId: uuid }), data))
  .handler(async ({ data, context }): Promise<LinkGuideResult> => {
    const { assertGuideAdmin } = await import("@/lib/guides/guide-admin.server");
    await assertGuideAdmin(context);
    const db = context.supabase;
    const [{ data: lesson, error: lessonError }, { data: guide, error: guideError }] =
      await Promise.all([
        db
          .from("rita_lessons")
          .select("id, curriculum_id, source_from_page, source_to_page")
          .eq("id", data.lessonId)
          .maybeSingle(),
        db
          .from("rita_lesson_guides")
          .select(
            "id, curriculum_id, status, version, from_page, to_page, warnings, content, learner_path",
          )
          .eq("id", data.guideId)
          .maybeSingle(),
      ]);
    if (lessonError) throw new Error(`lesson: ${lessonError.message}`);
    if (guideError) throw new Error(`guide: ${guideError.message}`);
    if (!lesson || !guide) return { ok: false, message: "الدرس أو الدليل مش موجود." };
    const content = GuideContentSchema.safeParse(guide.content);
    const problem = linkProblem(
      {
        curriculum_id: String(guide.curriculum_id),
        status: String(guide.status),
        from_page: Number(guide.from_page),
        to_page: Number(guide.to_page),
        warnings: guide.warnings,
        content_ok: content.success,
      },
      {
        curriculum_id: String(lesson.curriculum_id),
        source_from_page: Number(lesson.source_from_page),
        source_to_page: Number(lesson.source_to_page),
      },
    );
    if (problem || !content.success)
      return { ok: false, message: LINK_PROBLEM_TEXT[problem ?? "bad_content"] };

    // A guide row never changes once ready, so a final copy printed before is still right.
    if (!guide.learner_path) {
      const [{ renderGuideHtml }, { renderPdf, DEFAULT_GUIDES_URL }, { getServerRuntimeSecret }] =
        await Promise.all([
          import("@/lib/guides/guide-html"),
          import("@/lib/guides/guide-render"),
          import("@/lib/config.server"),
        ]);
      const rendered = await renderPdf({
        html: renderGuideHtml(content.data, { draft: false, fontBase: "fonts/" }),
        url: (await getServerRuntimeSecret("RITA_GUIDES_URL")) || DEFAULT_GUIDES_URL,
        token: await getServerRuntimeSecret("MODAL_START_TOKEN"),
      });
      if (!rendered.ok) return { ok: false, message: `ما انطبعت نسخة الطلاب: ${rendered.message}` };
      const path = learnerGuidePath(
        String(guide.curriculum_id),
        String(guide.id),
        Number(guide.version),
      );
      const { error: uploadError } = await db.storage
        .from("rita-guides")
        .upload(path, rendered.pdf, { contentType: "application/pdf", upsert: true });
      if (uploadError)
        return { ok: false, message: `ما انحفظت نسخة الطلاب: ${describe(uploadError.message)}` };
      const { error: pathError } = await db
        .from("rita_lesson_guides")
        .update({ learner_path: path })
        .eq("id", guide.id);
      if (pathError)
        return { ok: false, message: `ما انحفظت نسخة الطلاب: ${describe(pathError.message)}` };
    }

    const { error: linkError } = await db
      .from("rita_lessons")
      .update({ study_guide_id: guide.id })
      .eq("id", lesson.id);
    if (linkError) return { ok: false, message: `ما انربط الدليل: ${describe(linkError.message)}` };
    return { ok: true };
  });

export const adminUnlinkStudyGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ lessonId: uuid }), data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertGuideAdmin } = await import("@/lib/guides/guide-admin.server");
    await assertGuideAdmin(context);
    const { error } = await context.supabase
      .from("rita_lessons")
      .update({ study_guide_id: null })
      .eq("id", data.lessonId);
    if (error) throw new Error(`lesson: ${error.message}`);
    return { ok: true };
  });

export const adminSetGuideDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ guideId: uuid, allow: z.boolean() }), data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertGuideAdmin } = await import("@/lib/guides/guide-admin.server");
    await assertGuideAdmin(context);
    const { error } = await context.supabase
      .from("rita_lesson_guides")
      .update({ allow_download: data.allow })
      .eq("id", data.guideId);
    if (error) throw new Error(`guide: ${error.message}`);
    return { ok: true };
  });

export const adminSetStudySwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ enabled: z.boolean() }), data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertGuideAdmin } = await import("@/lib/guides/guide-admin.server");
    await assertGuideAdmin(context);
    const { error } = await context.supabase.from("rita_feature_flags").upsert({
      key: STUDY_FLAG,
      enabled: data.enabled,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`switch: ${error.message}`);
    return { ok: true };
  });

// ---------------------------------------------------------------------------------------------
// Learner side
// ---------------------------------------------------------------------------------------------

export type StudyPageResult =
  { status: "study"; data: StudyLessonData } | { status: "classic" } | { status: "unavailable" };

/** The study page: the lesson, its guide (final copy only) or "classic" when it opens as before. */
export const getStudyLesson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parse(z.object({ lessonId: uuid, preview: z.boolean().default(false) }), data),
  )
  .handler(async ({ data, context }): Promise<StudyPageResult> => {
    const { loadStudyLesson } = await import("./study-lesson.server");
    const result = await loadStudyLesson(
      context.supabase,
      context.userId,
      data.lessonId,
      data.preview,
    );
    if (result.ok) return { status: "study", data: result.data };
    return { status: result.reason };
  });

/** A one-hour link to the learners' copy of the guide, when the admin allows downloads. */
export const studyGuideDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parse(z.object({ lessonId: uuid, preview: z.boolean().default(false) }), data),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const [{ loadStudyLesson }, { guideFileName }] = await Promise.all([
      import("./study-lesson.server"),
      import("@/lib/guides/guide-record"),
    ]);
    const result = await loadStudyLesson(
      context.supabase,
      context.userId,
      data.lessonId,
      data.preview,
    );
    if (!result.ok) throw new Error("This lesson is not available.");
    const { guide } = result.data;
    if (!guide.allow_download) throw new Error("Downloading this file is turned off.");
    const { data: signed, error } = await context.supabase.storage
      .from("rita-guides")
      .createSignedUrl(guide.learner_path, 60 * 60, {
        download: guideFileName(guide.title, guide.version),
      });
    if (error || !signed?.signedUrl) throw new Error("The file could not be opened.");
    return { url: signed.signedUrl };
  });
