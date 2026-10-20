import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import { ttsPlan, type PronounceStyle } from "@/lib/rita-phrase";

const MAX_TTS_CHARS = 240;

export const Route = createFileRoute("/api/german/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Signed-in users only — this route spends the site's paid AI budget.
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token || token.split(".").length !== 3) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { url, publishableKey } = getSupabasePublicConfig();
        const supabase = createClient(url, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: { text?: string; rate?: number; lang?: string; style?: string } = {};
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid request", { status: 400 });
        }

        const text = String(payload.text ?? "")
          .trim()
          .slice(0, MAX_TTS_CHARS);
        if (!text) return new Response("Text required", { status: 400 });

        const { lovableAiKey } = await import("@/lib/lovable-ai-key.server");
        const providers: { url: string; key: string }[] = [];
        const lovableKey = await lovableAiKey();
        if (lovableKey) {
          providers.push({
            url: "https://ai.gateway.lovable.dev/v1/audio/speech",
            key: lovableKey,
          });
        }
        try {
          const { resolveRitaOpenAiKey } = await import("@/lib/rita-voice.server");
          const openAiKey = await resolveRitaOpenAiKey();
          if (openAiKey)
            providers.push({ url: "https://api.openai.com/v1/audio/speech", key: openAiKey });
        } catch {
          /* no second provider */
        }
        if (!providers.length)
          return new Response("High-quality voice is unavailable", { status: 503 });

        // The "tap a word" window asks for a language and a style (fast, slow,
        // precise); older callers send only a rate and keep the German voice.
        const style = ["fast", "slow", "precise"].includes(String(payload.style))
          ? (payload.style as PronounceStyle)
          : null;
        const lang = payload.lang === "en" ? "en" : "de";
        const plan = style ? ttsPlan(lang, style, text) : null;
        const speed = plan
          ? plan.speed
          : Math.max(0.65, Math.min(1.05, Number(payload.rate ?? 0.92)));
        const spoken = plan ? plan.input : text;
        const instructions =
          plan?.instructions ??
          "Speak as a calm native German woman from Germany. Clear standard Hochdeutsch accent, warm classroom tone, crisp consonants, natural short pauses, no English accent.";

        try {
          let lastStatus = 502;
          for (const provider of providers) {
            const response = await fetch(provider.url, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${provider.key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: provider.url.includes("api.openai.com")
                  ? "gpt-4o-mini-tts"
                  : "openai/gpt-4o-mini-tts",
                input: spoken,
                voice: "coral",
                response_format: "mp3",
                stream_format: "audio",
                speed,
                instructions,
              }),
              signal: request.signal,
            });

            if (response.ok) {
              return new Response(response.body, {
                headers: {
                  "Content-Type": "audio/mpeg",
                  "Cache-Control": "private, max-age=86400",
                },
              });
            }
            const body = await response.text().catch(() => "");
            console.error("German TTS failed", provider.url, response.status, body.slice(0, 300));
            lastStatus = response.status;
          }
          return new Response("High-quality voice failed", { status: lastStatus });
        } catch (err) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("German TTS error", err);
          return new Response("High-quality voice failed", { status: 500 });
        }
      },
    },
  },
});
