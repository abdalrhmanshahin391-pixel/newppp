/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireRitaUser, getRitaAllowance, getRitaSettings } from "@/lib/rita-voice.server";
import { classifyPipecatStartFailure, sanitizePipecatDiagnostic } from "@/lib/rita-v3-diagnostics";

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

export type RitaV3ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  message: string;
};

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

function agentList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(Boolean) as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["agents", "services", "items", "data"]) {
    if (Array.isArray(record[key])) return record[key] as Record<string, unknown>[];
  }
  return [];
}

function agentName(agent: Record<string, unknown>) {
  return String(agent.name ?? agent.agentName ?? agent.agent_name ?? "").trim();
}

function agentHealth(agent: Record<string, unknown>) {
  for (const key of ["status", "state", "health", "healthStatus", "deploymentStatus"]) {
    const value = agent[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      const nestedValue = nested.status ?? nested.state ?? nested.condition;
      if (typeof nestedValue === "string" && nestedValue.trim()) return nestedValue.trim();
    }
  }
  return "visible";
}

async function privatePipecatJson(privateKey: string, path: string) {
  const response = await fetch(`https://api.pipecat.daily.co/v1${path}`, {
    headers: { Authorization: `Bearer ${privateKey}` },
    signal: AbortSignal.timeout(12_000),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { response, payload };
}

export async function getRitaV3Readiness(privateKeyOverride?: string) {
  const env = await ritaV3Environment();
  const privateKey = String(privateKeyOverride ?? env.privateKey).trim();
  const checks: RitaV3ReadinessCheck[] = [];
  if (!privateKey) {
    return {
      ok: false,
      checks: [
        {
          id: "private_key",
          label: "Pipecat private key",
          ok: false,
          message: "Not configured.",
        },
      ],
      latestSession: null,
      latestLogError: null,
    };
  }

  const [secrets, agentsResult] = await Promise.all([
    readRitaV3WorkerSecretStatus(privateKey),
    privatePipecatJson(privateKey, "/agents").catch(() => null),
  ]);
  checks.push({
    id: "private_key",
    label: "Pipecat private key",
    ok: Boolean(agentsResult?.response.ok),
    message: agentsResult?.response.ok
      ? "Accepted by the Pipecat control plane."
      : agentsResult
        ? `Rejected or unavailable (HTTP ${agentsResult.response.status}).`
        : "Pipecat control plane could not be reached.",
  });

  const requiredFields = Object.values(RITA_V3_WORKER_SECRET_NAMES);
  const missingFields = requiredFields.filter((field) => !secrets.fields.includes(field));
  checks.push({
    id: "secret_set",
    label: "Worker provider secrets",
    ok: secrets.status === "ready" && missingFields.length === 0,
    message:
      secrets.status === "ready" && missingFields.length === 0
        ? `Soniox, Groq, and Google are present in ${RITA_V3_SECRET_SET}.`
        : missingFields.length
          ? `Missing from Pipecat: ${missingFields.join(", ")}.`
          : `Secret set status: ${secrets.status}.`,
  });
  checks.push({
    id: "region",
    label: "Pipecat region",
    ok: secrets.region === RITA_V3_REGION,
    message: secrets.region
      ? `${secrets.region}${secrets.region === RITA_V3_REGION ? " (correct)" : `; expected ${RITA_V3_REGION}`}.`
      : "The worker secret region could not be confirmed.",
  });

  const agents = agentsResult?.response.ok ? agentList(agentsResult.payload) : [];
  const agent = agents.find((item) => agentName(item) === env.agentName);
  const health = agent ? agentHealth(agent) : "missing";
  const unhealthy = /failed|error|unhealthy|not.?ready|inactive/i.test(health);
  checks.push({
    id: "agent",
    label: "Rita voice worker",
    ok: Boolean(agent) && !unhealthy,
    message: agent
      ? `${env.agentName} is visible; reported state: ${sanitizePipecatDiagnostic(health)}.`
      : `${env.agentName} is not deployed in this Pipecat organization.`,
  });

  let latestSession: { id: string; status: string } | null = null;
  let latestLogError: string | null = null;
  if (agent) {
    const [sessionsResult, logsResult] = await Promise.all([
      privatePipecatJson(
        privateKey,
        `/agents/${encodeURIComponent(env.agentName)}/sessions?limit=5`,
      ),
      privatePipecatJson(
        privateKey,
        `/agents/${encodeURIComponent(env.agentName)}/logs?limit=50&order=desc`,
      ),
    ]).catch(() => [null, null] as const);
    const sessions = Array.isArray(sessionsResult?.payload.sessions)
      ? (sessionsResult.payload.sessions as Record<string, unknown>[])
      : [];
    const latest = sessions[0];
    latestSession = latest
      ? { id: String(latest.id ?? ""), status: String(latest.status ?? latest.state ?? "unknown") }
      : null;
    const logs = Array.isArray(logsResult?.payload.logs)
      ? (logsResult.payload.logs as Record<string, unknown>[])
      : [];
    const errorLog = logs.find((item) =>
      /error|exception|traceback|failed|missing|unauthorized/i.test(String(item.log ?? "")),
    );
    latestLogError = errorLog
      ? sanitizePipecatDiagnostic(errorLog.log, "Pipecat worker error")
      : null;
  }

  checks.push({
    id: "runtime_logs",
    label: "Recent worker logs",
    ok: Boolean(agent) && !latestLogError,
    message: !agent
      ? "No worker exists, so runtime logs are unavailable."
      : latestLogError
        ? latestLogError
        : "No recent worker error was found.",
  });
  return {
    ok: checks.every((check) => check.ok),
    checks,
    latestSession,
    latestLogError,
  };
}

export async function probeRitaV3Worker() {
  const env = await ritaV3Environment();
  if (!env.publicKey || !env.privateKey) {
    return {
      ok: false,
      code: "pipecat_keys_missing",
      message: "Both Pipecat public and private keys are required for a live probe.",
      retryable: false,
    };
  }
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(
      `https://api.pipecat.daily.co/v1/public/${encodeURIComponent(env.agentName)}/start`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.publicKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          createDailyRoom: true,
          body: {
            appSessionId: crypto.randomUUID(),
            personality: "kind",
            language: "en",
            dialect: "en-GB",
            mode: "diagnostic_probe",
            diagnostic: true,
          },
        }),
        signal: controller.signal,
      },
    );
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || !payload.dailyRoom || !payload.dailyToken) {
      return {
        ok: false,
        ...classifyPipecatStartFailure(response.status, payload, response.headers),
      };
    }
    const providerSessionId = String(payload.sessionId ?? payload.id ?? "").trim();
    let cleanupOk = false;
    if (providerSessionId) {
      const cleanup = await fetch(
        `https://api.pipecat.daily.co/v1/agents/${encodeURIComponent(env.agentName)}/sessions/${encodeURIComponent(providerSessionId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${env.privateKey}` },
          signal: AbortSignal.timeout(12_000),
        },
      ).catch(() => null);
      cleanupOk = Boolean(cleanup?.ok || cleanup?.status === 404);
    }
    return {
      ok: true,
      code: "probe_started",
      message: cleanupOk
        ? "Pipecat started and stopped a real Rita worker session successfully."
        : "Pipecat started a real Rita session, but automatic probe cleanup could not be confirmed.",
      startupMs: Date.now() - startedAt,
      cleanupOk,
    };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      code: timedOut ? "cold_start_timeout" : "pipecat_network_error",
      message: timedOut
        ? "The Rita worker did not start within 45 seconds."
        : "The live Pipecat probe could not reach the worker.",
      retryable: true,
    };
  } finally {
    clearTimeout(timeout);
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
  traceId?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin.from as any)("rita_v3_sessions")
    .insert({
      user_id: args.userId,
      personality: args.personality,
      language_preference: args.language,
      dialect_preference: args.dialect,
      status: "starting",
      diagnostic_trace_id: args.traceId ?? null,
      model_proof: {
        ...RITA_V3_MODELS,
        ...(args.traceId ? { diagnosticTraceId: args.traceId } : {}),
      },
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
