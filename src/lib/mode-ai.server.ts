// Per-mode AI key resolution.
//
// Every upload mode can either use the shared Lovable AI gateway (default) or
// the owner's own Google AI Studio key saved for that mode in admin_ai_keys
// (purpose = 'aio' | 'rita' | 'lecture' | 'questions'). Google's
// OpenAI-compatible endpoint is used so the request body stays identical.

export type AiPurpose = "aio" | "rita" | "lecture" | "questions";

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const GATEWAY_MODEL = "google/gemini-3.6-flash";
export const GOOGLE_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const GOOGLE_DEFAULT_MODEL = "gemini-flash-latest";

export type ChatTarget = {
  url: string;
  key: string;
  model: string;
  /** true when the owner's own key is being used for this mode */
  own: boolean;
};

/** Read the owner key saved for one mode (falls back to the shared row). */
export async function readModeKey(
  supabase: any,
  purpose: AiPurpose,
): Promise<{ key: string; model: string | null } | null> {
  try {
    const { data } = await supabase
      .from("admin_ai_keys")
      .select("api_key, preferred_model, purpose, slot")
      .eq("provider", "gemini")
      .in("purpose", [purpose, "shared"])
      .order("slot", { ascending: true });
    const rows = (data ?? []) as {
      api_key: string | null;
      preferred_model: string | null;
      purpose: string;
    }[];
    const usable = rows.filter((r) => String(r.api_key ?? "").trim().length > 10);
    const mine = usable.find((r) => r.purpose === purpose);
    const row = mine ?? null;
    if (!row) return null;
    return { key: String(row.api_key).trim(), model: row.preferred_model ?? null };
  } catch {
    return null;
  }
}

/** Where a mode should send its chat request right now (one shared resolver). */
export async function resolveChatTarget(
  supabase: any,
  purpose: AiPurpose,
): Promise<ChatTarget> {
  const { resolveAiTarget } = await import("@/lib/ai-engine.server");
  const target = await resolveAiTarget(supabase, purpose);
  return { url: target.url, key: target.key, model: target.model, own: target.source === "own" };
}

/** One cheap call used by the admin “Test key” button. */
export async function pingChatKey(
  key: string,
  model?: string | null,
): Promise<{ ok: boolean; message: string }> {
  const trimmed = key.trim();
  if (!trimmed.startsWith("AIza")) {
    return {
      ok: false,
      message:
        "This does not look like a Google AI Studio key. Those start with AIza — grab one from aistudio.google.com/apikey.",
    };
  }
  try {
    const res = await fetch(GOOGLE_OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${trimmed}` },
      body: JSON.stringify({
        model: model?.trim() || GOOGLE_DEFAULT_MODEL,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        max_tokens: 5,
      }),
    });
    if (res.ok) return { ok: true, message: "Working — this key answered straight away." };
    const body = await res.text();
    if (res.status === 401 || res.status === 403)
      return { ok: false, message: "Google rejected this key (not valid or not enabled)." };
    if (res.status === 429)
      return { ok: false, message: "The key works but is rate limited right now — try again in a minute." };
    return { ok: false, message: `Google replied with error ${res.status}: ${body.slice(0, 160)}` };
  } catch (e: any) {
    return { ok: false, message: `Could not reach Google: ${String(e?.message ?? e).slice(0, 160)}` };
  }
}
