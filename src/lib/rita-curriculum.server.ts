// Loads the lesson notes that the voice worker adds to Rita's prompt.
import { supabaseAdmin } from "@/integrations/supabase/legacy-client.server";
import {
  buildLessonBrief,
  type LessonPlan,
  type Objective,
  type ObjectiveState,
  type VocabularyItem,
} from "@/lib/rita-curriculum";

export type VoiceLesson = { id: string; title: string; brief: string };

/**
 * Returns the brief for a published lesson (admins may also preview drafts),
 * with the objectives this learner already met listed last. Null when the
 * lesson does not exist or is not available to this user.
 */
export async function loadVoiceLesson(
  userId: string,
  lessonId: string,
  preview = false,
): Promise<VoiceLesson | null> {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return null;
  const { data: lesson, error } = await supabaseAdmin
    .from("rita_lessons")
    .select(
      "id, title, title_ar, topic, objectives, plan, vocabulary, status, curriculum:rita_curricula!inner(status)",
    )
    .eq("id", lessonId)
    .maybeSingle();
  if (error || !lesson) return null;
  const published =
    lesson.status === "published" &&
    (lesson.curriculum as { status?: string })?.status === "published";
  if (!published) {
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin || lesson.status === "archived") return null;
  }
  // Preview builds the brief from a fresh state so the worker matches the
  // transient preview session; the learner's stored progress is never touched.
  const progress = preview
    ? null
    : await supabaseAdmin
        .from("rita_lesson_progress")
        .select("objectives")
        .eq("user_id", userId)
        .eq("lesson_id", lessonId)
        .maybeSingle();
  const plan = (lesson.plan ?? { phases: [] }) as LessonPlan & { summary?: string };
  const brief = buildLessonBrief(
    {
      title: String(lesson.title),
      title_ar: String(lesson.title_ar ?? ""),
      topic: String(lesson.topic ?? ""),
      summary: plan.summary,
      objectives: (lesson.objectives ?? []) as Objective[],
      plan: { phases: plan.phases ?? [], teacher_notes: plan.teacher_notes ?? "" },
      vocabulary: (lesson.vocabulary ?? []) as VocabularyItem[],
    },
    ((progress?.data?.objectives ?? {}) as ObjectiveState) || {},
  );
  return { id: String(lesson.id), title: String(lesson.title), brief };
}
