export type RitaErrorPayload = {
  code?: string;
  error?: string;
  message?: string;
  retryable?: boolean;
  traceId?: string;
};

const BODY_STATE_ERROR = /body.*(?:disturbed|locked|unusable|already been read)/i;

export class RitaApiError extends Error {
  code: string;
  retryable: boolean;
  traceId: string;

  constructor(message: string, payload: RitaErrorPayload = {}) {
    super(message);
    this.name = "RitaApiError";
    this.code = String(payload.code || "request_failed");
    this.retryable = payload.retryable !== false;
    this.traceId = String(payload.traceId || "");
  }
}

/** Consume an HTTP response body once. This is important on Safari/WebKit. */
export async function readRitaPayload<T = RitaErrorPayload>(response: Response): Promise<T | null> {
  let text = "";
  try {
    text = await response.text();
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    return null;
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: text.trim() } as T;
  }
}

export function ritaApiError(payload: RitaErrorPayload | null, fallback: string): RitaApiError {
  const candidate = String(payload?.error || payload?.message || "").trim();
  const message = candidate && !BODY_STATE_ERROR.test(candidate) ? candidate : fallback;
  return new RitaApiError(message, payload || {});
}

export function parseServerTiming(value: string | null) {
  const timings: Record<string, number> = {};
  for (const part of String(value || "").split(",")) {
    const match = part.trim().match(/^([a-z][a-z0-9_-]*)\s*;\s*dur=([0-9.]+)/i);
    if (!match) continue;
    const duration = Number(match[2]);
    if (Number.isFinite(duration)) timings[match[1]] = duration;
  }
  return timings;
}
