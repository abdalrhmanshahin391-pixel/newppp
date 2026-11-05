// The admin's editing of the lesson path (move stops, add exercise / resources stops, their files
// and links) and the learner's view of a resources stop. Runs with the user's own session: the
// tables' row-level security lets only admins write, and the layout is saved by one database
// function so a move is applied whole or not at all.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { layoutOrders, type PathItem, type PathRef } from "./rita-path-layout";
import {
  MAX_RESOURCES,
  NewResourceSchema,
  RESOURCES_BUCKET,
  hostLabel,
  type LearnerResource,
} from "./rita-resources";

const uuid = z.string().uuid();
const language = z
  .string()
  .trim()
  .regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/)
  .nullable()
  .default(null);
const ref = z.object({ type: z.enum(["lesson", "item"]), id: uuid });

const MISSING = "حدّث قاعدة البيانات أولاً (ملف rita_path_items) عشان تقدر تعدّل المسار.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };

function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error("Bad request.");
  return result.data;
}

function fail(error: { message?: string; code?: string } | null, label: string) {
  if (!error) return;
  if (
    /could not find|does not exist|schema cache|PGRST20[0-9]|42P01|42883/i.test(
      `${error.code ?? ""} ${error.message ?? ""}`,
    )
  )
    throw new Error(MISSING);
  throw new Error(`${label}: ${error.message ?? "database error"}`);
}

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
}

/** Saves a whole path order: lessons keep their own slots, stops go between them. */
async function saveLayout(ctx: Ctx, list: PathRef[]) {
  const lessonIds = list.filter((entry) => entry.type === "lesson").map((entry) => entry.id);
  const slots: Record<string, number> = {};
  if (lessonIds.length) {
    const { data, error } = await ctx.supabase
      .from("rita_lessons")
      .select("id, path_order")
      .in("id", lessonIds);
    fail(error, "lessons");
    for (const row of (data ?? []) as { id: string; path_order: number | null }[])
      if (row.path_order != null) slots[row.id] = Number(row.path_order);
  }
  const orders = layoutOrders(list, slots);
  const { error } = await ctx.supabase.rpc("rita_set_path_layout", {
    p_lessons: orders.lessons,
    p_items: orders.items,
  });
  fail(error, "save path");
}

/** A new order of the path (an admin swapped two stops). */
export const adminSavePathLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ list: z.array(ref).min(1).max(500) }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await saveLayout(context, data.list);
    return { ok: true };
  });

/** Adds an exercises or resources stop at `index` of the path the admin sees. */
export const adminAddPathItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parse(
      z.object({
        language,
        kind: z.enum(["exercises", "resources"]),
        title: z.string().trim().min(1).max(120),
        list: z.array(ref).max(500),
        index: z.number().int().min(0).max(500),
      }),
      data,
    ),
  )
  .handler(async ({ data, context }): Promise<PathItem> => {
    await assertAdmin(context);
    const { data: created, error } = await context.supabase
      .from("rita_path_items")
      .insert({
        language: data.language ?? "en",
        kind: data.kind,
        title: data.title,
        path_order: 0,
        created_by: context.userId,
      })
      .select("id, kind, title, path_order")
      .single();
    fail(error, "add stop");
    if (!created) throw new Error("ما انضافت المحطة. جرّب مرة ثانية.");
    const at = Math.min(data.index, data.list.length);
    const list: PathRef[] = [
      ...data.list.slice(0, at),
      { type: "item", id: created.id },
      ...data.list.slice(at),
    ];
    try {
      await saveLayout(context, list);
    } catch (cause) {
      await context.supabase.from("rita_path_items").delete().eq("id", created.id);
      throw cause;
    }
    const { data: placed } = await context.supabase
      .from("rita_path_items")
      .select("path_order")
      .eq("id", created.id)
      .maybeSingle();
    return {
      id: created.id,
      kind: created.kind,
      title: created.title,
      path_order: Number(placed?.path_order ?? 0),
      resource_count: 0,
    };
  });

