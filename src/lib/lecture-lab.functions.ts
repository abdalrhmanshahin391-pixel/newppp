// Lecture Lab — turn one lecture PDF into a quick quiz.
// Light sibling of Rita AI 3.8: short 2-3 line explanations, runs on the page.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

import type { ChatTarget } from "@/lib/mode-ai.server";

/** Where this mode sends its request: the owner's own key, or shared RitaJet AI. */
async function target(supabase: any): Promise<ChatTarget> {
  const { resolveChatTarget } = await import("@/lib/mode-ai.server");
  return await resolveChatTarget(supabase, "lecture");
}

export type LqOption = { letter: string; body: string; is_correct: boolean };
export type LqQuestion = {
  id: string;
  stem: string;
  options: LqOption[];
  explanation: string;
  point_ref: string | null;
  sort_order: number;
};

// ---------------- board ----------------

export const lqBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    // Everyone sees the same read-only example shelf next to their own shelf.
    const [subjects, subtopics, lectures, attempts, exSubjects, exSubtopics, exLectures] =
      await Promise.all([
        supabase
          .from("lq_subjects")
          .select("id, name, sort_order")
          .eq("user_id", userId)
          .eq("is_example", false)
          .order("sort_order")
          .order("name"),
        supabase
          .from("lq_subtopics")
          .select("id, subject_id, name, sort_order")
          .eq("user_id", userId)
          .eq("is_example", false)
          .order("sort_order")
          .order("name"),

        supabase
          .from("lq_lectures")
          .select("id, subtopic_id, title, source_name, difficulty, question_count, best_score, created_at")
          .eq("user_id", userId)
          .eq("is_example", false)
          .order("created_at", { ascending: false }),
        supabase.from("lq_attempts").select("lecture_id, correct, flagged").eq("user_id", userId),
        supabase
          .from("lq_subjects")
          .select("id, name, sort_order")
          .eq("is_example", true)
          .order("sort_order"),
        supabase
          .from("lq_subtopics")
          .select("id, subject_id, name, sort_order")
          .eq("is_example", true)
          .order("sort_order"),
        supabase
          .from("lq_lectures")
          .select("id, subtopic_id, title, source_name, difficulty, question_count, best_score, created_at")
          .eq("is_example", true)
          .order("created_at"),
      ]);

    const stats: Record<string, { wrong: number; flagged: number }> = {};
    for (const a of (attempts.data ?? []) as any[]) {
      const s = (stats[a.lecture_id] ??= { wrong: 0, flagged: 0 });
      if (!a.correct) s.wrong += 1;
      if (a.flagged) s.flagged += 1;
    }

    const mark = (rows: any[] | null | undefined) =>
      (rows ?? []).map((r) => ({ ...r, is_example: true }));

    return {
      userId,
      subjects: [...((subjects.data ?? []) as any[]), ...mark(exSubjects.data)],
      subtopics: [...((subtopics.data ?? []) as any[]), ...mark(exSubtopics.data)],
      lectures: [...((lectures.data ?? []) as any[]), ...mark(exLectures.data)],
      stats,
    };
  });

export const lqAddSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { data: row, error } = await supabase
      .from("lq_subjects")
      .insert({ user_id: userId, name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message || "The subject could not be saved.");
    return { id: row.id as string };
  });

export const lqAddSubtopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ subjectId: z.string().uuid(), name: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    const { data: parent } = await supabase
      .from("lq_subjects")
      .select("id, user_id")
      .eq("id", data.subjectId)
      .maybeSingle();
    if (!parent) throw new Error("That subject is gone — pick or create one again.");
    if (parent.user_id !== userId) {
      throw new Error("The example subjects are read-only — make your own subject to add to.");
    }

    const { data: row, error } = await supabase
      .from("lq_subtopics")
      .insert({ user_id: userId, subject_id: data.subjectId, name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message || "The sub-subject could not be saved.");
    return { id: row.id as string };
  });


export const lqEnsureDefault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as any).supabase;
    const { data, error } = await supabase.rpc("ensure_lq_default_bucket");
    if (error) throw error;
    return data as { subjectId: string; subtopicId: string };
  });

const READ_ONLY = "That one is a shared example — you can study it, but not change it.";

export const lqRemove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(["subject", "subtopic", "lecture"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const table =
      data.kind === "subject" ? "lq_subjects" : data.kind === "subtopic" ? "lq_subtopics" : "lq_lectures";
    const { data: gone, error } = await supabase
      .from(table)
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("id");
    if (error) throw error;
    if (!(gone ?? []).length) throw new Error(READ_ONLY);
    return { ok: true };
  });

