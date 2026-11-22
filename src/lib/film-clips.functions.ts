// The clips library (rita_film_clips): learners read the clips of a stop; admins list, save and
// delete clips, ask the AI for the Arabic fields and search GIPHY. Runs with the user's own
// session, so row-level security lets only admins write. Video files are uploaded by the admin's
// browser to the public bucket; GIFs stay on GIPHY's hosts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import {
  CLIPS_BUCKET,
  CLIP_FILE_PATH,
  MAX_STOP_CLIPS,
  checkTrim,
  clipFromRow,
  clipProblems,
  isGiphyUrl,
  parseGiphySearch,
  type ClipPoolEntry,
  type FilmClip,
  type GiphyResult,
} from "./film-clips";

const uuid = z.string().uuid();
const MISSING =
  "مكتبة المقاطع بدها تحديث قاعدة البيانات: طبّق migration ‏20261125120000_rita_film_clips بـ Lovable Cloud.";
const NOT_APPLIED = /could not find|does not exist|schema cache|PGRST20[0-9]|42P01|42703/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };

function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error("Bad request.");
  return result.data;
}

const notApplied = (error: { message?: string; code?: string } | null) =>
  Boolean(error && NOT_APPLIED.test(`${error.code ?? ""} ${error.message ?? ""}`));

function fail(error: { message?: string; code?: string } | null, label: string) {
  if (!error) return;
  if (notApplied(error)) throw new Error(MISSING);
  throw new Error(`${label}: ${error.message ?? "database error"}`);
}

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
}

/** Other clips' sentences and meanings, for the wrong choices of the exercises. */
async function clipPool(ctx: Ctx, exclude: string[]): Promise<ClipPoolEntry[]> {
  const { data } = await ctx.supabase
    .from("rita_film_clips")
    .select("id, en, ar")
    .order("created_at", { ascending: false })
    .limit(60);
  return ((data ?? []) as { id: string; en: string; ar: string }[])
    .filter((row) => !exclude.includes(row.id))
    .map((row) => ({ en: row.en, ar: row.ar }));
}

/** The clips of a stop, in the stop's order, and a pool of others for the exercise choices. */
export const listClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    parse(z.object({ ids: z.array(uuid).max(MAX_STOP_CLIPS) }), input),
  )
  .handler(async ({ data, context }): Promise<{ clips: FilmClip[]; pool: ClipPoolEntry[] }> => {
    if (!data.ids.length) return { clips: [], pool: [] };
    const { data: rows, error } = await context.supabase
      .from("rita_film_clips")
      .select("*")
      .in("id", data.ids);
    fail(error, "clips");
    const byId = new Map(
      ((rows ?? []) as Record<string, unknown>[]).map((row) => [String(row.id), clipFromRow(row)]),
    );
    const clips = data.ids.flatMap((id) => byId.get(id) ?? []);
    return { clips, pool: await clipPool(context, data.ids) };
  });

export type ClipUsage = { id: string; title: string; language: string };
export type ClipLibrary = {
  ready: boolean;
  clips: FilmClip[];
  /** Clip id → the exercises stops that use it. */
  usage: Record<string, ClipUsage[]>;
  stops: (ClipUsage & { clip_ids: string[] })[];
  /** The path of `language` (lessons and stops in order), to pick where a new stop goes. */
  path: { type: "lesson" | "item"; id: string; title: string; kind?: string }[];
  languages: string[];
  giphy: boolean;
};

