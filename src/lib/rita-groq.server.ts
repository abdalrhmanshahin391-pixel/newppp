/* eslint-disable @typescript-eslint/no-explicit-any -- admin_ai_keys is managed outside generated types. */
export const DEFAULT_RITA_GROQ_MODEL = "mistral-saba-24b";

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
        return {
          key,
          model: String(data?.preferred_model || DEFAULT_RITA_GROQ_MODEL),
        };
      }
    }
  } catch (error) {
    console.warn("Rita could not read its Groq key", error);
  }
  return environmentKey.length > 20
    ? { key: environmentKey, model: DEFAULT_RITA_GROQ_MODEL }
    : null;
}