export const lqRename = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["subject", "subtopic", "lecture"]),
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const table =
      data.kind === "subject" ? "lq_subjects" : data.kind === "subtopic" ? "lq_subtopics" : "lq_lectures";
    const patch = data.kind === "lecture" ? { title: data.name } : { name: data.name };
    const { data: rows, error } = await supabase
      .from(table)
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("id");
    if (error) throw error;
    if (!(rows ?? []).length) throw new Error(READ_ONLY);
    return { ok: true };
  });

// ---------------- generation ----------------

function jsonFrom(text: string): any | null {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* keep going */
  }
  const lb = cleaned.indexOf("{");
  const rb = cleaned.lastIndexOf("}");
  if (lb !== -1 && rb > lb) {
    try {
      return JSON.parse(cleaned.slice(lb, rb + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function askGateway(t: ChatTarget, system: string, user: string) {
  const res = await fetch(t.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.key}` },
    body: JSON.stringify({
      model: t.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("The AI is busy right now. Wait a few seconds and try again.");
  if (res.status === 402) throw new Error("This workspace is out of AI credits. Ask the site owner to top up.");
  if (!res.ok) throw new Error(`The AI could not read that lecture (error ${res.status}).`);
  const json: any = await res.json();
  return jsonFrom(json?.choices?.[0]?.message?.content ?? "");
}

/** Read a PDF into plain text, server-side. */
export const lqExtractPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pdfBase64: z.string().min(20).max(16_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const { assertFeature } = await import("@/lib/quota.server");
    await assertFeature(userId, "feature_lecture_qgen");
    const { extractText, getDocumentProxy } = await import("unpdf");
    const bin = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    const doc = await getDocumentProxy(bin);
    let pages: string[] = [];
    try {
      const r: any = await extractText(doc, { mergePages: false } as any);
      const arr = Array.isArray(r?.text) ? r.text : [String(r?.text ?? "")];
      pages = arr.map((s: any) => String(s || "").replace(/\s+\n/g, "\n").trim());
    } catch {
      pages = [];
    }
    const text = pages.join("\n\n").trim();
    if (text.length < 200) {
      throw new Error("We could not read enough text from that PDF. It may be a scan — paste the text instead.");
    }
    return { text: text.slice(0, 400_000), pages: pages.length };
  });

const DIFFICULTY_HINT: Record<string, string> = {
  easy: "Keep them straightforward recall checks a student can answer right after the lecture.",
  mixed: "Mix simple recall with a few applied questions.",
  hard: "Favour applied reasoning and fine distinctions between close concepts.",
  exam: "Write them like real exam questions: plausible distractors and no giveaway wording.",
};

function slice(text: string, parts: number) {
  const size = Math.ceil(text.length / parts);
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.filter((s) => s.trim().length > 200);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/** Turn lecture text into key points + short-explanation MCQs, and save them. */
export const lqGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        subtopicId: z.string().uuid(),
        lectureId: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(160),
        sourceName: z.string().max(200).optional(),
        text: z.string().min(200).max(400_000),
        count: z.number().int().min(5).max(40),
        difficulty: z.enum(["easy", "mixed", "hard", "exam"]),
        keyPoints: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const t = await target(supabase);

    // The whole batch is checked before a single token is spent.
    const { assertFeature, assertBatchFits, bumpQuota } = await import("@/lib/quota.server");
    const inAllInOne = !!data.lectureId;
    const bucket = inAllInOne ? "all_in_one_questions" : "ai_questions";
    await assertFeature(userId, inAllInOne ? "feature_all_in_one" : "feature_lecture_qgen");
    await assertBatchFits(userId, bucket, data.count);


    const { data: sub, error: subErr } = await supabase
      .from("lq_subtopics")
      .select("id")
      .eq("id", data.subtopicId)
      .maybeSingle();
    if (subErr) throw subErr;
    if (!sub) throw new Error("That sub-subject no longer exists.");

    const chunks = slice(data.text, Math.min(4, Math.max(1, Math.ceil(data.text.length / 22_000))));
    const perChunk = Math.max(3, Math.ceil(data.count / chunks.length));

    const system =
      "You write medical/university study questions from a single lecture. " +
      "Return STRICT JSON only. Every question is multiple choice with exactly four options, " +
      "exactly one correct. The explanation is SHORT: two or three lines total — one line why the " +
      "correct answer is right, one line on the trap in the wrong ones, and the lecture point it came from. " +
      "Never write essays. Never invent facts that are not in the lecture text.";

    const collected: { stem: string; options: LqOption[]; explanation: string; point_ref: string | null }[] = [];
    const seen = new Set<string>();

    for (const part of chunks) {
      const prompt =
        `Lecture: "${data.title}".\n${DIFFICULTY_HINT[data.difficulty]}\n` +
        `Write ${perChunk} questions from the lecture text below.\n` +
        `JSON shape: {"questions":[{"stem":"...","options":[{"letter":"A","body":"...","is_correct":true},` +
        `{"letter":"B","body":"...","is_correct":false},{"letter":"C","body":"...","is_correct":false},` +
        `{"letter":"D","body":"...","is_correct":false}],"explanation":"2-3 short lines","point_ref":"the lecture point"}]}\n\n` +
        `LECTURE TEXT:\n${part}`;
      let parsed: any = null;
      try {
        parsed = await askGateway(t, system, prompt);
      } catch (e) {
        if (!collected.length) throw e;
        break;
      }
      for (const q of (parsed?.questions ?? []) as any[]) {
        const stem = String(q?.stem ?? "").trim();
        const opts = Array.isArray(q?.options) ? q.options : [];
        if (!stem || opts.length !== 4) continue;
        const options: LqOption[] = opts.slice(0, 4).map((o: any, i: number) => ({
          letter: String(o?.letter ?? "ABCD"[i]).slice(0, 1).toUpperCase(),
          body: String(o?.body ?? "").trim(),
          is_correct: !!o?.is_correct,
        }));
        if (options.some((o) => !o.body)) continue;
        if (options.filter((o) => o.is_correct).length !== 1) continue;
        const k = norm(stem);
        if (seen.has(k)) continue;
        seen.add(k);
        collected.push({
          stem,
          options,
          explanation: String(q?.explanation ?? "").trim().slice(0, 600),
          point_ref: q?.point_ref ? String(q.point_ref).slice(0, 200) : null,
        });
      }
      if (collected.length >= data.count) break;
    }

    if (!collected.length) throw new Error("The AI could not build questions from that lecture. Try a longer text.");
    const questions = collected.slice(0, data.count);

    let points: string[] = [];
    if (data.keyPoints) {
      try {
        const p = await askGateway(
          t,
          "You summarise a lecture into short revision bullets. Return STRICT JSON only.",
          `Give 6 to 10 key points for the lecture "${data.title}". One short sentence each. ` +
            `JSON shape: {"points":["...","..."]}\n\nLECTURE TEXT:\n${data.text.slice(0, 24_000)}`,
        );
        points = ((p?.points ?? []) as any[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
      } catch {
        points = [];
      }
    }

    const { data: lectureId, error: saveError } = await supabase.rpc("save_lq_generation", {
      _subtopic_id: data.subtopicId,
      _title: data.title,
      _source_name: data.sourceName ?? "",
      _difficulty: data.difficulty,
      _key_points: points,
      _questions: questions,
      _lecture_id: data.lectureId ?? null,
    });
    if (saveError) throw saveError;

    await bumpQuota(userId, bucket, questions.length);

    return { lectureId: lectureId as string, questions: questions.length, points };
  });

// ---------------- running ----------------

export const lqLoadRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lectureIds: z.array(z.string().uuid()).min(1).max(30),
        pool: z.enum(["all", "flagged", "wrong"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;

    const { data: lectures } = await supabase
      .from("lq_lectures")
      .select("id, title, key_points")
      .in("id", data.lectureIds);

    const { data: qs, error } = await supabase
      .from("lq_questions")
      .select("id, lecture_id, stem, options, explanation, point_ref, sort_order")
      .in("lecture_id", data.lectureIds)
      .order("sort_order");
    if (error) throw error;

    let questions = (qs ?? []) as any[];
    if (data.pool !== "all") {
      const { data: att } = await supabase
        .from("lq_attempts")
        .select("question_id, correct, flagged")
        .in("lecture_id", data.lectureIds);
      const keep = new Set(
        ((att ?? []) as any[])
          .filter((a) => (data.pool === "flagged" ? a.flagged : !a.correct))
          .map((a) => a.question_id),
      );
      questions = questions.filter((q) => keep.has(q.id));
    }

    return { questions, lectures: (lectures ?? []) as any[] };
  });

export const lqSaveAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              questionId: z.string().uuid(),
              lectureId: z.string().uuid(),
              correct: z.boolean(),
              flagged: z.boolean(),
            }),
          )
          .min(1)
          .max(500),
        score: z.number().int().min(0).max(100).optional(),
        lectureId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const rows = data.rows.map((r) => ({
      user_id: userId,
      question_id: r.questionId,
      lecture_id: r.lectureId,
      correct: r.correct,
      flagged: r.flagged,
      answered_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("lq_attempts").upsert(rows, { onConflict: "user_id,question_id" });
    if (error) throw error;

    if (data.lectureId && typeof data.score === "number") {
      const { data: lec } = await supabase
        .from("lq_lectures")
        .select("best_score")
        .eq("id", data.lectureId)
        .maybeSingle();
      if (!lec?.best_score || data.score > lec.best_score) {
        await supabase.from("lq_lectures").update({ best_score: data.score }).eq("id", data.lectureId);
      }
    }
    return { ok: true };
  });
