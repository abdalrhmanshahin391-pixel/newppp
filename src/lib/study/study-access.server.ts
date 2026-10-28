// Reads what decides a lesson's real experience (see study-experience.ts) with the caller's own
// session: the admin's choice, the linked guide and the feature switch. Learners can read the switch
// and only the guides linked to published study lessons (database rules), so a learner's read can
// never reveal a draft. Before the 20261028120000 migration is applied every lesson is classic.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STUDY_FLAG,
  effectiveExperience,
  type Experience,
  type StudyGuideState,
} from "./study-experience";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

function missingSchema(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return /could not find|does not exist|schema cache|PGRST20[0-9]|42703|42P01/i.test(
    `${error.code ?? ""} ${error.message ?? ""}`,
  );
}

export async function studySwitchOn(db: Db): Promise<boolean> {
  try {
    const { data, error } = await db
      .from("rita_feature_flags")
      .select("enabled")
      .eq("key", STUDY_FLAG)
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.enabled);
  } catch {
    return false;
  }
}

export type LessonStudyRow = {
  id: string;
  experience: string;
  study_guide_id: string | null;
};

/** The study columns of some lessons; null when the migration is not applied yet. */
export async function lessonStudyRows(
  db: Db,
  lessonIds: string[],
): Promise<LessonStudyRow[] | null> {
  if (!lessonIds.length) return [];
  const { data, error } = await db
    .from("rita_lessons")
    .select("id, experience, study_guide_id")
    .in("id", lessonIds);
  if (error) {
    if (missingSchema(error)) return null;
    throw new Error(`lessons: ${error.message}`);
  }
  return (data ?? []) as LessonStudyRow[];
}

/** The real experience of each lesson. Anything that cannot be read counts as classic. */
export async function lessonExperiences(
  db: Db,
  lessonIds: string[],
  options: { adminPreview?: boolean } = {},
): Promise<Record<string, Experience>> {
  const result: Record<string, Experience> = {};
  for (const id of lessonIds) result[id] = "classic";
  let rows: LessonStudyRow[] | null;
  try {
    rows = await lessonStudyRows(db, lessonIds);
  } catch (cause) {
    console.warn("Study columns unavailable", cause);
    return result;
  }
  const study = (rows ?? []).filter((row) => row.experience === "study" && row.study_guide_id);
  if (!study.length) return result;
  const [switchOn, guides] = await Promise.all([
    studySwitchOn(db),
    db
      .from("rita_lesson_guides")
      .select("id, status, learner_path")
      .in(
        "id",
        study.map((row) => row.study_guide_id as string),
      ),
  ]);
  const byId = new Map<string, StudyGuideState>();
  for (const guide of (guides.data ?? []) as {
    id: string;
    status: string;
    learner_path: string | null;
  }[])
    byId.set(guide.id, { status: guide.status, learner_path: guide.learner_path });
  for (const row of study) {
    result[row.id] = effectiveExperience({
      experience: row.experience,
      guide: byId.get(row.study_guide_id as string) ?? null,
      switchOn,
      adminPreview: options.adminPreview,
    });
  }
  return result;
}
