import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

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
        const supabaseUrl = process.env["SUPABASE_URL"];
        const anonKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !anonKey) return new Response("Backend not configured", { status: 503 });
        const supabase = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: { text?: string; rate?: number } = {};
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid request", { status: 400 });
        }

        const text = String(payload.text ?? "").trim().slice(0, MAX_TTS_CHARS);
        if (!text) return new Response("Text required", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("High-quality voice is unavailable", { status: 503 });


        const speed = Math.max(0.65, Math.min(1.05, Number(payload.rate ?? 0.92)));

        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text,
              voice: "coral",
              response_format: "mp3",
              stream_format: "audio",
              speed,
              instructions:
                "Speak as a calm native German woman from Germany. Clear standard Hochdeutsch accent, warm classroom tone, crisp consonants, natural short pauses, no English accent.",
            }),
            signal: request.signal,
          });

          if (!response.ok) {
            const body = await response.text().catch(() => "");
            console.error("German TTS failed", response.status, body.slice(0, 300));
            return new Response("High-quality voice failed", { status: response.status });
          }

          return new Response(response.body, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "private, max-age=86400",
            },
          });
        } catch (err) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("German TTS error", err);
          return new Response("High-quality voice failed", { status: 500 });
        }
      },
    },
  },
});