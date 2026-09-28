/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireRitaUser, getRitaAllowance, getRitaSettings } from "@/lib/rita-voice.server";

export const RITA_V3_MODELS = {
  transport: "Daily WebRTC 1:1 voice",
  transcription: "Soniox stt-rt-v5",
  response: "Groq openai/gpt-oss-120b",
  speech: "Gemini 3.8 Flash-Lite TTS",
  voice: "Achernar",
} as const;

export const RITA_V3_AGENT = "ritajet-voice-v3";
export const RITA_V3_SECRET_SET = "ritajet-voice-v3-secrets";
export const RITA_V3_REGION = "eu-central";

const WORKER_SECRET_NAMES = {
  soniox: "SONIOX_API_KEY",
  groq: "GROQ_API_KEY",
  google: "GOOGLE_API_KEY",
} as const;

export type RitaV3Auth = NonNullable<Awaited<ReturnType<typeof requireRitaUser>>>;

export async function resolveRitaV3Key(provider: string, environmentName: string) {
  const fromEnvironment = String(process.env[environmentName] ?? "").trim();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin.from as any)("admin_ai_keys")
      .select("api_key")
      .eq("provider", provider)
      .eq("purpose", "rita")
      .eq("slot", 1)
      .maybeSingle();
    const saved = String(data?.api_key ?? "").trim();
    if (saved) return saved;
  } catch (error) {
    console.warn(`Could not read Rita v3 ${provider} key`, error);
  }
  return fromEnvironment;
}

export async function ritaV3Environment() {
  return {
    publicKey: await resolveRitaV3Key("pipecat_public", "PIPECAT_PUBLIC_API_KEY"),
    privateKey: await resolveRitaV3Key("pipecat_private", "PIPECAT_PRIVATE_API_KEY"),
    agentName: String(process.env["PIPECAT_AGENT_NAME"] ?? RITA_V3_AGENT).trim(),
  };
}

export async function syncRitaV3WorkerSecret(
  provider: keyof typeof WORKER_SECRET_NAMES,
  secretValue: string,
) {
  const env = await ritaV3Environment();
  if (!env.privateKey) {
    return { synced: false, reason: "Add the Pipecat private key before syncing worker secrets." };
  }
  const response = await fetch(
    `https://api.pipecat.daily.co/v1/secrets/${RITA_V3_SECRET_SET}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.privateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secrets: [{ secretKey: WORKER_SECRET_NAMES[provider], secretValue }],
        region: RITA_V3_REGION,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`Pipecat secret sync failed (${response.status}).`);
  return { synced: true, reason: "Worker secret accepted; redeploy Rita after it becomes ready." };
}

export async function deleteRitaV3WorkerSecret(provider: keyof typeof WORKER_SECRET_NAMES) {
  const env = await ritaV3Environment();
  if (!env.privateKey) return false;
  const response = await fetch(
    `https://api.pipecat.daily.co/v1/secrets/${RITA_V3_SECRET_SET}/${WORKER_SECRET_NAMES[provider]}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${env.privateKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  return response.ok || response.status === 404;
}

export async function getRitaV3WorkerSecretStatus() {
  const env = await ritaV3Environment();
  if (!env.privateKey) {
    return { status: "not-connected", region: null, fields: [] as string[] };
  }
  try {
    const response = await fetch(
      `https://api.pipecat.daily.co/v1/secrets/${RITA_V3_SECRET_SET}`,
      {
        headers: { Authorization: `Bearer ${env.privateKey}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (response.status === 404) {
      return { status: "missing", region: null, fields: [] as string[] };
    }
    if (!response.ok) {
      return { status: `error-${response.status}`, region: null, fields: [] as string[] };
    }
    const payload = (await response.json()) as {
      status?: string;
      region?: string;
      secrets?: { fieldName?: string }[];
    };
    return {
      status: payload.status ?? "unknown",
      region: payload.region ?? null,
      fields: (payload.secrets ?? []).flatMap((item) => item.fieldName ? [item.fieldName] : []),
    };
  } catch {
    return { status: "unreachable", region: null, fields: [] as string[] };
  }
}

export async function requireRitaV3Access(request: Request) {
  const auth = await requireRitaUser(request);
  if (!auth) return { ok: false as const, response: new Response("Unauthorized", { status: 401 }) };
  const settings = await getRitaSettings();
  const allowance = await getRitaAllowance(auth.userId, settings);
  if (!settings.enabled || !allowance.allowed) {
    return {
      ok: false as const,
      response: Response.json(
        {
          ok: false,
          code: allowance.reason,
          message: "Rita voice is unavailable because its usage safety limit has been reached.",
        },
        { status: 429 },
      ),
    };
  }
  return { ok: true as const, auth, allowance };
}

export async function persistRitaV3Session(args: {
  userId: string;
  personality: string;
  language: string;
  dialect: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin.from as any)("rita_v3_sessions")
    .insert({
      user_id: args.userId,
      personality: args.personality,
      language_preference: args.language,
      dialect_preference: args.dialect,
      status: "starting",
      model_proof: RITA_V3_MODELS,
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(error?.message || "Could not create Rita v3 session");
  return String(data.id);
}

export async function updateRitaV3Session(
  sessionId: string,
  userId: string,
  patch: Record<string, unknown>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin.from as any)("rita_v3_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function recordRitaV3Event(args: {
  sessionId: string;
  userId: string;
  name: string;
  valueMs?: number;
  metadata?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin.from as any)("rita_v3_events").insert({
    session_id: args.sessionId,
    user_id: args.userId,
    event_name: args.name,
    value_ms: args.valueMs === undefined ? null : Math.round(args.valueMs),
    metadata: args.metadata ?? {},
  });
  if (error) throw error;
}
