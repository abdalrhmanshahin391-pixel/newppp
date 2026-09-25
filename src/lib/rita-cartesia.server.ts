// Server-only: Cartesia text-to-speech for Rita (Layan voice, Sonic 3).
export const CARTESIA_DEFAULT_VOICE = "64a941ac-07ac-462c-a81c-008e353dd83e"; // Layan - Clarity Provider
export const CARTESIA_DEFAULT_MODEL = "sonic-3";

export async function loadRitaCartesiaKey(): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const purpose of ["rita", "shared"]) {
      const { data } = await (supabaseAdmin.from as any)("admin_ai_keys")
        .select("api_key")
        .eq("provider", "cartesia")
        .eq("purpose", purpose)
        .eq("slot", 1)
        .maybeSingle();
      const saved = String(data?.api_key ?? "").trim();
      if (saved.length > 20) return saved;
    }
  } catch (error) {
    console.warn("Rita could not read its Cartesia key", error);
  }
  const env = (process.env["CARTESIA_API_KEY"] ?? "").trim();
  return env.length > 20 ? env : null;
}

/** Returns raw 24 kHz 16-bit PCM (what Rita's player expects). Price is per character, not per kHz. */
export function cartesiaSpeech(args: {
  key: string;
  text: string;
  voiceId: string;
  model: string;
  language?: string;
  signal?: AbortSignal;
}) {
  const lang = /[\u0600-\u06FF]/.test(args.text) ? "ar" : (args.language || "ar").slice(0, 2).toLowerCase();
  return fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "Cartesia-Version": "2025-04-16",
      "X-API-Key": args.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: args.model || CARTESIA_DEFAULT_MODEL,
      transcript: args.text,
      voice: { mode: "id", id: args.voiceId || CARTESIA_DEFAULT_VOICE },
      language: lang,
      output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: 24000 },
    }),
    signal: args.signal,
  });
}
