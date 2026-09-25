// All in one — one lecture in, study guide + summary + flashcards + questions out.
// Reuses the Lecture Lab tables so the questions run in the existing runner.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

import type { ChatTarget } from "@/lib/mode-ai.server";

/** Where this mode sends its request: the owner's own key, or shared RitaJet AI. */
async function target(supabase: any): Promise<ChatTarget> {
  const { resolveChatTarget } = await import("@/lib/mode-ai.server");
  return await resolveChatTarget(supabase, "aio");
}

type Opt = { letter: string; body: string; is_correct: boolean };

function jsonFrom(raw: string): any {
  const s = String(raw ?? "").trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? s;
  const start = body.search(/[[{]/);
  const text = start >= 0 ? body.slice(start) : body;
  try {
    return JSON.parse(text);
  } catch {
    const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (end > 0) {
      try {
        return JSON.parse(text.slice(0, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("The AI replied in a shape we could not read. Try again.");
  }
}

async function ask(t: ChatTarget, system: string, prompt: string) {
  const res = await fetch(t.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.key}` },
    body: JSON.stringify({
      model: t.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (res.status === 429) throw new Error("The AI is busy right now. Wait a few seconds and try again.");
  if (res.status === 402) throw new Error("This workspace is out of AI credits. Ask the site owner to top up.");
  if (!res.ok) throw new Error(`The AI could not read that lecture (error ${res.status}).`);
  const json: any = await res.json();
  return jsonFrom(json?.choices?.[0]?.message?.content ?? "");
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const DEFAULT_SUBJECT = "My lectures";
const DEFAULT_SUBTOPIC = "All in one";

/** The invisible bucket every All-in-one lecture is filed under. */
export const aioBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    const { data: subject } = await supabase
      .from("lq_subjects")
      .select("id")
      .eq("user_id", userId)
      .eq("name", DEFAULT_SUBJECT)
      .maybeSingle();
    let subjectId = subject?.id as string | undefined;
    if (!subjectId) {
      const { data: made, error } = await supabase
        .from("lq_subjects")
        .insert({ user_id: userId, name: DEFAULT_SUBJECT })
        .select("id")
        .single();
      if (error) throw error;
      subjectId = made.id as string;
    }

    const { data: sub } = await supabase
      .from("lq_subtopics")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("name", DEFAULT_SUBTOPIC)
      .maybeSingle();
    let subtopicId = sub?.id as string | undefined;
    if (!subtopicId) {
      const { data: made, error } = await supabase
        .from("lq_subtopics")
        .insert({ user_id: userId, subject_id: subjectId, name: DEFAULT_SUBTOPIC })
        .select("id")
        .single();
      if (error) throw error;
      subtopicId = made.id as string;
    }

    return { subtopicId };
  });

/** Every All-in-one lecture, newest first, for the squares under the drop zone. */
export const aioList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    // The student's own lectures plus the shared read-only Tuberculosis example, pinned first.
    // Clean up any legacy example lectures that are not the Tuberculosis Handbook
    try {
      await supabase
        .from("lq_lectures")
        .delete()
        .eq("is_example", true)
        .not("title", "ilike", "%Tuberculosis%");
    } catch {
      // ignore
    }

    const { data: rawLectures, error } = await supabase
      .from("lq_lectures")
      .select("id, title, created_at, question_count, is_example, user_id")
      .or(`user_id.eq.${userId},is_example.eq.true`)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    // Retain only Tuberculosis Handbook as the universal example card
    const lectures = (rawLectures ?? []).filter((l: any) => {
      if (l.is_example) {
        return String(l.title ?? "").toLowerCase().includes("tuberculosis");
      }
      return true;
    });

    const ids = lectures.map((l: any) => l.id);
    if (!ids.length) return { lectures: [] as any[] };

    const [{ data: sums }, { data: cards }] = await Promise.all([
      supabase.from("aio_summaries").select("lecture_id").in("lecture_id", ids),
      supabase.from("aio_cards").select("lecture_id").in("lecture_id", ids),
    ]);
    const hasGuide = new Set((sums ?? []).map((r: any) => r.lecture_id));
    const cardCount = new Map<string, number>();
    for (const r of cards ?? []) cardCount.set(r.lecture_id, (cardCount.get(r.lecture_id) ?? 0) + 1);

    const mapped = (lectures ?? []).map((l: any) => ({
      id: l.id as string,
      title: l.title as string,
      created_at: l.created_at as string,
      questions: Number(l.question_count ?? 0),
      cards: cardCount.get(l.id) ?? 0,
      guide: hasGuide.has(l.id),
      example: !!l.is_example && l.user_id !== userId,
    }));

    return {
      lectures: [
        ...mapped.filter((l: any) => l.example),
        ...mapped.filter((l: any) => !l.example),
      ],
    };
  });

/** Read scanned lecture pages as images when the PDF has no text layer. */
export const aioReadPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        images: z.array(z.object({ base64: z.string().min(100) })).min(1).max(12),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const { assertFeature, assertQuota } = await import("@/lib/quota.server");
    await assertFeature(userId, "feature_all_in_one");
    await assertQuota(userId, "all_in_one_lectures", 1);
    const t = await target((context as any).supabase);

    const res = await fetch(t.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t.key}` },
      body: JSON.stringify({
        model: t.model,
        messages: [
          {
            role: "system",
            content:
              "You transcribe lecture slides. Write out every word you can read, slide by slide, as plain text. " +
              "No commentary, no markdown, no invented content.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe these lecture pages in order." },
              ...data.images.map((i) => ({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${i.base64}` },
              })),
            ],
          },
        ],
      }),
    });
    if (res.status === 429) throw new Error("The AI is busy right now. Wait a few seconds and try again.");
    if (res.status === 402) throw new Error("This workspace is out of AI credits. Ask the site owner to top up.");
    if (!res.ok) throw new Error(`The AI could not read those pages (error ${res.status}).`);
    const json: any = await res.json();
    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (text.length < 100) throw new Error("Those pages were too blurry to read. Paste the lecture text instead.");
    return { text: text.slice(0, 200_000) };
  });


/** Step 1 — create the lecture row so the workspace exists immediately. */
export const aioStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        subtopicId: z.string().uuid(),
        title: z.string().trim().min(1).max(160),
        sourceName: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { assertFeature, assertQuota, bumpQuota } = await import("@/lib/quota.server");
    await assertFeature(userId, "feature_all_in_one");
    await assertQuota(userId, "all_in_one_lectures", 1);
    const { data: row, error } = await supabase
      .from("lq_lectures")
      .insert({
        user_id: userId,
        subtopic_id: data.subtopicId,
        title: data.title,
        source_name: data.sourceName ?? null,
        difficulty: "mixed",
        key_points: [],
        question_count: 0,
      })
      .select("id")
      .single();
    if (error) throw error;
    await bumpQuota(userId, "all_in_one_lectures", 1);
    return { lectureId: row.id as string };
  });

/** Step 2 — the summary + key points pass. */
export const aioSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lectureId: z.string().uuid(),
        title: z.string().trim().min(1).max(160),
        text: z.string().min(200).max(400_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const t = await target(supabase);

    const parsed = await ask(
      t,
      "You turn one lecture into a well-organised study guide. Return STRICT JSON only. Use plain markdown inside the strings: " +
        "## headings, - bullets, **bold** for terms, and markdown tables where a comparison helps. " +
        "FORMATTING RULES (strict): put a blank line before AND after every ## heading; never continue a sentence on the heading line; " +
        "every bullet starts on its own line with '- '; one idea per bullet; keep paragraphs under 4 sentences. " +
        "Never invent facts that are not in the lecture text.",
      `Lecture: "${data.title}".\n` +
        `Write:\n` +
        `1. "guide": a full study guide with clearly separated sections in this order — ` +
        `"## The general idea" (3-4 sentences, plain language), "## Background & mechanism", "## Key findings" (bullets, ` +
        `each starting with a **bold term**), a markdown table when a comparison helps, and a final ` +
        `"## What your examiner asks" section with 4-6 bullets.\n` +
        `2. "short": a one-screen summary, 120 words maximum, written as a short opening paragraph then 3-5 '- ' bullets.\n` +
        `3. "points": 6 to 10 one-sentence revision bullets.\n` +
        `JSON shape: {"guide":"markdown","short":"markdown","points":["...","..."]}\n\nLECTURE TEXT:\n${data.text.slice(0, 60_000)}`,
    );

    const guide = String(parsed?.guide ?? "").trim().slice(0, 40_000);
    const short = String(parsed?.short ?? "").trim().slice(0, 6_000);
    const points = ((parsed?.points ?? []) as any[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
    if (!guide && !short) throw new Error("The AI could not summarise that lecture. Try a longer text.");

    const { error } = await supabase
      .from("aio_summaries")
      .upsert({ user_id: userId, lecture_id: data.lectureId, guide_md: guide, short_md: short }, { onConflict: "lecture_id" });
    if (error) throw error;
    await supabase.from("lq_lectures").update({ key_points: points }).eq("id", data.lectureId);

    return { guide, short, points };
  });

/** Step 3 — the flashcards pass (also copied into the normal flashcards board). */
export const aioCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lectureId: z.string().uuid(),
        title: z.string().trim().min(1).max(160),
        text: z.string().min(200).max(400_000),
        count: z.number().int().min(6).max(40).default(16),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const t = await target(supabase);

    const parsed = await ask(
      t,
      "You write flashcards from one lecture. Return STRICT JSON only. Front = a short prompt or term. " +
        "Back = one or two lines, never a paragraph. Never invent facts outside the lecture text.",
      `Lecture: "${data.title}". Write ${data.count} flashcards.\n` +
        `JSON shape: {"cards":[{"front":"...","back":"..."}]}\n\nLECTURE TEXT:\n${data.text.slice(0, 60_000)}`,
    );

    const seen = new Set<string>();
    const cards = ((parsed?.cards ?? []) as any[])
      .map((c) => ({ front: String(c?.front ?? "").trim(), back: String(c?.back ?? "").trim() }))
      .filter((c) => {
        if (!c.front || !c.back) return false;
        const k = norm(c.front);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, data.count);

    if (!cards.length) throw new Error("The AI could not build flashcards from that lecture.");

    await supabase.from("aio_cards").delete().eq("lecture_id", data.lectureId);
    const { error } = await supabase
      .from("aio_cards")
      .insert(cards.map((c, i) => ({ user_id: userId, lecture_id: data.lectureId, front: c.front, back: c.back, sort_order: i })));
    if (error) throw error;

    return { cards };
  });

/** Attach a real Summary-mode sheet to this lecture. */
export const aioLinkSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lectureId: z.string().uuid(), summaryId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { error } = await supabase
      .from("aio_summaries")
      .upsert(
        { user_id: userId, lecture_id: data.lectureId, summary_id: data.summaryId },
        { onConflict: "lecture_id" },
      );
    if (error) throw error;
    return { ok: true };
  });

/** File this lecture's questions under a Lecture Lab subject/sub-subject. */
export const aioFileQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lectureId: z.string().uuid(), subtopicId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    const { data: sub, error: subErr } = await supabase
      .from("lq_subtopics")
      .select("id")
      .eq("id", data.subtopicId)
      .eq("user_id", userId)
      .maybeSingle();
    if (subErr) throw subErr;
    if (!sub) throw new Error("That sub-subject is not yours.");

    const { error } = await supabase
      .from("lq_lectures")
      .update({ subtopic_id: data.subtopicId })
      .eq("id", data.lectureId)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

/** Everything the workspace needs to render. */
export const aioLoad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lectureId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;

    const { data: lecture, error } = await supabase
      .from("lq_lectures")
      .select("id, title, source_name, key_points, question_count, subtopic_id, created_at")
      .eq("id", data.lectureId)
      .maybeSingle();
    if (error) throw error;
    if (!lecture) throw new Error("That lecture is gone.");

    const [summary, cards, questions] = await Promise.all([
      supabase
        .from("aio_summaries")
        .select("guide_md, short_md, summary_id")
        .eq("lecture_id", data.lectureId)
        .maybeSingle(),
      supabase.from("aio_cards").select("id, front, back").eq("lecture_id", data.lectureId).order("sort_order"),
      supabase
        .from("lq_questions")
        .select("id, stem, options, explanation, sort_order")
        .eq("lecture_id", data.lectureId)
        .order("sort_order"),
    ]);

    const summaryId = (summary.data?.summary_id as string | null) ?? null;
    let sheet: { id: string; title: string; author_name: string | null; content: any; created_at: string } | null =
      null;
    if (summaryId) {
      const { data: row } = await supabase
        .from("summaries")
        .select("id, title, author_name, content, created_at")
        .eq("id", summaryId)
        .maybeSingle();
      sheet = (row as any) ?? null;
    }

    return {
      lecture,
      guide: (summary.data?.guide_md as string) ?? "",
      short: (summary.data?.short_md as string) ?? "",
      sheet,
      cards: (cards.data ?? []) as { id: string; front: string; back: string }[],
      questions: (questions.data ?? []) as {
        id: string;
        stem: string;
        options: Opt[];
        explanation: string;
        sort_order: number;
      }[],
    };
  });
