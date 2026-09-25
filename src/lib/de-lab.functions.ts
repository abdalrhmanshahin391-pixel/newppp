import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";
import { canBuild } from "@/lib/de-lab";
import type { DeItem, DeSubject, DeSubtopic } from "@/lib/de-lab";

const Mode = z.enum(["articles", "speaking"]);
/** Every lab reads one shared shelf — mode only picks the default colour. */
const TreeMode = z.enum(["articles", "speaking", "build"]);

/** Full subject → sub-subject tree with item counts, flag counts and accuracy. */
export const deTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mode: TreeMode }).parse(d))
  .handler(async ({ data, context }): Promise<DeSubject[]> => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    const { data: subjects, error } = await supabase
      .from("de_subjects")
      .select("id, name, mode, color, position, is_sample")
      .order("is_sample", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    const subjectIds = (subjects ?? []).map((s: any) => s.id);
    if (!subjectIds.length) return [];

    const { data: subs } = await supabase
      .from("de_subtopics")
      .select("id, subject_id, name, position, is_sample")
      .in("subject_id", subjectIds)
      .order("position", { ascending: true });

    const subIds = (subs ?? []).map((s: any) => s.id);
    const { data: items } = subIds.length
      ? await supabase
          .from("de_items")
          .select("id, subtopic_id, kind, german, article")
          .in("subtopic_id", subIds)
      : { data: [] as any[] };

    const itemIds = (items ?? []).map((i: any) => i.id);
    const { data: flags } = itemIds.length
      ? await supabase.from("de_flags").select("item_id").eq("user_id", userId).in("item_id", itemIds)
      : { data: [] as any[] };

    const flagged = new Set((flags ?? []).map((f: any) => f.item_id));
    const perSub = new Map<string, { items: number; flags: number; nouns: number; buildable: number }>();
    for (const it of items ?? []) {
      const cur = perSub.get(it.subtopic_id) ?? { items: 0, flags: 0, nouns: 0, buildable: 0 };
      cur.items += 1;
      if (it.article) cur.nouns += 1;
      if (canBuild({ german: it.german ?? "", article: it.article })) cur.buildable += 1;
      if (flagged.has(it.id)) cur.flags += 1;
      perSub.set(it.subtopic_id, cur);
    }

    const bySubject = new Map<string, DeSubtopic[]>();
    for (const s of subs ?? []) {
      const c = perSub.get(s.id) ?? { items: 0, flags: 0, nouns: 0, buildable: 0 };
      const list = bySubject.get(s.subject_id) ?? [];
      list.push({ ...(s as any), items: c.items, flags: c.flags, nouns: c.nouns, buildable: c.buildable });
      bySubject.set(s.subject_id, list);
    }

    return (subjects ?? []).map((s: any) => {
      const list = bySubject.get(s.id) ?? [];
      return {
        ...s,
        subtopics: list,
        items: list.reduce((n, x) => n + x.items, 0),
        flags: list.reduce((n, x) => n + x.flags, 0),
        nouns: list.reduce((n, x) => n + (x.nouns ?? 0), 0),
        buildable: list.reduce((n, x) => n + (x.buildable ?? 0), 0),
      } as DeSubject;
    });
  });

/** Items inside the chosen sub-subjects, with the learner's flags applied. */
export const deItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ subtopicIds: z.array(z.string().uuid()).min(1).max(80), flaggedOnly: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<DeItem[]> => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    const { data: rows, error } = await supabase
      .from("de_items")
      .select("id, subtopic_id, kind, german, article, plural, english, position, is_sample")
      .in("subtopic_id", data.subtopicIds)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    const { data: flags } = ids.length
      ? await supabase.from("de_flags").select("item_id").eq("user_id", userId).in("item_id", ids)
      : { data: [] as any[] };
    const flagged = new Set((flags ?? []).map((f: any) => f.item_id));

    const out = (rows ?? []).map((r: any) => ({ ...r, flagged: flagged.has(r.id) })) as DeItem[];
    return data.flaggedOnly ? out.filter((i) => i.flagged) : out;
  });

export const deCreateSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ mode: Mode, name: z.string().min(1).max(80), color: z.string().max(20).default("#6aa9d8") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { count } = await supabase
      .from("de_subjects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const { data: row, error } = await supabase
      .from("de_subjects")
      .insert({ user_id: userId, mode: data.mode, name: data.name, color: data.color, position: count ?? 0 } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string };
  });

export const deCreateSubtopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subjectId: z.string().uuid(), name: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { count } = await supabase
      .from("de_subtopics")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", data.subjectId);
    const { data: row, error } = await supabase
      .from("de_subtopics")
      .insert({ subject_id: data.subjectId, user_id: userId, name: data.name, position: count ?? 0 } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string };
  });

export const deRename = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table: z.enum(["de_subjects", "de_subtopics"]), id: z.string().uuid(), name: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { error } = await supabase.from(data.table).update({ name: data.name }).eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deRemove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table: z.enum(["de_subjects", "de_subtopics", "de_items"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { error } = await supabase.from(data.table).delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ItemInput = z.object({
  kind: z.enum(["noun", "word", "sentence"]),
  german: z.string().min(1).max(400),
  article: z.enum(["der", "die", "das"]).nullable(),
  plural: z.string().max(200).nullable(),
  english: z.string().max(400).nullable(),
});

export const deAddItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ subtopicId: z.string().uuid(), items: z.array(ItemInput).min(1).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { count } = await supabase
      .from("de_items")
      .select("id", { count: "exact", head: true })
      .eq("subtopic_id", data.subtopicId);
    const start = count ?? 0;
    const rows = data.items.map((it, i) => ({
      subtopic_id: data.subtopicId,
      user_id: userId,
      kind: it.kind,
      german: it.german,
      article: it.article,
      plural: it.plural,
      english: it.english,
      position: start + i,
    }));
    const { error } = await supabase.from("de_items").insert(rows as any);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const deSetFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ itemId: z.string().uuid(), on: z.boolean(), note: z.string().max(280).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    if (!data.on) {
      const { error } = await supabase.from("de_flags").delete().eq("user_id", userId).eq("item_id", data.itemId);
      if (error) throw new Error(error.message);
      return { flagged: false };
    }
    const { error } = await supabase
      .from("de_flags")
      .upsert({ user_id: userId, item_id: data.itemId, note: data.note } as any, { onConflict: "user_id,item_id" });
    if (error) throw new Error(error.message);
    return { flagged: true };
  });

export const deRecordAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mode: z.string().max(30),
        rows: z
          .array(z.object({ itemId: z.string().uuid(), correct: z.boolean(), score: z.number().min(0).max(100).default(0) }))
          .min(1)
          .max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const rows = data.rows.map((r) => ({
      user_id: userId,
      item_id: r.itemId,
      mode: data.mode,
      correct: r.correct,
      score: Math.round(r.score),
    }));
    const { error } = await supabase.from("de_attempts").insert(rows as any);
    if (error) throw new Error(error.message);
    return { saved: rows.length };
  });
