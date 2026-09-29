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

export const RITA_V3_WORKER_SECRET_NAMES = {
  soniox: "SONIOX_API_KEY",
  groq: "GROQ_API_KEY",
  google: "GOOGLE_API_KEY",
} as const;

export type RitaV3WorkerProvider = keyof typeof RITA_V3_WORKER_SECRET_NAMES;

export type RitaV3WorkerSecretStatus = {
  status: string;
  region: string | null;
  fields: string[];
};

export type RitaV3Auth = NonNullable<Awaited<ReturnType<typeof requireRitaUser>>>;

export async function resolveRitaV3Key(provider: string, environmentName: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin.from as any)("admin_ai_keys")
      .select("api_key")
      .eq("provider", provider)
      .eq("purpose", "rita")
      .eq("slot", 1)
      .maybeSingle();
    if (error) throw error;
    const saved = String(data?.api_key ?? "").trim();
    if (saved) return saved;
  } catch (error) {
    console.warn(`Could not read Rita v3 ${provider} key`, error);
  }

  return String(process.env[environmentName] ?? "").trim();
}

export async function ritaV3Environment() {
  return {
    publicKey: await resolveRitaV3Key("pipecat_public", "PIPECAT_PUBLIC_API_KEY"),
    privateKey: await resolveRitaV3Key("pipecat_private", "PIPECAT_PRIVATE_API_KEY"),
    agentName: String(process.env["PIPECAT_AGENT_NAME"] ?? RITA_V3_AGENT).trim(),
  };
}

export async function syncRitaV3WorkerSecret(
  provider: RitaV3WorkerProvider,
  secretValue: string,
  privateKey?: string,
) {
  return syncRitaV3WorkerSecrets({ [provider]: secretValue }, privateKey);
}

async function readRitaV3WorkerSecretStatus(privateKey: string): Promise<RitaV3WorkerSecretStatus> {
  try {
    const response = await fetch(`https://api.pipecat.daily.co/v1/secrets/${RITA_V3_SECRET_SET}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 404) {
      return { status: "missing", region: null, fields: [] };
    }
    if (!response.ok) {
      return { status: `error-${response.status}`, region: null, fields: [] };
    }
    const payload = (await response.json()) as {
      status?: string;
      region?: string;
      secrets?: { fieldName?: string }[];
    };
    return {
      status: payload.status ?? "ready",
      region: payload.region ?? null,
      fields: (payload.secrets ?? []).flatMap((item) => (item.fieldName ? [item.fieldName] : [])),
    };
  } catch {
    return { status: "unreachable", region: null, fields: [] };
  }
}

export async function syncRitaV3WorkerSecrets(
  values: Partial<Record<RitaV3WorkerProvider, string>>,
  privateKeyOverride?: string,
) {
  const privateKey =
    privateKeyOverride === undefined
      ? (await ritaV3Environment()).privateKey
      : String(privateKeyOverride).trim();
  if (!privateKey) {
    return {
      synced: false,
      pending: false,
      reason: "Add the Pipecat private key before syncing worker secrets.",
      status: "not-connected",
      fields: [] as string[],
    };
  }

  const entries = (Object.entries(values) as [RitaV3WorkerProvider, string][]).filter(([, value]) =>
    Boolean(String(value ?? "").trim()),
  );
  if (!entries.length) {
    return {
      synced: true,
      pending: false,
      reason: "No provider keys are waiting to be synced.",
      status: "ready",
      fields: [] as string[],
    };
  }

  const before = await readRitaV3WorkerSecretStatus(privateKey);
  if (before.status.startsWith("error-")) {
    throw new Error(`Pipecat private key was rejected (${before.status.slice(6)}).`);
  }
  if (before.status === "unreachable") {
    throw new Error("Pipecat could not be reached.");
  }

  const region = before.region ?? RITA_V3_REGION;
  const response = await fetch(`https://api.pipecat.daily.co/v1/secrets/${RITA_V3_SECRET_SET}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${privateKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secrets: entries.map(([provider, secretValue]) => ({
        secretKey: RITA_V3_WORKER_SECRET_NAMES[provider],
        secretValue: secretValue.trim(),
      })),
      region,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Pipecat secret sync failed (${response.status}).`);
  }

  const expectedFields = entries.map(([provider]) => RITA_V3_WORKER_SECRET_NAMES[provider]);
  let latest = before;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    latest = await readRitaV3WorkerSecretStatus(privateKey);
    if (
      latest.status === "ready" &&
      expectedFields.every((fieldName) => latest.fields.includes(fieldName))
    ) {
      return {
        synced: true,
        pending: false,
        reason: "Worker secrets are ready in Pipecat. Redeploy Rita to use replacement values.",
        status: latest.status,
        fields: latest.fields,
      };
    }
  }

  return {
    synced: false,
    pending: true,
    reason: "Pipecat accepted the keys and is still preparing them. Refresh or retry shortly.",
    status: latest.status,
    fields: latest.fields,
  };
}

export async function deleteRitaV3WorkerSecret(
  provider: RitaV3WorkerProvider,
  privateKeyOverride?: string,
) {
  const privateKey =
    privateKeyOverride === undefined
      ? (await ritaV3Environment()).privateKey
      : String(privateKeyOverride).trim();
  if (!privateKey) return false;
  const response = await fetch(
    `https://api.pipecat.daily.co/v1/secrets/${RITA_V3_SECRET_SET}/${RITA_V3_WORKER_SECRET_NAMES[provider]}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${privateKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  return response.ok || response.status === 404;
}

export async function getRitaV3WorkerSecretStatus(privateKeyOverride?: string) {
  const privateKey =
    privateKeyOverride === undefined
      ? (await ritaV3Environment()).privateKey
      : String(privateKeyOverride).trim();
  if (!privateKey) {
    return { status: "not-connected", region: null, fields: [] as string[] };
  }
  return readRitaV3WorkerSecretStatus(privateKey);
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
