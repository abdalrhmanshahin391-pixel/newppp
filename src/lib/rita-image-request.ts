// Pure rules for the private image endpoint (/api/admin/generate-image):
// what a request may ask for, how the caller's token is read, and the hourly and
// daily caps that keep one leaked token from running up the OpenAI bill.

export const IMAGE_SIZES = ["1024x1024", "1536x1024", "1024x1536"] as const;
export const IMAGE_QUALITIES = ["medium", "high"] as const;
export const IMAGE_STYLES = ["raw", "lesson"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export type ImageRequest = {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  style: ImageStyle;
  save: boolean;
};

export const MIN_TOKEN_LENGTH = 32;
export const MAX_PROMPT_CHARS = 1000;
export const MIN_PROMPT_CHARS = 3;

export const IMAGE_LIMITS = { perHour: 20, perDay: 100, concurrent: 2 } as const;

/** The token from "Authorization: Bearer …"; empty when the header is missing or malformed. */
export function bearerToken(header: string | null | undefined): string {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(String(header ?? ""));
  return match ? match[1] : "";
}

/** A configured token must be long enough to be a real secret; anything shorter keeps the door shut. */
export function tokenIsUsable(configured: string | null | undefined): boolean {
  return String(configured ?? "").trim().length >= MIN_TOKEN_LENGTH;
}

export type ParsedImageRequest = { ok: true; value: ImageRequest } | { ok: false; error: string };

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T | null {
  if (value === undefined || value === null || value === "") return fallback;
  return allowed.includes(value as T) ? (value as T) : null;
}

/** Validates the JSON body; the error text is safe to send back to the caller. */
export function parseImageRequest(body: unknown): ParsedImageRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send a JSON object with a prompt." };
  }
  const input = body as Record<string, unknown>;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (prompt.length < MIN_PROMPT_CHARS) {
    return { ok: false, error: `prompt must be at least ${MIN_PROMPT_CHARS} characters.` };
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return { ok: false, error: `prompt must be at most ${MAX_PROMPT_CHARS} characters.` };
  }
  const size = pick(input.size, IMAGE_SIZES, "1024x1024");
  if (!size) return { ok: false, error: `size must be one of ${IMAGE_SIZES.join(", ")}.` };
  const quality = pick(input.quality, IMAGE_QUALITIES, "medium");
  if (!quality)
    return { ok: false, error: `quality must be one of ${IMAGE_QUALITIES.join(", ")}.` };
  const style = pick(input.style, IMAGE_STYLES, "raw");
  if (!style) return { ok: false, error: `style must be one of ${IMAGE_STYLES.join(", ")}.` };
  if (input.save !== undefined && typeof input.save !== "boolean") {
    return { ok: false, error: "save must be true or false." };
  }
  return { ok: true, value: { prompt, size, quality, style, save: input.save === true } };
}

export type UsageDecision =
  { allowed: true } | { allowed: false; reason: string; retryAfterSecs: number };

/** Caps by recent usage. `hour` and `day` count images already made in the last 60 minutes and 24 hours. */
export function checkUsage(usage: { hour: number; day: number; running: number }): UsageDecision {
  if (usage.running >= IMAGE_LIMITS.concurrent) {
    return {
      allowed: false,
      reason: `Only ${IMAGE_LIMITS.concurrent} images can be made at the same time; try again in a minute.`,
      retryAfterSecs: 60,
    };
  }
  if (usage.hour >= IMAGE_LIMITS.perHour) {
    return {
      allowed: false,
      reason: `Hourly limit reached (${IMAGE_LIMITS.perHour} images per hour).`,
      retryAfterSecs: 3600,
    };
  }
  if (usage.day >= IMAGE_LIMITS.perDay) {
    return {
      allowed: false,
      reason: `Daily limit reached (${IMAGE_LIMITS.perDay} images per day).`,
      retryAfterSecs: 86_400,
    };
  }
  return { allowed: true };
}

/** Short, single-line preview for the usage log (never the whole prompt). */
export function promptPreview(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 120);
}