/** Everything the clips page shows. `ready: false` until the migration is applied. */
export const adminListClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    parse(
      z.object({
        language: z
          .string()
          .trim()
          .regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/)
          .default("en"),
      }),
      input,
    ),
  )
  .handler(async ({ data, context }): Promise<ClipLibrary> => {
    await assertAdmin(context);
    const { getServerRuntimeSecret } = await import("./config.server");
    const { adminPathNodes } = await import("./rita-path-items.server");
    const [clipResult, stopResult, languageResult, pathResult, giphyKey] = await Promise.all([
      context.supabase
        .from("rita_film_clips")
        .select("*")
        .order("created_at", { ascending: false })
        .order("legacy_id", { ascending: true }),
      context.supabase
        .from("rita_path_items")
        .select("id, title, language, clip_ids, path_order")
        .eq("kind", "exercises")
        .order("path_order"),
      context.supabase.from("rita_curricula").select("target_language"),
      adminPathNodes(context.supabase, data.language),
      getServerRuntimeSecret("GIPHY_API_KEY"),
    ]);
    const languages = [
      ...new Set(
        ((languageResult.data ?? []) as { target_language: string | null }[])
          .map((row) => row.target_language)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    if (!languages.includes(data.language)) languages.unshift(data.language);
    const base = {
      path: pathResult.error ? [] : pathResult.nodes,
      languages,
      giphy: giphyKey.length > 0,
    };
    if (notApplied(clipResult.error) || notApplied(stopResult.error))
      return { ready: false, clips: [], usage: {}, stops: [], ...base };
    fail(clipResult.error, "clips");
    fail(stopResult.error, "stops");
    const stops = (
      (stopResult.data ?? []) as {
        id: string;
        title: string;
        language: string;
        clip_ids: string[] | null;
      }[]
    ).map((row) => ({
      id: row.id,
      title: row.title,
      language: row.language,
      clip_ids: row.clip_ids ?? [],
    }));
    const usage: Record<string, ClipUsage[]> = {};
    for (const stop of stops)
      for (const id of stop.clip_ids)
        (usage[id] ??= []).push({ id: stop.id, title: stop.title, language: stop.language });
    return {
      ready: true,
      clips: ((clipResult.data ?? []) as Record<string, unknown>[]).map(clipFromRow),
      usage,
      stops,
      ...base,
    };
  });

const text = (max: number) => z.string().trim().max(max);
const seconds = z.number().min(0).max(3600).nullable();
const filePath = z.string().regex(CLIP_FILE_PATH).nullable().optional();
const ClipInput = z.object({
  id: uuid.optional(),
  kind: z.enum(["video", "gif"]),
  en: text(300),
  ar: text(400),
  target: text(60),
  target_ar: text(80),
  context_ar: text(200).default(""),
  /** A new upload (else the clip keeps its video / cover). */
  video_path: filePath,
  poster_path: filePath,
  start_s: seconds.default(null),
  end_s: seconds.default(null),
  gif: z
    .object({
      id: z.string().trim().min(1).max(64),
      mp4: z.string().url().max(800),
      still: z.string().url().max(800),
      page: z.string().max(800).default(""),
    })
    .optional(),
  source: text(120).default(""),
  credit: text(200).default(""),
  credit_url: text(500).default(""),
});

/** Adds a clip or saves the admin's edits. Replaced files are removed from storage. */
export const adminSaveClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => parse(ClipInput, input))
  .handler(async ({ data, context }): Promise<FilmClip> => {
    await assertAdmin(context);
    const problem = clipProblems(data)[0];
    if (problem) throw new Error(problem);
    if (data.credit_url && !/^https?:\/\//i.test(data.credit_url))
      throw new Error("رابط المصدر لازم يبلّش بـ https://");

    let existing: Record<string, unknown> | null = null;
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("rita_film_clips")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      fail(error, "clip");
      if (!row) throw new Error("المقطع انحذف.");
      existing = row;
    }
    const kind = (existing?.kind as "video" | "gif" | undefined) ?? data.kind;
    const row: Record<string, unknown> = {
      kind,
      en: data.en,
      ar: data.ar,
      target: data.target,
      target_ar: data.target_ar,
      context_ar: data.context_ar,
      source: data.source,
      credit: data.credit,
      credit_url: data.credit_url || null,
    };
    const publicUrl = (path: string) =>
      context.supabase.storage.from(CLIPS_BUCKET).getPublicUrl(path).data.publicUrl as string;
    const removed: string[] = [];
    if (kind === "video") {
      const trim = checkTrim(data.start_s, data.end_s, null);
      if (trim.problem) throw new Error(trim.problem);
      row.start_s = trim.start;
      row.end_s = trim.end;
      if (data.video_path) {
        if (!/\.(mp4|webm|mov)$/i.test(data.video_path)) throw new Error("ملف الفيديو مش مدعوم.");
        row.video_path = data.video_path;
        row.video_url = publicUrl(data.video_path);
        if (existing?.video_path && existing.video_path !== data.video_path)
          removed.push(String(existing.video_path));
      } else if (!existing) throw new Error("ارفع الفيديو أولاً.");
      if (data.poster_path) {
        if (!/\.jpg$/i.test(data.poster_path)) throw new Error("صورة الغلاف لازم تكون JPG.");
        row.poster_path = data.poster_path;
        row.poster_url = publicUrl(data.poster_path);
        if (existing?.poster_path && existing.poster_path !== data.poster_path)
          removed.push(String(existing.poster_path));
      }
    } else if (data.gif) {
      if (!isGiphyUrl(data.gif.mp4) || !isGiphyUrl(data.gif.still))
        throw new Error("الـ GIF لازم يكون من GIPHY.");
      if (data.gif.page && !isGiphyUrl(data.gif.page)) throw new Error("رابط GIPHY مش صحيح.");
      row.gif_id = data.gif.id;
      row.gif_mp4 = data.gif.mp4;
      row.gif_still = data.gif.still;
      row.gif_page = data.gif.page || null;
    } else if (!existing) throw new Error("اختار GIF أولاً.");

    const query = existing
      ? context.supabase.from("rita_film_clips").update(row).eq("id", data.id)
      : context.supabase.from("rita_film_clips").insert({ ...row, created_by: context.userId });
    const { data: saved, error } = await query.select("*").single();
    fail(error, "save clip");
    if (removed.length) await context.supabase.storage.from(CLIPS_BUCKET).remove(removed);
    return clipFromRow(saved as Record<string, unknown>);
  });

/** Deletes a clip: it leaves every stop that used it, and its uploaded files are removed. */
export const adminDeleteClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => parse(z.object({ id: uuid }), input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: clip, error: readError } = await context.supabase
      .from("rita_film_clips")
      .select("video_path, poster_path")
      .eq("id", data.id)
      .maybeSingle();
    fail(readError, "clip");
    if (!clip) return { ok: true, stops: 0 };
    const { data: stops, error: stopError } = await context.supabase
      .from("rita_path_items")
      .select("id, clip_ids")
      .contains("clip_ids", [data.id]);
    fail(stopError, "stops");
    for (const stop of (stops ?? []) as { id: string; clip_ids: string[] }[]) {
      const { error } = await context.supabase
        .from("rita_path_items")
        .update({ clip_ids: stop.clip_ids.filter((id) => id !== data.id) })
        .eq("id", stop.id);
      fail(error, "remove from stop");
    }
    const { error } = await context.supabase.from("rita_film_clips").delete().eq("id", data.id);
    fail(error, "delete clip");
    const files = [clip.video_path, clip.poster_path].filter(
      (path): path is string => typeof path === "string" && CLIP_FILE_PATH.test(path),
    );
    if (files.length) await context.supabase.storage.from(CLIPS_BUCKET).remove(files);
    return { ok: true, stops: (stops ?? []).length };
  });

