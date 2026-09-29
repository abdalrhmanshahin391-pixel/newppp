/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import {
  RITA_V3_MODELS,
  deleteRitaV3WorkerSecret,
  getRitaV3WorkerSecretStatus,
  resolveRitaV3Key,
  ritaV3Environment,
  syncRitaV3WorkerSecret,
} from "@/lib/rita-v3.server";

const providers = ["soniox", "groq", "google", "pipecat_public", "pipecat_private"] as const;
const workerProviders = ["soniox", "groq", "google"] as const;
type WorkerProvider = (typeof workerProviders)[number];

function isWorkerProvider(provider: (typeof providers)[number]): provider is WorkerProvider {
  return workerProviders.includes(provider as WorkerProvider);
}

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
        .eq("slot", 1)
        .in("provider", providers as unknown as string[]),
      (supabase.from as any)("rita_v3_sessions")
        .select("id,status,user_id,started_at")
        .gte("started_at", start),
      (supabase.from as any)("rita_v3_events")
        .select("event_name,value_ms")
        .gte("created_at", start),
    ]);
    const [env, workerSecrets, resolvedKeys] = await Promise.all([
      ritaV3Environment(),
      getRitaV3WorkerSecretStatus(),
      Promise.all(
        providers.map(
          async (provider) =>
            [
              provider,
              Boolean(
                await resolveRitaV3Key(
                  provider,
                  {
                    soniox: "SONIOX_API_KEY",
                    groq: "GROQ_API_KEY",
                    google: "GOOGLE_API_KEY",
                    pipecat_public: "PIPECAT_PUBLIC_API_KEY",
                    pipecat_private: "PIPECAT_PRIVATE_API_KEY",
                  }[provider],
                ),
              ),
            ] as const,
        ),
      ),
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
            Boolean(resolvedKeys.find(([name]) => name === provider)?.[1]),
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

async function syncStoredWorkerKeys(supabase: SupabaseClient<any>) {
  const { data, error } = await (supabase.from as any)("admin_ai_keys")
    .select("provider,api_key")
    .eq("purpose", "rita")
    .eq("slot", 1)
    .in("provider", workerProviders as unknown as string[]);
  if (error) throw error;

  const results = await Promise.all(
    (data ?? []).map(async (item: { provider: WorkerProvider; api_key: string }) => {
      try {
        const result = await syncRitaV3WorkerSecret(item.provider, item.api_key);
        return { provider: item.provider, ...result };
      } catch (cause) {
        return {
          provider: item.provider,
          synced: false,
          reason: cause instanceof Error ? cause.message : "unknown error",
        };
      }
    }),
  );

  return results;
}

export const saveRitaV3Key = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z
      .object({ provider: z.enum(providers), apiKey: z.string().trim().min(8).max(1000) })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = await requireAdmin(context);
    const { error } = await (supabase.from as any)("admin_ai_keys").upsert(
      {
        provider: data.provider,
        purpose: "rita",
        slot: 1,
        api_key: data.apiKey,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,slot,purpose" },
    );
    if (error) throw error;

    if (isWorkerProvider(data.provider)) {
      try {
        const sync = await syncRitaV3WorkerSecret(data.provider, data.apiKey);
        return { ok: true, ...sync };
      } catch (cause) {
        return {
          ok: true,
          synced: false,
          reason: `Saved securely, but Pipecat sync failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
        };
      }
    }

    if (data.provider === "pipecat_private") {
      try {
        const syncResults = await syncStoredWorkerKeys(supabase);
        if (!syncResults.length) {
          return {
            ok: true,
            synced: true,
            reason: "Pipecat private key saved. Add the Soniox, Groq, and Google keys next.",
          };
        }
        const failures = syncResults.filter((result) => !result.synced);
        if (failures.length) {
          return {
            ok: true,
            synced: false,
            reason: `Pipecat key saved. Could not sync: ${failures.map((result) => result.provider).join(", ")}.`,
          };
        }
        return {
          ok: true,
          synced: true,
          reason: `Pipecat private key saved and ${syncResults.length} provider key${syncResults.length === 1 ? "" : "s"} synced.`,
        };
      } catch (cause) {
        return {
          ok: true,
          synced: false,
          reason: `Pipecat key saved, but provider resync failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
        };
      }
    }

    return { ok: true, synced: true, reason: "Pipecat public key saved securely." };
  });

export const deleteRitaV3Key = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ provider: z.enum(providers) }).parse(value))
  .handler(async ({ data, context }) => {
    const { supabase } = await requireAdmin(context);

    if (isWorkerProvider(data.provider)) {
      try {
        await deleteRitaV3WorkerSecret(data.provider);
      } catch (error) {
        console.warn(`Could not remove ${data.provider} from Pipecat`, error);
      }
    }

    const { error } = await (supabase.from as any)("admin_ai_keys")
      .delete()
      .eq("provider", data.provider)
      .eq("purpose", "rita")
      .eq("slot", 1);
    if (error) throw error;
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
