// Admin-only: one page controls the AI key of every tool.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const AI_TOOL_IDS = [
  "aio",
  "rita",
  "lecture",
  "questions",
  "archive",
  "summaries",
  "german",
  "speech",
] as const;
export type AiToolId = (typeof AI_TOOL_IDS)[number];

const ToolSchema = z.enum(AI_TOOL_IDS);

async function assertAdmin(context: any) {
  const { supabase, userId } = context;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
  return { supabase, userId };
}

export type ToolStatus = {
  id: AiToolId;
  name: string;
  blurb: string;
  source: "own" | "shared" | "secret" | "gateway";
  model: string;
  last4: string | null;
  updatedAt: string | null;
};

/** Every tool with the key it will actually use (masked). */
export const listAiEngine = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await assertAdmin(context);
    const { AI_TOOLS, resolveAiTarget } = await import("@/lib/ai-engine.server");

    const { data } = await supabase
      .from("admin_ai_keys")
      .select("purpose, api_key, updated_at")
      .eq("provider", "gemini");
    const saved = new Map<string, { last4: string; updatedAt: string | null }>();
    for (const r of (data ?? []) as any[]) {
      const key = String(r.api_key ?? "").trim();
      if (key.length > 10) saved.set(r.purpose, { last4: key.slice(-4), updatedAt: r.updated_at });
    }

    const tools: ToolStatus[] = [];
    for (const t of AI_TOOLS) {
      try {
        const target = await resolveAiTarget(supabase, t.id);
        const from = target.source === "own" ? saved.get(t.id) : saved.get("shared");
        tools.push({
          id: t.id,
          name: t.name,
          blurb: t.blurb,
          source: target.source,
          model: target.model,
          last4: target.google ? (from?.last4 ?? null) : null,
          updatedAt: from?.updatedAt ?? null,
        });
      } catch {
        tools.push({
          id: t.id,
          name: t.name,
          blurb: t.blurb,
          source: "gateway",
          model: "—",
          last4: null,
          updatedAt: null,
        });
      }
    }
    return { tools, sharedSaved: saved.has("shared") };
  });

export const saveToolKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tool: ToolSchema,
        apiKey: z.string().trim().min(20).max(500),
        model: z.string().trim().max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = await assertAdmin(context);
    const { error } = await supabase.from("admin_ai_keys").upsert(
      {
        provider: "gemini",
        purpose: data.tool,
        slot: 1,
        api_key: data.apiKey,
        preferred_model: data.model?.trim() || null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "provider,slot,purpose" },
    );
    if (error) throw error;
    const { pingChatKey } = await import("@/lib/ai-engine.server");
    const test = await pingChatKey(data.apiKey, data.model ?? null);
    return { ok: true, test };
  });

export const clearToolKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tool: ToolSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = await assertAdmin(context);
    const { error } = await supabase
      .from("admin_ai_keys")
      .delete()
      .eq("provider", "gemini")
      .eq("purpose", data.tool);
    if (error) throw error;
    return { ok: true };
  });

export const testTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tool: ToolSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = await assertAdmin(context);
    const { resolveAiTarget, pingChatKey } = await import("@/lib/ai-engine.server");
    try {
      const target = await resolveAiTarget(supabase, data.tool);
      const r = await pingChatKey(target.key, target.model, { gateway: !target.google });
      const where =
        target.source === "own"
          ? "its own key"
          : target.source === "shared"
            ? "the shared Gemini key"
            : target.source === "secret"
              ? "the site Gemini key"
              : "the shared RitaJet AI";
      return { ok: r.ok, message: `${where}: ${r.message}` };
    } catch (e: any) {
      return { ok: false, message: String(e?.message ?? e) };
    }
  });
