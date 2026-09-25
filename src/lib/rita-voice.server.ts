/* eslint-disable @typescript-eslint/no-explicit-any -- Rita's new migration tables are not in the generated Supabase types until the production schema is regenerated. */
import { createClient } from "@supabase/supabase-js";

export const RITA_MODELS = {
  transcription: "deepgram-nova-3",
  response: "gpt-4o-mini",
  speech: "gpt-4o-mini-tts",
} as const;

export type RitaPilotMode = "legacy" | "economic_v2";

async function rolloutBucket(userId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return new DataView(digest).getUint32(0) % 100;
}

export async function getRitaPilotMode(userId: string): Promise<RitaPilotMode> {
  const settings = await getRitaSettings();
  if (settings.pipelineMode === "legacy") return "legacy";
  if (settings.adminOnlyPreview) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await (supabaseAdmin as any).rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!data) return "legacy";
    } catch {
      return "legacy";
    }
  }
  return (await rolloutBucket(userId)) < settings.rolloutPercent ? "economic_v2" : "legacy";
}

export const RITA_PERSONALITIES = ["kind", "direct", "playful", "strict"] as const;
export type RitaPersonality = (typeof RITA_PERSONALITIES)[number];

export type RitaSettings = {
  enabled: boolean;
  voice: string;
  responseWords: number;
  dailyGuardMinutes: number;
  defaultMonthlyMinutes: number;
  monthlyBudgetCents: number;
  pipelineMode: RitaPilotMode;
  rolloutPercent: number;
  adminOnlyPreview: boolean;
};

export type RitaAuth = { userId: string };

const DEFAULT_SETTINGS: RitaSettings = {
  enabled: true,
  voice: "marin",
  responseWords: 55,
  dailyGuardMinutes: 120,
  defaultMonthlyMinutes: 1200,
  monthlyBudgetCents: 10_000,
  pipelineMode: "economic_v2",
  rolloutPercent: 100,
  adminOnlyPreview: false,
};

function apiUrl() {
  return process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
}

function publicKey() {
  return (
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_ANON_KEY"] ??
    ""
  );
}

export async function requireRitaUser(request: Request): Promise<RitaAuth | null> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3 || !apiUrl() || !publicKey()) return null;
  const client = createClient(apiUrl(), publicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  const userId = String(data?.claims?.sub ?? "");
  return error || !userId ? null : { userId };
}

export async function resolveRitaOpenAiKey(): Promise<string | null> {
  const environmentKey = (process.env["OPENAI_API_KEY"] ?? "").trim();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = (name: string) => (supabaseAdmin.from as any)(name);
    for (const purpose of ["rita", "shared"]) {
      const { data } = await table("admin_ai_keys")
        .select("api_key")
        .eq("provider", "openai")
        .eq("purpose", purpose)
        .eq("slot", 1)
        .maybeSingle();
      const saved = String(data?.api_key ?? "").trim();
      if (saved.length > 20) return saved;
    }
  } catch (error) {
    console.warn("Rita could not read its OpenAI key", error);
  }
  return environmentKey.length > 20 ? environmentKey : null;
}

export async function resolveRitaDeepgramKey(): Promise<string | null> {
  const environmentKey = (process.env["DEEPGRAM_API_KEY"] ?? "").trim();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const purpose of ["rita", "shared"]) {
      const { data } = await (supabaseAdmin.from as any)("admin_ai_keys")
        .select("api_key")
        .eq("provider", "deepgram")
        .eq("purpose", purpose)
        .eq("slot", 1)
        .maybeSingle();
      const saved = String(data?.api_key ?? "").trim();
      if (saved.length > 20) return saved;
    }
  } catch (error) {
    console.warn("Rita could not read its Deepgram key", error);
  }
  return environmentKey.length > 20 ? environmentKey : null;
}

export async function getRitaSettings(): Promise<RitaSettings> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin.from as any)("rita_voice_settings")
      .select(
        "enabled,voice,response_words,daily_guard_minutes,default_monthly_minutes,monthly_budget_cents,pipeline_mode,rollout_percent,admin_only_preview",
      )
      .eq("id", true)
      .maybeSingle();
    if (!data) return DEFAULT_SETTINGS;
    return {
      enabled: data.enabled !== false,
      voice: String(data.voice || DEFAULT_SETTINGS.voice),
      responseWords: Number(data.response_words || DEFAULT_SETTINGS.responseWords),
      dailyGuardMinutes: Number(data.daily_guard_minutes || DEFAULT_SETTINGS.dailyGuardMinutes),
      defaultMonthlyMinutes: Number(
        data.default_monthly_minutes || DEFAULT_SETTINGS.defaultMonthlyMinutes,
      ),
      monthlyBudgetCents: Number(data.monthly_budget_cents || DEFAULT_SETTINGS.monthlyBudgetCents),
      pipelineMode: data.pipeline_mode === "legacy" ? "legacy" : "economic_v2",
      rolloutPercent: Math.min(100, Math.max(0, Number(data.rollout_percent ?? 100))),
      adminOnlyPreview: data.admin_only_preview === true,
    };
  } catch {
    // Allows the application to run before the migration reaches production.
    return DEFAULT_SETTINGS;
  }
}

function startOfUtcMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function startOfUtcDay() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

