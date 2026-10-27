// Server functions for the PDF guides (admin only). A guide is made in two requests so neither runs
// long: write (OpenAI writes the page from the book's text, a second call checks it) and render
// (the HTML template, the Modal renderer, the private bucket). Each can be repeated on its own.
// Everything runs with the admin's own session under row level security: no service key.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { GuideContentSchema } from "./guide-content";
import {
  guideFileName,
  guideStoragePath,
  isStuck,
  type GuideErrorCode,
  type GuideRow,
} from "./guide-record";

export type { GuideRow };
/** A row for the list, plus whether its content is saved (a failed drawing can be retried cheaply). */
export type GuideListItem = GuideRow & { has_content: boolean };

const uuid = z.string().uuid();
const LIST_COLUMNS =
  "id, curriculum_id, title, from_page, to_page, status, version, warnings, storage_path, error_code, error_message, model, created_at, updated_at";

function describe(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? "")).slice(0, 240);
}

function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error("Bad request.");
  return result.data;
}

export const adminListGuides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ curriculumId: uuid }), data))
  .handler(async ({ data, context }): Promise<{ ready: boolean; guides: GuideListItem[] }> => {
    const { assertGuideAdmin } = await import("./guide-admin.server");
    await assertGuideAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("rita_lesson_guides")
      .select(`${LIST_COLUMNS}, content`)
      .eq("curriculum_id", data.curriculumId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) {
      // The migration is not applied yet: say so instead of showing a broken list.
      if (/could not find|does not exist|PGRST20[0-9]|42P01/i.test(error.message ?? "")) {
        return { ready: false, guides: [] };
      }
      throw new Error(`guides: ${error.message}`);
    }
    const now = Date.now();
    const guides: GuideListItem[] = [];
    for (const row of rows ?? []) {
      const { content, ...rest } = row as GuideRow & { content: unknown };
      let item: GuideRow = rest;
      if (isStuck(item, now)) {
        // Lost in the middle (a closed tab, a failed request): say so, so it can be retried.
        const patch = { status: "failed" as const, error_code: "stuck", error_message: "" };
        await context.supabase.from("rita_lesson_guides").update(patch).eq("id", item.id);
        item = { ...item, ...patch };
      }
      guides.push({
        ...item,
        warnings: Array.isArray(item.warnings) ? item.warnings : [],
        has_content: content != null,
      });
    }
    return { ready: true, guides };
  });

const WriteInput = z
  .object({
    curriculumId: uuid,
    title: z.string().trim().min(1).max(200),
    fromPage: z.number().int().min(1),
    toPage: z.number().int().min(1),
  })
  .refine((value) => value.toPage >= value.fromPage && value.toPage - value.fromPage < 10, "pages");

export type WriteGuideResult =
  | { ok: true; guideId: string }
  | { ok: false; code: GuideErrorCode | "already_running"; message: string };

export const adminWriteGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(WriteInput, data))
  .handler(async ({ data, context }): Promise<WriteGuideResult> => {
    const { assertGuideAdmin } = await import("./guide-admin.server");
    await assertGuideAdmin(context);
    const db = context.supabase;

    const { data: pages, error: pagesError } = await db
      .from("rita_curriculum_pages")
      .select("page_no, text")
      .eq("curriculum_id", data.curriculumId)
      .gte("page_no", data.fromPage)
      .lte("page_no", data.toPage)
      .order("page_no");
    if (pagesError) throw new Error(`pages: ${pagesError.message}`);
    const readable = (pages ?? []).filter((page) => String(page.text ?? "").trim().length > 20);
    if (!readable.length) return { ok: false, code: "no_pages", message: "No page text." };

    const { data: book } = await db
      .from("rita_curricula")
      .select("title")
      .eq("id", data.curriculumId)
      .maybeSingle();

    // The next version of a guide for the same pages and title.
    const { data: previous } = await db
      .from("rita_lesson_guides")
      .select("version")
      .eq("curriculum_id", data.curriculumId)
      .eq("from_page", data.fromPage)
      .eq("to_page", data.toPage)
      .eq("title", data.title)
      .order("version", { ascending: false })
      .limit(1);
    const version = Number(previous?.[0]?.version ?? 0) + 1;

    const { data: created, error: insertError } = await db
      .from("rita_lesson_guides")
      .insert({
        curriculum_id: data.curriculumId,
        title: data.title,
        from_page: data.fromPage,
        to_page: data.toPage,
        status: "writing",
        version,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23505") {
        return { ok: false, code: "already_running", message: "This guide is already being made." };
      }
      throw new Error(`guides: ${insertError.message}`);
    }
    const guideId = String(created.id);
    const fail = async (code: GuideErrorCode, error: unknown): Promise<WriteGuideResult> => {
      await db
        .from("rita_lesson_guides")
        .update({ status: "failed", error_code: code, error_message: describe(error) })
        .eq("id", guideId);
      return { ok: false, code, message: describe(error) };
    };

    try {
      const ai = await import("@/lib/rita-curriculum-ai.server");
      const input = {
        bookTitle: String(book?.title ?? "Course book"),
        title: data.title,
        from: data.fromPage,
        to: data.toPage,
        pages: readable.map((page) => ({ page_no: Number(page.page_no), text: String(page.text) })),
      };
      const written = await ai.generateGuide(input);
      let problems: Awaited<ReturnType<typeof ai.reviewGuide>>["problems"] = [];
      try {
        problems = (await ai.reviewGuide({ content: written.content, pages: input.pages }))
          .problems;
      } catch (error) {
        // The writing worked; only the second look failed. Keep the guide and say so.
        problems = [
          {
            block: "review",
            severity: "low",
            problem: `The second check did not run: ${describe(error)}`,
          },
        ];
      }
      const { error: saveError } = await db
        .from("rita_lesson_guides")
        .update({
          status: "written",
          content: written.content,
          warnings: problems,
          model: written.model,
          error_code: null,
          error_message: null,
        })
        .eq("id", guideId);
      if (saveError) return fail("upload_failed", saveError.message);
      return { ok: true, guideId };
    } catch (error) {
      const status = (error as { status?: number })?.status ?? 0;
      const badFormat = status === 502 || /did not match|expected format/i.test(describe(error));
      return fail(badFormat ? "ai_bad_format" : "ai_unavailable", error);
    }
  });

