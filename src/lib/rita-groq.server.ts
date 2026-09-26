/* eslint-disable @typescript-eslint/no-explicit-any -- admin_ai_keys is managed outside generated types. */
// Rita uses exactly one model on Groq: the fastest one. No fallbacks by design.
export const RITA_GROQ_MODEL = "openai/gpt-oss-20b";
export const DEFAULT_RITA_GROQ_MODEL = RITA_GROQ_MODEL;

/** Hide internal "thinking" so speech starts fast. */
export function ritaGroqReasoningFields(_model: string = RITA_GROQ_MODEL): Record<string, unknown> {
  return { reasoning_effort: "low", include_reasoning: false };
}

export async function resolveRitaGroqConfig() {
  const environmentKey = (process.env["GROQ_API_KEY"] ?? "").trim();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const purpose of ["rita", "shared"]) {
      const { data } = await (supabaseAdmin.from as any)("admin_ai_keys")
        .select("api_key")
        .eq("provider", "groq")
        .eq("purpose", purpose)
        .eq("slot", 1)
        .maybeSingle();
      const key = String(data?.api_key ?? "").trim();
      if (key.length > 20) return { key, model: RITA_GROQ_MODEL };
    }
  } catch (error) {
    console.warn("Rita could not read its Groq key", error);
  }
  return environmentKey.length > 20 ? { key: environmentKey, model: RITA_GROQ_MODEL } : null;
}