async function planAllowance(userId: string, fallback: number) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = (name: string) => (supabaseAdmin.from as any)(name);
    const { data: userPlan } = await table("user_plans")
      .select("plan_slug")
      .eq("user_id", userId)
      .maybeSingle();
    const slug = String(userPlan?.plan_slug ?? "starter");
    const { data: plan } = await table("plans")
      .select("rita_voice_minutes_monthly")
      .eq("slug", slug)
      .maybeSingle();
    const minutes = Number(plan?.rita_voice_minutes_monthly);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
  } catch {
    return fallback;
  }
}

export type RitaAllowance = {
  allowed: boolean;
  reason: "ok" | "disabled" | "daily_guard" | "monthly_allowance" | "budget";
  usedMonthMs: number;
  usedTodayMs: number;
  monthlyLimitMs: number;
  remainingMs: number;
  premiumVoice: boolean;
};

export async function getRitaAllowance(
  userId: string,
  settings = DEFAULT_SETTINGS,
): Promise<RitaAllowance> {
  const monthlyMinutes = await planAllowance(userId, settings.defaultMonthlyMinutes);
  const monthlyLimitMs = monthlyMinutes * 60_000;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = (name: string) => (supabaseAdmin.from as any)(name);
    const { data: totals, error: totalsError } = await (supabaseAdmin as any).rpc(
      "rita_voice_usage_totals",
      { _user_id: userId },
    );
    let usedMonthMs: number;
    let usedTodayMs: number;
    let globalMicros: number;
    if (!totalsError && Array.isArray(totals) && totals[0]) {
      usedMonthMs = Number(totals[0].used_month_ms || 0);
      usedTodayMs = Number(totals[0].used_today_ms || 0);
      globalMicros = Number(totals[0].global_month_micros || 0);
    } else {
      // Keep deployments usable while the optimization migration is rolling out.
      const [{ data: monthRows }, { data: dayRows }, { data: globalRows }] = await Promise.all([
        table("rita_voice_usage")
          .select("input_audio_ms,output_audio_ms")
          .eq("user_id", userId)
          .gte("created_at", startOfUtcMonth()),
        table("rita_voice_usage")
          .select("input_audio_ms,output_audio_ms")
          .eq("user_id", userId)
          .gte("created_at", startOfUtcDay()),
        table("rita_voice_usage")
          .select("estimated_cost_micros")
          .gte("created_at", startOfUtcMonth()),
      ]);
      const active = (rows: any[] | null) =>
        (rows ?? []).reduce(
          (sum, row) => sum + Number(row.input_audio_ms || 0) + Number(row.output_audio_ms || 0),
          0,
        );
      usedMonthMs = active(monthRows);
      usedTodayMs = active(dayRows);
      globalMicros = (globalRows ?? []).reduce(
        (sum: number, row: any) => sum + Number(row.estimated_cost_micros || 0),
        0,
      );
    }
    const budgetReached = globalMicros >= settings.monthlyBudgetCents * 10_000;
    const premiumVoice = usedMonthMs < monthlyLimitMs && !budgetReached;
    const dailyReached = usedTodayMs >= settings.dailyGuardMinutes * 60_000;
    return {
      allowed: settings.enabled && !dailyReached,
      reason: !settings.enabled
        ? "disabled"
        : dailyReached
          ? "daily_guard"
          : budgetReached
            ? "budget"
            : usedMonthMs >= monthlyLimitMs
              ? "monthly_allowance"
              : "ok",
      usedMonthMs,
      usedTodayMs,
      monthlyLimitMs,
      remainingMs: Math.max(0, monthlyLimitMs - usedMonthMs),
      premiumVoice,
    };
  } catch {
    return {
      allowed: settings.enabled,
      reason: settings.enabled ? "ok" : "disabled",
      usedMonthMs: 0,
      usedTodayMs: 0,
      monthlyLimitMs,
      remainingMs: monthlyLimitMs,
      premiumVoice: true,
    };
  }
}

export function estimateWavDurationMs(file: File) {
  if (file.type.includes("wav") && file.size > 44) {
    return Math.min(45_000, Math.max(200, Math.round(((file.size - 44) / 32_000) * 1000)));
  }
  return Math.min(45_000, Math.max(500, Math.round((file.size / 16_000) * 1000)));
}

export function estimateSpeechDurationMs(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(60_000, Math.max(900, Math.round((words / 145) * 60_000)));
}

export function estimateTurnCostMicros(args: {
  inputAudioMs: number;
  outputAudioMs: number;
  inputTokens: number;
  outputTokens: number;
}) {
  // Conservative guardrail estimates: Nova-3 streaming plus keyterm prompting
  // about $0.0072/min, TTS about $0.018/min, and GPT-4o Mini token rates.
  return Math.max(
    1,
    Math.round(
      args.inputAudioMs * 0.12 +
        args.outputAudioMs * 0.3 +
        args.inputTokens * 0.15 +
        args.outputTokens * 0.6,
    ),
  );
}

export function normalizePersonality(value: unknown): RitaPersonality {
  const requested = String(value ?? "kind") as RitaPersonality;
  return RITA_PERSONALITIES.includes(requested) ? requested : "kind";
}

export function cleanLanguage(value: unknown) {
  return (
    String(value ?? "automatic")
      .trim()
      .slice(0, 64) || "automatic"
  );
}
