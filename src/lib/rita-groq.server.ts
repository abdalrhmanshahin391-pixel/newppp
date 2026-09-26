/* eslint-disable @typescript-eslint/no-explicit-any -- admin_ai_keys is managed outside generated types. */
export const DEFAULT_RITA_GROQ_MODEL = "llama-3.3-70b-versatile";
export const RITA_GROQ_FAST_MODEL = "llama-3.1-8b-instant";
export const RITA_GROQ_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "qwen/qwen3-32b",
];
/** Models Groq has shut down; a saved value from this list is ignored. */
const RETIRED_GROQ_MODELS = new Set([
  "mistral-saba-24b",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "qwen-qwq-32b",
  "deepseek-r1-distill-llama-70b",
]);

export function usableRitaGroqModel(model: string | null | undefined) {
  const clean = String(model ?? "").trim();
  return clean && !RETIRED_GROQ_MODELS.has(clean) ? clean : DEFAULT_RITA_GROQ_MODEL;
}

export function isRetiredModelError(status: number, detail: string) {
  return (
    (status === 400 || status === 404) &&
    /decommission|model_not_found|does not exist|no longer supported/i.test(detail)
  );
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
