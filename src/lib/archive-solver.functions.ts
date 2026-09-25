import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

const CreateInput = z.object({
  subject: z.string().min(1).max(160),
  subtopic: z.string().max(160).default(""),
  pdfName: z.string().min(1).max(200),
  totalPages: z.number().int().min(1).max(3000),
});

export const createArchiveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { assertQuota, assertFeature } = await import("@/lib/quota.server");
    await assertFeature(userId, "feature_archive_qgen");
    await assertQuota(userId, "archive_questions", 1);

    const { data: job, error } = await supabase
      .from("archive_jobs")
      .insert({
        user_id: userId,
        subject: data.subject,
        subtopic: data.subtopic,
        pdf_name: data.pdfName,
        total_pages: data.totalPages,
        status: "uploading",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { jobId: job.id as string };
  });

const ChunkInput = z.object({
  jobId: z.string().uuid(),
  chunkIndex: z.number().int().min(0).max(600),
  pageFrom: z.number().int().min(1),
  pageTo: z.number().int().min(1),
  text: z.string().max(200_000),
});

export const pushArchiveChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChunkInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("archive_chunks").upsert(
      {
        job_id: data.jobId,
        chunk_index: data.chunkIndex,
        page_from: data.pageFrom,
        page_to: data.pageTo,
        chunk_text: data.text,
        status: "pending",
      },
      { onConflict: "job_id,chunk_index" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startArchiveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { count } = await supabase
      .from("archive_chunks")
      .select("id", { count: "exact", head: true })
      .eq("job_id", data.jobId);
    const { error } = await supabase
      .from("archive_jobs")
      .update({ status: "queued", chunks_total: count ?? 0, error: null })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);

    // Kick the worker once so short papers finish while the student watches.
    try {
      const { runArchiveWorker } = await import("@/lib/archive-solver.server");
      await runArchiveWorker(1);
    } catch {
      /* the scheduled run picks it up */
    }
    return { ok: true };
  });

export const listArchiveJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("archive_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { jobs: (data ?? []) as any[] };
  });

export const deleteArchiveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await supabase.from("archive_jobs").delete().eq("id", data.jobId);
    return { ok: true };
  });

export const listSolvedQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ subject: z.string().max(160), subtopic: z.string().max(160).nullable().default(null) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    let q = supabase
      .from("study_questions")
      .select("*")
      .eq("user_id", userId)
      .eq("subject", data.subject)
      .order("position", { ascending: true });
    if (data.subtopic !== null) q = q.eq("subtopic", data.subtopic);
    const { data: rows } = await q;
    return { questions: (rows ?? []) as any[] };
  });

export const countSolvedQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("study_questions")
      .select("subject, subtopic")
      .eq("user_id", userId);
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as any[]) {
      const key = `${row.subject}||${row.subtopic ?? ""}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return { counts };
  });

export const setQuestionFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), flagged: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await supabase.from("study_questions").update({ flagged: data.flagged }).eq("id", data.id);
    return { ok: true };
  });

export const deleteSolvedQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await supabase.from("study_questions").delete().eq("id", data.id);
    return { ok: true };
  });