export const adminRenamePathItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parse(z.object({ id: uuid, title: z.string().trim().min(1).max(120) }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("rita_path_items")
      .update({ title: data.title })
      .eq("id", data.id);
    fail(error, "rename stop");
    return { ok: true };
  });

export const adminDeletePathItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ id: uuid }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: files } = await context.supabase
      .from("rita_path_item_resources")
      .select("file_path")
      .eq("item_id", data.id);
    const { error } = await context.supabase.from("rita_path_items").delete().eq("id", data.id);
    fail(error, "delete stop");
    const paths = ((files ?? []) as { file_path: string | null }[])
      .map((row) => row.file_path)
      .filter((path): path is string => Boolean(path));
    if (paths.length) await context.supabase.storage.from(RESOURCES_BUCKET).remove(paths);
    return { ok: true };
  });

/** The files and links of a resources stop, PDFs as links that work for an hour. */
export const getPathItemResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ id: uuid }), data))
  .handler(async ({ data, context }): Promise<LearnerResource[]> => {
    const { data: rows, error } = await context.supabase
      .from("rita_path_item_resources")
      .select("id, kind, title, url, file_path, file_size, position")
      .eq("item_id", data.id)
      .order("position");
    fail(error, "resources");
    const out: LearnerResource[] = [];
    for (const row of (rows ?? []) as {
      id: string;
      kind: "pdf" | "link" | "video";
      title: string;
      url: string | null;
      file_path: string | null;
      file_size: number | null;
    }[]) {
      let href = row.url ?? "";
      if (row.file_path) {
        const signed = await context.supabase.storage
          .from(RESOURCES_BUCKET)
          .createSignedUrl(row.file_path, 60 * 60);
        if (signed.error || !signed.data?.signedUrl) continue;
        href = signed.data.signedUrl;
      }
      out.push({
        id: row.id,
        kind: row.kind,
        title: row.title,
        note: "",
        href,
        host: row.url ? hostLabel(row.url) : "PDF",
        size: row.file_size,
      });
    }
    return out;
  });

/** Adds a PDF (already uploaded by the browser) or a link to a resources stop. */
export const adminAddPathItemResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parse(z.object({ itemId: uuid, resource: NewResourceSchema }), data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: existing, error: listError } = await context.supabase
      .from("rita_path_item_resources")
      .select("position")
      .eq("item_id", data.itemId);
    fail(listError, "resources");
    const current = (existing ?? []) as { position: number }[];
    if (current.length >= MAX_RESOURCES)
      throw new Error(`المحطة بتحمل ${MAX_RESOURCES} ملفات وروابط بالأكثر.`);
    const resource = data.resource;
    const position = current.reduce((max, row) => Math.max(max, row.position + 1), 0);
    let row: Record<string, unknown>;
    if (resource.kind === "pdf") {
      if (
        !new RegExp(`^path-items/${data.itemId}/[0-9a-f-]{36}\\.pdf$`, "i").test(resource.file_path)
      )
        throw new Error("The file path does not belong to this stop.");
      row = {
        kind: "pdf",
        title: resource.title,
        file_path: resource.file_path,
        file_name: resource.file_name,
        file_size: resource.file_size,
      };
    } else {
      row = { kind: resource.kind, title: resource.title, url: resource.url };
    }
    const { error } = await context.supabase
      .from("rita_path_item_resources")
      .insert({ ...row, item_id: data.itemId, position, created_by: context.userId });
    fail(error, "add resource");
    return { ok: true };
  });

export const adminDeletePathItemResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ id: uuid }), data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row } = await context.supabase
      .from("rita_path_item_resources")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("rita_path_item_resources")
      .delete()
      .eq("id", data.id);
    fail(error, "delete resource");
    if (row?.file_path)
      await context.supabase.storage.from(RESOURCES_BUCKET).remove([row.file_path]);
    return { ok: true };
  });
