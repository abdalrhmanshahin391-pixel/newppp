/* eslint-disable @typescript-eslint/no-explicit-any -- admin_ai_keys is managed outside generated types. */
// All models below run on Groq with the Groq key (gpt-oss is an open model hosted by Groq).
export const DEFAULT_RITA_GROQ_MODEL = "qwen/qwen3.8-27b";
export const RITA_GROQ_FAST_MODEL = "qwen/qwen3.8-27b";
export const RITA_GROQ_DETAILED_MODEL = "openai/gpt-oss-120b";
export const RITA_GROQ_FALLBACK_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "allam-2-7b",
];
const KNOWN_GOOD = new Set(RITA_GROQ_FALLBACK_MODELS);

/** Only models verified to work are accepted; anything else (retired Llama/Mistral…) is ignored. */
export function usableRitaGroqModel(model: string | null | undefined) {
  const clean = String(model ?? "").trim();
  return KNOWN_GOOD.has(clean) ? clean : DEFAULT_RITA_GROQ_MODEL;
}

export function isRetiredModelError(status: number, detail: string) {
  return (
    (status === 400 || status === 404) &&
    /decommission|model_not_found|does not exist|no longer supported/i.test(detail)
  );
}

/** Extra request fields that hide internal "thinking" so speech starts fast. */
export function ritaGroqReasoningFields(model: string): Record<string, unknown> {
  if (model.startsWith("qwen/")) return { reasoning_effort: "none" };
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: "low", include_reasoning: false };
  return {};
}

let modelCache: { at: number; ids: Set<string> } | null = null;
/** Models this key can actually use (cached 10 minutes). Null when the list can't be read. */
export async function listRitaGroqModels(key: string): Promise<Set<string> | null> {
  if (modelCache && Date.now() - modelCache.at < 600_000) return modelCache.ids;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const ids = new Set<string>((json?.data ?? []).map((m: any) => String(m.id)));
    modelCache = { at: Date.now(), ids };
    return ids;
  } catch {
    return null;
  }
}

/** Ordered list of models to try: preferred first, then fallbacks, filtered to what the key has. */
export async function ritaGroqModelChain(key: string, preferred: string) {
  const chain = [preferred, ...RITA_GROQ_FALLBACK_MODELS.filter((m) => m !== preferred)];
  const available = await listRitaGroqModels(key);
  if (!available) return chain;
  const filtered = chain.filter((m) => available.has(m));
  return filtered.length ? filtered : chain;
}

export async function resolveRitaGroqConfig() {
  const environmentKey = (process.env["GROQ_API_KEY"] ?? "").trim();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const purpose of ["rita", "shared"]) {
      const { data } = await (supabaseAdmin.from as any)("admin_ai_keys")
        .select("api_key,preferred_model")
        .eq("provider", "groq")
        .eq("purpose", purpose)
        .eq("slot", 1)
        .maybeSingle();
      const key = String(data?.api_key ?? "").trim();
      if (key.length > 20) {
        void listRitaGroqModels(key);
        return { key, model: usableRitaGroqModel(data?.preferred_model) };
      }
    }
  } catch (error) {
    console.warn("Rita could not read its Groq key", error);
  }
  return environmentKey.length > 20
    ? { key: environmentKey, model: DEFAULT_RITA_GROQ_MODEL }
    : null;
}
