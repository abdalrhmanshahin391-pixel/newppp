import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

const kindSchema = z.enum(["words", "sentences"]);

async function assertCourseAccess(supabase: any, userId: string, courseId: string) {
  const { data: owned } = await supabase
    .from("user_courses")
    .select("course_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  const { data: admin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!owned && !admin) throw new Error("You do not have access to add content to this course.");
}

export const germanPersonalBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertCourseAccess(supabase, userId, data.courseId);
    const { data: rows, error } = await supabase
      .from("german_subjects")
      .select("id,title,parent_id,position")
      .eq("course_id", data.courseId)
      .eq("owner_user_id", userId)
      .order("position");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const germanCreateFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ courseId: z.string().uuid(), title: z.string().trim().min(1).max(100), parentId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertCourseAccess(supabase, userId, data.courseId);
    if (data.parentId) {
      const { data: parent } = await supabase
        .from("german_subjects")
        .select("id")
        .eq("id", data.parentId)
        .eq("course_id", data.courseId)
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (!parent) throw new Error("Choose one of your own subjects.");
    }
    const { count } = await supabase
      .from("german_subjects")
      .select("id", { count: "exact", head: true })
      .eq("course_id", data.courseId)
      .eq("owner_user_id", userId)
      .is("parent_id", data.parentId);
    const { data: row, error } = await supabase
      .from("german_subjects")
      .insert({
        course_id: data.courseId,
        title: data.title,
        parent_id: data.parentId,
        owner_user_id: userId,
        content_type: "mixed",
        position: count ?? 0,
      })
      .select("id,title,parent_id,position")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const germanAddPersonalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      courseId: z.string().uuid(),
      subtopicId: z.string().uuid(),
      kind: kindSchema,
      entries: z.array(z.object({ german: z.string().trim().min(1).max(500), english: z.string().trim().max(500) })).min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertCourseAccess(supabase, userId, data.courseId);
    const { data: subtopic } = await supabase
      .from("german_subjects")
      .select("id,title")
      .eq("id", data.subtopicId)
      .eq("course_id", data.courseId)
      .eq("owner_user_id", userId)
      .not("parent_id", "is", null)
      .maybeSingle();
    if (!subtopic) throw new Error("Choose one of your own sub-subjects.");

    const { data: existing } = await supabase
      .from("german_items")
      .select("id")
      .eq("subject_id", data.subtopicId)
      .eq("kind", data.kind)
      .maybeSingle();
    let itemId = existing?.id as string | undefined;
    if (!itemId) {
      const { data: item, error } = await supabase
        .from("german_items")
        .insert({ subject_id: data.subtopicId, kind: data.kind, title: data.kind === "words" ? "Words" : "Sentences", position: 0 })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      itemId = item.id;
    }
    if (!itemId) throw new Error("Could not prepare this sub-subject.");
    const table = data.kind === "words" ? "german_word_entries" : "german_sentence_entries";
    const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("item_id", itemId);
    const rows = data.entries.map((entry, index) => ({ item_id: itemId, position: (count ?? 0) + index, ...entry }));
    const { data: inserted, error } = await supabase.from(table).insert(rows).select("id,german,english");
    if (error) throw new Error(error.message);
    return { subjectId: data.subtopicId, kind: data.kind, entries: inserted ?? [] };
  });