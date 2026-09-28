/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import {
  RITA_V3_MODELS,
  deleteRitaV3WorkerSecret,
  getRitaV3WorkerSecretStatus,
  ritaV3Environment,
  syncRitaV3WorkerSecret,
} from "@/lib/rita-v3.server";

const providers = ["soniox", "groq", "google", "pipecat_public", "pipecat_private"] as const;

async function requireAdmin(context: unknown) {
  const { supabase, userId } = context as { supabase: SupabaseClient<any>; userId: string };
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
  return { supabase, userId };
}

export const getRitaV3Admin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireAdmin(context);
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: keys }, { data: sessions }, { data: events }] = await Promise.all([
      (supabase.from as any)("admin_ai_keys")
        .select("provider,updated_at")
        .eq("purpose", "rita")
        .in("provider", providers as unknown as string[]),
      (supabase.from as any)("rita_v3_sessions")
        .select("id,status,user_id,started_at")
        .gte("started_at", start),
      (supabase.from as any)("rita_v3_events")
        .select("event_name,value_ms")
        .gte("created_at", start),
    ]);
    const [env, workerSecrets] = await Promise.all([
      ritaV3Environment(),
      getRitaV3WorkerSecretStatus(),
    ]);
    const firstAudio = (events ?? [])
      .filter((item: any) => item.event_name === "first_audio" && Number.isFinite(item.value_ms))
      .map((item: any) => Number(item.value_ms))
      .sort((a: number, b: number) => a - b);
    const percentile = (ratio: number) =>
      firstAudio.length
        ? firstAudio[Math.min(firstAudio.length - 1, Math.ceil(firstAudio.length * ratio) - 1)]
        : 0;
    return {
      models: RITA_V3_MODELS,
      agentName: env.agentName,
      configured: Object.fromEntries(
        providers.map((provider) => [
          provider,
          Boolean((keys ?? []).find((item: any) => item.provider === provider)) ||
            (provider === "pipecat_public" ? Boolean(env.publicKey) : provider === "pipecat_private" ? Boolean(env.privateKey) : false),
        ]),
      ),
      workerConfigured: {
        soniox: workerSecrets.fields.includes("SONIOX_API_KEY"),
        groq: workerSecrets.fields.includes("GROQ_API_KEY"),
        google: workerSecrets.fields.includes("GOOGLE_API_KEY"),
      },
      workerSecretStatus: workerSecrets.status,
      workerRegion: workerSecrets.region,
      metrics: {
        sessions: (sessions ?? []).length,
        active: (sessions ?? []).filter((item: any) => item.status === "connected").length,
        failed: (sessions ?? []).filter((item: any) => item.status === "failed").length,
        uniqueUsers: new Set((sessions ?? []).map((item: any) => item.user_id)).size,
        latencyP50: percentile(0.5),
        latencyP95: percentile(0.95),
        latencyP99: percentile(0.99),
      },
    };
  });

export const saveRitaV3Key = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ provider: z.enum(providers), apiKey: z.string().trim().min(8).max(1000) }).parse(value),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = await requireAdmin(context);
    const { error } = await (supabase.from as any)("admin_ai_keys").upsert({
      provider: data.provider,
      purpose: "rita",
      slot: 1,
      api_key: data.apiKey,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    let sync = { synced: false, reason: "Control-plane keys are stored only in RitaJet." };
    if (data.provider === "soniox" || data.provider === "groq" || data.provider === "google") {
      try {
        sync = await syncRitaV3WorkerSecret(data.provider, data.apiKey);
      } catch (cause) {
        sync = {
          synced: false,
          reason: `Saved in RitaJet, but worker sync failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
        };
      }
    }
    return { ok: true, ...sync };
  });

export const deleteRitaV3Key = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ provider: z.enum(providers) }).parse(value))
  .handler(async ({ data, context }) => {
    const { supabase } = await requireAdmin(context);
    const { error } = await (supabase.from as any)("admin_ai_keys")
      .delete()
      .eq("provider", data.provider)
      .eq("purpose", "rita")
      .eq("slot", 1);
    if (error) throw error;
    if (data.provider === "soniox" || data.provider === "groq" || data.provider === "google") {
      await deleteRitaV3WorkerSecret(data.provider);
    }
    return { ok: true };
  });

export const testRitaV3ControlPlane = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const env = await ritaV3Environment();
    if (!env.privateKey) return { ok: false, message: "Add the Pipecat private key first." };
    try {
      const response = await fetch("https://api.pipecat.daily.co/v1/agents", {
        headers: { Authorization: `Bearer ${env.privateKey}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return { ok: false, message: `Pipecat returned ${response.status}.` };
      const data = (await response.json()) as { agents?: { name?: string }[] };
      const found = data.agents?.some((agent) => agent.name === env.agentName) ?? false;
      return {
        ok: found,
        message: found
          ? `${env.agentName} is deployed and visible.`
          : `Pipecat is connected, but ${env.agentName} has not been deployed yet.`,
      };
    } catch {
      return { ok: false, message: "Could not reach the Pipecat control plane." };
    }
  });