export type RenderGuideResult =
  { ok: true; guideId: string } | { ok: false; code: GuideErrorCode; message: string };

export const adminRenderGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parse(z.object({ guideId: uuid }), data))
  .handler(async ({ data, context }): Promise<RenderGuideResult> => {
    const { assertGuideAdmin } = await import("./guide-admin.server");
    await assertGuideAdmin(context);
    const db = context.supabase;
    const { data: row, error } = await db
      .from("rita_lesson_guides")
      .select("id, curriculum_id, title, version, content, status")
      .eq("id", data.guideId)
      .maybeSingle();
    if (error) throw new Error(`guides: ${error.message}`);
    if (!row) throw new Error("This guide was not found.");
    const content = GuideContentSchema.safeParse(row.content);
    if (!content.success) {
      return {
        ok: false,
        code: "ai_bad_format",
        message: "The saved guide cannot be read. Write it again.",
      };
    }
    if (row.status === "writing" || row.status === "rendering") {
      return { ok: false, code: "stuck", message: "This guide is still being made." };
    }

    await db
      .from("rita_lesson_guides")
      .update({ status: "rendering", error_code: null, error_message: null })
      .eq("id", row.id);
    const fail = async (code: GuideErrorCode, message: string): Promise<RenderGuideResult> => {
      await db
        .from("rita_lesson_guides")
        .update({ status: "failed", error_code: code, error_message: message.slice(0, 240) })
        .eq("id", row.id);
      return { ok: false, code, message };
    };

    const [{ renderGuideHtml }, { renderPdf, DEFAULT_GUIDES_URL }, { getServerRuntimeSecret }] =
      await Promise.all([
        import("./guide-html"),
        import("./guide-render"),
        import("@/lib/config.server"),
      ]);
    const html = renderGuideHtml(content.data, { draft: true, fontBase: "fonts/" });
    const rendered = await renderPdf({
      html,
      url: (await getServerRuntimeSecret("RITA_GUIDES_URL")) || DEFAULT_GUIDES_URL,
      token: await getServerRuntimeSecret("MODAL_START_TOKEN"),
    });
    if (!rendered.ok) return fail(rendered.code, rendered.message);

    const path = guideStoragePath(String(row.curriculum_id), String(row.id), Number(row.version));
    const { error: uploadError } = await db.storage
      .from("rita-guides")
      .upload(path, rendered.pdf, { contentType: "application/pdf", upsert: true });
    if (uploadError) return fail("upload_failed", uploadError.message);

    const { error: doneError } = await db
      .from("rita_lesson_guides")
      .update({ status: "ready", storage_path: path, error_code: null, error_message: null })
      .eq("id", row.id);
    if (doneError) return fail("upload_failed", doneError.message);
    return { ok: true, guideId: String(row.id) };
  });

/** A link to the PDF that works for an hour. The bucket is private; nothing is ever public. */
export const adminGuideUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    parse(z.object({ guideId: uuid, download: z.boolean().default(false) }), data),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { assertGuideAdmin } = await import("./guide-admin.server");
    await assertGuideAdmin(context);
    const { data: row, error } = await context.supabase
      .from("rita_lesson_guides")
      .select("title, version, storage_path, status")
      .eq("id", data.guideId)
      .maybeSingle();
    if (error) throw new Error(`guides: ${error.message}`);
    if (!row || row.status !== "ready" || !row.storage_path)
      throw new Error("This guide has no file yet.");
    const { data: signed, error: signError } = await context.supabase.storage
      .from("rita-guides")
      .createSignedUrl(
        String(row.storage_path),
        60 * 60,
        data.download
          ? { download: guideFileName(String(row.title), Number(row.version)) }
          : undefined,
      );
    if (signError || !signed?.signedUrl)
      throw new Error(`file: ${signError?.message ?? "no link"}`);
    return { url: signed.signedUrl };
  });
