// Loads a study lesson for its learner page and for Rita's session, with the caller's own session:
// the database rules decide what is visible (a learner sees only published lessons and only the
// final copy of a linked guide). An admin's preview may open a draft lesson while the switch is off.
import type { SupabaseClient } from "@supabase/supabase-js";
import { GuideContentSchema } from "@/lib/guides/guide-content";
import { studySwitchOn } from "./study-access.server";
import { effectiveExperience } from "./study-experience";
import type { StudyLessonData } from "./study-types";

export type { StudyLessonData };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

export type StudyLessonResult =
  { ok: true; data: StudyLessonData } | { ok: false; reason: "unavailable" | "classic" };

async function isAdmin(db: Db, userId: string): Promise<boolean> {
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  return Boolean(data);
}

export async function loadStudyLesson(
  db: Db,
  userId: string,
  lessonId: string,
  preview = false,
): Promise<StudyLessonResult> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return { ok: false, reason: "unavailable" };
  const { data: lesson, error } = await db
    .from("rita_lessons")
    .select(
      "id, title, title_ar, topic, objectives, status, experience, study_guide_id, curriculum:rita_curricula!inner(status)",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (error || !lesson) return { ok: false, reason: error ? "classic" : "unavailable" };
  const published =
    lesson.status === "published" &&
    (lesson.curriculum as { status?: string } | null)?.status === "published";
  // Preview is admin only, even for a published lesson.
  const admin = !published || preview ? await isAdmin(db, userId) : false;
  if ((!published || preview) && (!admin || lesson.status === "archived"))
    return { ok: false, reason: "unavailable" };
  const adminPreview = preview && admin;
  if (lesson.experience !== "study" || !lesson.study_guide_id)
    return { ok: false, reason: "classic" };

  const [{ data: guide }, switchOn] = await Promise.all([
    db
      .from("rita_lesson_guides")
      .select("id, title, version, status, content, learner_path, allow_download")
      .eq("id", lesson.study_guide_id)
      .maybeSingle(),
    studySwitchOn(db),
  ]);
  const experience = effectiveExperience({
    experience: lesson.experience,
    guide: guide ? { status: String(guide.status), learner_path: guide.learner_path } : null,
    switchOn,
    adminPreview,
  });
  const content = GuideContentSchema.safeParse(guide?.content);
  if (experience !== "study" || !guide || !content.success) return { ok: false, reason: "classic" };

  const objectives = Array.isArray(lesson.objectives) ? lesson.objectives : [];
  return {
    ok: true,
    data: {
      lesson: {
        id: String(lesson.id),
        title: String(lesson.title),
        title_ar: String(lesson.title_ar ?? ""),
        topic: String(lesson.topic ?? ""),
        objectives: objectives
          .filter(
            (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            id: String(item.id ?? ""),
            text: String(item.text ?? ""),
            text_ar: String(item.text_ar ?? ""),
          })),
      },
      guide: {
        id: String(guide.id),
        version: Number(guide.version),
        title: String(guide.title),
        content: content.data,
        learner_path: String(guide.learner_path),
        allow_download: guide.allow_download !== false,
      },
      preview: adminPreview,
    },
  };
}
