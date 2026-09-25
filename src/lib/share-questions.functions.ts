import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

/** Copies a shared question set into one of the student's own Lecture Lab sub-subjects. */
export const sqImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        setId: z.string().uuid(),
        subtopicId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    const { data: sub } = await supabase
      .from("lq_subtopics")
      .select("id, user_id")
      .eq("id", data.subtopicId)
      .maybeSingle();
    if (!sub) throw new Error("That sub-subject is gone — pick or create one again.");
    if (sub.user_id !== userId) {
      throw new Error("The example shelf is read-only — save into one of your own subjects.");
    }

    const { data: set, error: setErr } = await supabase
      .from("shared_question_sets")
      .select("id, title, question_count")
      .eq("id", data.setId)
      .maybeSingle();
    if (setErr) throw setErr;
    if (!set) throw new Error("This question set is not available any more.");

    const { data: lecture, error: lecErr } = await supabase
      .from("lq_lectures")
      .insert({
        user_id: userId,
        subtopic_id: data.subtopicId,
        title: set.title,
        source_name: "Shared on RitaJet",
        question_count: 0,
      })
      .select("id")
      .single();
    if (lecErr) throw new Error(lecErr.message || "Could not save this set.");

    // Copy in batches so large sets still import reliably.
    const PAGE = 500;
    let from = 0;
    let total = 0;
    for (;;) {
      const { data: items, error } = await supabase
        .from("shared_question_items")
        .select("stem, options, explanation, sort")
        .eq("set_id", data.setId)
        .order("sort", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (items ?? []) as any[];
      if (rows.length === 0) break;
      const { error: insErr } = await supabase.from("lq_questions").insert(
        rows.map((q) => ({
          lecture_id: lecture.id,
          user_id: userId,
          stem: q.stem,
          options: q.options ?? [],
          explanation: q.explanation ?? "",
          sort_order: q.sort,
        })),
      );
      if (insErr) throw insErr;
      total += rows.length;
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    await supabase.from("lq_lectures").update({ question_count: total }).eq("id", lecture.id);
    return { lectureId: lecture.id as string, count: total };
  });
