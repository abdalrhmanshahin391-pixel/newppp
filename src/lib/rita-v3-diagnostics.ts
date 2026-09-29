export type RitaV3StartFailure = {
  code: string;
  message: string;
  retryable: boolean;
  upstreamStatus: number;
  requestId: string | null;
};

function firstText(payload: Record<string, unknown>) {
  const nested =
    payload.error && typeof payload.error === "object"
      ? (payload.error as Record<string, unknown>)
      : null;
  return [
    payload.info,
    payload.detail,
    payload.message,
    payload.error_description,
    nested?.message,
    nested?.detail,
    typeof payload.error === "string" ? payload.error : "",
  ]
    .map((value) => String(value ?? "").trim())
    .find(Boolean);
}

export function sanitizePipecatDiagnostic(value: unknown, fallback = "") {
  const text = String(value ?? fallback)
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:AIza|gsk_|soniox_|pcc_)[A-Za-z0-9._-]{8,}\b/g, "[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text.slice(0, 600);
}

export function classifyPipecatStartFailure(
  status: number,
  payload: Record<string, unknown>,
  headers?: Headers,
): RitaV3StartFailure {
  const raw = sanitizePipecatDiagnostic(firstText(payload), `Pipecat returned HTTP ${status}.`);
  const normalized = raw.toLowerCase();
  const requestId =
    headers?.get("x-request-id") ??
    headers?.get("x-correlation-id") ??
    sanitizePipecatDiagnostic(payload.requestId ?? payload.request_id) ??
    null;

  if (status === 401 || status === 403) {
    return {
      code: "pipecat_public_key_rejected",
      message:
        "Pipecat rejected the public session key. Replace the Pipecat public key in Voice Admin.",
      retryable: false,
      upstreamStatus: status,
      requestId: requestId || null,
    };
  }
  if (status === 404 || normalized.includes("not found") || normalized.includes("does not exist")) {
    return {
      code: "agent_not_found",
      message:
        "The Pipecat agent ritajet-voice-v3 is not deployed. Provider keys alone cannot start Rita.",
      retryable: false,
      upstreamStatus: status,
      requestId: requestId || null,
    };
  }
  if (
    normalized.includes("not healthy") ||
    normalized.includes("not ready") ||
    normalized.includes("unhealthy") ||
    normalized.includes("deployment")
  ) {
    return {
      code: "agent_unhealthy",
      message: `The Rita voice worker is deployed but is not healthy yet. ${raw}`,
      retryable: true,
      upstreamStatus: status,
      requestId: requestId || null,
    };
  }
  if (
    normalized.includes("secret") ||
    normalized.includes("environment variable") ||
    normalized.includes("missing key")
  ) {
    return {
      code: "secrets_not_ready",
      message: `The deployed Rita worker is missing a required provider secret. ${raw}`,
      retryable: false,
      upstreamStatus: status,
      requestId: requestId || null,
    };
  }
  if (
    normalized.includes("model") &&
    (normalized.includes("unsupported") ||
      normalized.includes("unavailable") ||
      normalized.includes("invalid"))
  ) {
    return {
      code: "provider_model_unavailable",
      message: `A configured voice provider rejected its model. ${raw}`,
      retryable: false,
      upstreamStatus: status,
      requestId: requestId || null,
    };
  }
  if (
    normalized.includes("api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("authentication")
  ) {
    return {
      code: "provider_auth_failed",
      message: `A worker provider rejected its API key. ${raw}`,
      retryable: false,
      upstreamStatus: status,
      requestId: requestId || null,
    };
  }
  if (status === 429 || normalized.includes("capacity")) {
    return {
      code: "capacity_unavailable",
      message: "Rita's voice worker has no capacity right now. Retry in a moment.",
      retryable: true,
      upstreamStatus: status,
      requestId: requestId || null,
    };
  }
  if (status === 408 || status === 504 || normalized.includes("timeout")) {
    return {
      code: "cold_start_timeout",
      message:
        "Rita's voice worker took too long to wake up. Retry once; if it repeats, check the deployment logs.",
      retryable: true,
      upstreamStatus: status,
      requestId: requestId || null,
    };
  }
  return {
    code: status >= 500 ? "pipecat_start_failed" : "pipecat_request_rejected",
    message: `Pipecat could not start Rita. ${raw}`,
    retryable: status >= 500,
    upstreamStatus: status,
    requestId: requestId || null,
  };
}
