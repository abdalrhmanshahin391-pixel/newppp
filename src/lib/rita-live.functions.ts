/* eslint-disable @typescript-eslint/no-explicit-any -- Rita's new migration tables are not in the generated Supabase types until the production schema is regenerated. */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

async function requireAdmin(context: unknown) {
  const { supabase, userId } = context as { supabase: SupabaseClient<any>; userId: string };
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
  return { supabase, userId };
}

export const testRitaLiveKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireAdmin(context);

    let key = "";
    let source: "admin" | "environment" = "admin";
    for (const purpose of ["rita", "shared"]) {
      const { data: row, error } = await (supabase.from as any)("admin_ai_keys")
        .select("api_key")
        .eq("provider", "openai")
        .eq("purpose", purpose)
        .eq("slot", 1)
        .maybeSingle();
      if (error) throw error;
      key = String(row?.api_key ?? "").trim();
      if (key) break;
    }
    if (!key) {
      key = (process.env["OPENAI_API_KEY"] ?? "").trim();
      source = "environment";
    }
    if (!key) return { ok: false, message: "No OpenAI key is saved yet." };

    try {
      const response = await fetch("https://api.openai.com/v1/models/gpt-4o-mini", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (response.ok) {
        return {
          ok: true,
          message:
            source === "environment"
              ? "Working — Rita is using the protected environment key."
              : "Working — Rita can reach the low-cost voice pipeline with this saved key.",
        };
      }
      const result = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const detail = String(result?.error?.message ?? `OpenAI returned ${response.status}`).slice(
        0,
        180,
      );
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          message: "OpenAI rejected this key. Check the key and project permissions.",
        };
      }
      return { ok: false, message: detail };
    } catch (error) {
      return {
        ok: false,
        message: `Could not reach OpenAI: ${String((error as Error)?.message ?? error).slice(0, 140)}`,
      };
    }
  });

const SettingsSchema = z.object({
  enabled: z.boolean(),
  voice: z.enum([
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "onyx",
    "nova",
    "sage",
    "shimmer",
    "verse",
    "marin",
    "cedar",
  ]),
  responseWords: z.number().int().min(20).max(120),
  dailyGuardMinutes: z.number().int().min(15).max(720),
  defaultMonthlyMinutes: z.number().int().min(30).max(10_000),
  monthlyBudgetCents: z.number().int().min(100).max(1_000_000),
  pipelineMode: z.enum(["legacy", "economic_v2"]),
  rolloutPercent: z.number().int().min(0).max(100),
  adminOnlyPreview: z.boolean(),
});

export const getRitaVoiceAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireAdmin(context);
    const month = new Date();
    const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString();
    const [{ data: settings }, { data: usage }, { data: sessions }, { data: timings }] =
      await Promise.all([
        (supabase.from as any)("rita_voice_settings")
          .select(
            "enabled,voice,response_words,daily_guard_minutes,default_monthly_minutes,monthly_budget_cents,pipeline_mode,rollout_percent,admin_only_preview",
          )
          .eq("id", true)
          .maybeSingle(),
        (supabase.from as any)("rita_voice_usage")
          .select(
            "user_id,input_audio_ms,output_audio_ms,estimated_cost_micros,status,response_model",
          )
          .gte("created_at", start),
        (supabase.from as any)("rita_voice_sessions")
          .select("id,user_id,ended_at")
          .gte("started_at", start),
        (supabase.from as any)("rita_turn_metrics")
          .select("speech_end_to_first_audio_ms")
          .gte("created_at", start)
          .not("speech_end_to_first_audio_ms", "is", null),
      ]);
    const rows = (usage ?? []) as any[];
    const activeMs = rows.reduce(
      (sum, row) => sum + Number(row.input_audio_ms || 0) + Number(row.output_audio_ms || 0),
      0,
    );
    const costMicros = rows.reduce((sum, row) => sum + Number(row.estimated_cost_micros || 0), 0);
    const latencyValues = ((timings ?? []) as any[])
      .map((row) => Number(row.speech_end_to_first_audio_ms))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((left, right) => left - right);
    const percentile = (ratio: number) =>
      latencyValues.length
        ? latencyValues[
            Math.min(latencyValues.length - 1, Math.ceil(latencyValues.length * ratio) - 1)
          ]
        : 0;
    return {
      settings: {
        enabled: settings?.enabled !== false,
        voice: settings?.voice || "marin",
        responseWords: Number(settings?.response_words || 55),
        dailyGuardMinutes: Number(settings?.daily_guard_minutes || 120),
        defaultMonthlyMinutes: Number(settings?.default_monthly_minutes || 1200),
        monthlyBudgetCents: Number(settings?.monthly_budget_cents || 10_000),
        pipelineMode: settings?.pipeline_mode === "legacy" ? "legacy" : "economic_v2",
        rolloutPercent: Math.min(100, Math.max(0, Number(settings?.rollout_percent ?? 100))),
        adminOnlyPreview: settings?.admin_only_preview === true,
      },
      metrics: {
        sessions: (sessions ?? []).length,
        activeSessions: (sessions ?? []).filter((item: any) => !item.ended_at).length,
        uniqueLearners: new Set(rows.map((item) => item.user_id)).size,
        activeMinutes: Math.round(activeMs / 60_000),
        estimatedCost: Number((costMicros / 1_000_000).toFixed(2)),
        turns: rows.length,
        latencyP50: percentile(0.5),
        latencyP95: percentile(0.95),
      },
    };
  });

export const saveRitaVoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => SettingsSchema.parse(value))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = await requireAdmin(context);
    const { error } = await (supabase.from as any)("rita_voice_settings").upsert({
      id: true,
      enabled: data.enabled,
      voice: data.voice,
      response_words: data.responseWords,
      daily_guard_minutes: data.dailyGuardMinutes,
      default_monthly_minutes: data.defaultMonthlyMinutes,
      monthly_budget_cents: data.monthlyBudgetCents,
      pipeline_mode: data.pipelineMode,
      rollout_percent: data.rolloutPercent,
      admin_only_preview: data.adminOnlyPreview,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });
