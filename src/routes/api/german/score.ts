import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/** Transcribes a short German recording so the client can score the pronunciation. */
export const Route = createFileRoute("/api/german/score")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token || token.split(".").length !== 3) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = process.env["SUPABASE_URL"];
        const anon = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !anon) return new Response("Backend not configured", { status: 503 });

        const supabase = createClient(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error } = await supabase.auth.getClaims(token);
        if (error || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Speech scoring is unavailable", { status: 503 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response("Invalid request", { status: 400 });
        }
        const audio = form.get("audio");
        if (!(audio instanceof File) || audio.size < 2048) {
          return new Response("That recording was empty — please try again.", { status: 400 });
        }
        if (audio.size > 8 * 1024 * 1024) {
          return new Response("Recording too long", { status: 413 });
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", audio, "recording.wav");
        upstream.append("language", "de");

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: upstream,
          });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error("German STT failed", res.status, body.slice(0, 300));
            return new Response(body || "Transcription failed", { status: res.status });
          }
          const json: any = await res.json();
          return Response.json({ text: String(json?.text ?? "") });
        } catch (err) {
          console.error("German STT error", err);
          return new Response("Transcription failed", { status: 500 });
        }
      },
    },
  },
});
