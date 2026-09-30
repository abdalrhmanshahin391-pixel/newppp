/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import {
  RITA_V3_MODELS,
  RITA_V3_WORKER_SECRET_NAMES,
  deleteRitaV3WorkerSecret,
  getRitaV3Readiness,
  getRitaV3WorkerSecretStatus,
  probeRitaV3Worker,
  resolveRitaV3Key,
  ritaV3Environment,
  syncRitaV3WorkerSecrets,
} from "@/lib/rita-v3.server";
import type { RitaV3WorkerProvider } from "@/lib/rita-v3.server";

const providers = ["soniox", "groq", "google", "pipecat_public", "pipecat_private"] as const;
const workerProviders = ["soniox", "groq", "google"] as const;

function isWorkerProvider(provider: (typeof providers)[number]): provider is RitaV3WorkerProvider {
  return workerProviders.includes(provider as RitaV3WorkerProvider);
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
        .select("provider,updated_at,api_key")
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
    const [env, resolvedKeys] = await Promise.all([
      ritaV3Environment(),
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
    const storedPrivateKey = String(
      (keys ?? []).find((item: any) => item.provider === "pipecat_private")?.api_key ?? "",
    ).trim();
    const workerSecrets = await getRitaV3WorkerSecretStatus(storedPrivateKey || env.privateKey);
    const firstAudio = (events ?? [])
      .filter(
        (item: any) => item.event_name === "first_remote_audio" && Number.isFinite(item.value_ms),
      )
      .map((item: any) => Number(item.value_ms))
      .sort((a: number, b: number) => a - b);
    const percentile = (ratio: number) =>
      firstAudio.length
        ? firstAudio[Math.min(firstAudio.length - 1, Math.ceil(firstAudio.length * ratio) - 1)]
        : null;
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
        latencySamples: firstAudio.length,
        latencyP50: percentile(0.5),
        latencyP95: percentile(0.95),
        latencyP99: percentile(0.99),
      },
    };
  });

async function getStoredRitaKey(
  supabase: SupabaseClient<any>,
  provider: (typeof providers)[number],
) {
  const { data, error } = await (supabase.from as any)("admin_ai_keys")
    .select("api_key")
    .eq("provider", provider)
    .eq("purpose", "rita")
    .eq("slot", 1)
    .maybeSingle();
  if (error) throw error;
  return String(data?.api_key ?? "").trim();
}

async function syncStoredWorkerKeys(supabase: SupabaseClient<any>, privateKey: string) {
  const { data, error } = await (supabase.from as any)("admin_ai_keys")
    .select("provider,api_key")
    .eq("purpose", "rita")
    .eq("slot", 1)
    .in("provider", workerProviders as unknown as string[]);
  if (error) throw error;

  const stored = (data ?? []) as { provider: RitaV3WorkerProvider; api_key: string }[];
  const values = Object.fromEntries(
    stored.map((item) => [item.provider, String(item.api_key ?? "").trim()]),
  ) as Partial<Record<RitaV3WorkerProvider, string>>;
  const sync = await syncRitaV3WorkerSecrets(values, privateKey);
  const providerSync = Object.fromEntries(
    stored.map((item) => {
      const ready = sync.fields.includes(RITA_V3_WORKER_SECRET_NAMES[item.provider]);
      return [
        item.provider,
        {
          synced: ready,
          pending: !ready && sync.pending,
          reason: ready ? "Ready in Pipecat." : sync.reason,
        },
      ];
    }),
  );

  return { ...sync, providerSync };
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
        const privateKey = await getStoredRitaKey(supabase, "pipecat_private");
        const sync = await syncStoredWorkerKeys(supabase, privateKey);
        const providerResult = sync.providerSync[data.provider];
        return {
          ok: true,
          ...sync,
          synced: providerResult?.synced ?? sync.synced,
          pending: providerResult?.pending ?? sync.pending,
          reason: providerResult?.reason ?? sync.reason,
        };
      } catch (cause) {
        return {
          ok: true,
          synced: false,
          pending: false,
          reason: `Saved securely, but Pipecat sync failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
          providerSync: {},
        };
      }
    }

    if (data.provider === "pipecat_private") {
      try {
        const syncResult = await syncStoredWorkerKeys(supabase, data.apiKey);
        const providerCount = Object.keys(syncResult.providerSync).length;
        if (!providerCount) {
          return {
            ok: true,
            synced: true,
            pending: false,
            reason: "Pipecat private key saved. Add the Soniox, Groq, and Google keys next.",
            providerSync: syncResult.providerSync,
          };
        }
        return {
          ok: true,
          ...syncResult,
          reason: syncResult.synced
            ? `Pipecat private key saved and ${providerCount} provider key${providerCount === 1 ? "" : "s"} synced.`
            : syncResult.reason,
        };
      } catch (cause) {
        return {
          ok: true,
          synced: false,
          pending: false,
          reason: `Pipecat key saved, but provider resync failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
          providerSync: {},
        };
      }
    }

    return {
      ok: true,
      synced: true,
      pending: false,
      reason: "Pipecat public key saved securely.",
    };
  });

export const retryRitaV3WorkerSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = await requireAdmin(context);
    const privateKey = await getStoredRitaKey(supabase, "pipecat_private");
    if (!privateKey) {
      return {
        ok: false,
        synced: false,
        pending: false,
        reason: "Add the Pipecat private key first.",
        providerSync: {},
      };
    }
    try {
      return { ok: true, ...(await syncStoredWorkerKeys(supabase, privateKey)) };
    } catch (cause) {
      return {
        ok: false,
        synced: false,
        pending: false,
        reason: cause instanceof Error ? cause.message : "Pipecat sync failed.",
        providerSync: {},
      };
    }
  });

export const deleteRitaV3Key = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ provider: z.enum(providers) }).parse(value))
  .handler(async ({ data, context }) => {
    const { supabase } = await requireAdmin(context);

    if (isWorkerProvider(data.provider)) {
      try {
        const privateKey = await getStoredRitaKey(supabase, "pipecat_private");
        await deleteRitaV3WorkerSecret(data.provider, privateKey);
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
    const { supabase } = await requireAdmin(context);
    const env = await ritaV3Environment();
    const privateKey = (await getStoredRitaKey(supabase, "pipecat_private")) || env.privateKey;
    if (!privateKey) return { ok: false, message: "Add the Pipecat private key first." };
    try {
      const readiness = await getRitaV3Readiness(privateKey);
      return {
        ...readiness,
        message: readiness.ok
          ? `${env.agentName} passed every control-plane readiness check.`
          : "Rita is not ready. Review the failed checks below.",
      };
    } catch (cause) {
      return {
        ok: false,
        message: cause instanceof Error ? cause.message : "Could not reach Pipecat.",
        checks: [],
        latestSession: null,
        latestLogError: null,
      };
    }
  });

export const runRitaV3LiveProbe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    return probeRitaV3Worker();
  });