/** The «اقترح» button: the Arabic meaning, a target word and its meaning, from the sentence. */
export const adminSuggestClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    parse(
      z.object({ en: z.string().trim().min(2).max(300), kind: z.enum(["video", "gif"]) }),
      input,
    ),
  )
  .handler(async ({ data, context }) => {
    const { assertGuideAdmin } = await import("./guides/guide-admin.server");
    await assertGuideAdmin(context);
    const { suggestClipText } = await import("./rita-curriculum-ai.server");
    try {
      return await suggestClipText(data);
    } catch (cause) {
      throw new Error(cause instanceof Error ? cause.message : "ما قدرنا نقترح هلأ.");
    }
  });

/** GIPHY search for the admin. `configured: false` when the server has no GIPHY_API_KEY. */
export const adminGiphySearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    parse(
      z.object({
        q: z.string().trim().min(1).max(50),
        offset: z.number().int().min(0).max(4975).default(0),
      }),
      input,
    ),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ configured: boolean; results: GiphyResult[]; total: number }> => {
      await assertAdmin(context);
      const { getServerRuntimeSecret } = await import("./config.server");
      const key = await getServerRuntimeSecret("GIPHY_API_KEY");
      if (!key) return { configured: false, results: [], total: 0 };
      const url = new URL("https://api.giphy.com/v1/gifs/search");
      url.search = new URLSearchParams({
        api_key: key,
        q: data.q,
        limit: "24",
        offset: String(data.offset),
        rating: "g",
        lang: "en",
      }).toString();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.status === 401 || response.status === 403)
          throw new Error("مفتاح GIPHY مش شغّال. تأكد من GIPHY_API_KEY.");
        if (response.status === 429) throw new Error("GIPHY وصل حدّه. جرّب بعد شوي.");
        if (!response.ok) throw new Error(`GIPHY ${response.status}`);
        return { configured: true, ...parseGiphySearch(await response.json()) };
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          throw new Error("GIPHY ما ردّ. جرّب مرة ثانية.");
        throw cause;
      } finally {
        clearTimeout(timer);
      }
    },
  );
