import { createFileRoute } from "@tanstack/react-router";
import {
  getRitaAllowance,
  getRitaSettings,
  requireRitaUser,
} from "@/lib/rita-voice.server";
import { inferRitaTranscriptLanguage } from "@/lib/rita-language-state";

function fail(code: string, error: string, status: number, traceId: string) {
  return Response.json({ code, error, traceId }, { status, headers: { "X-Rita-Trace": traceId } });
}

export const Route = createFileRoute("/api/rita/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (Number.isFinite(contentLength) && contentLength > 14_000_000)
          return fail("audio_too_large", "That recording is too long to double-check.", 413, traceId);
        const auth = await requireRitaUser(request);
        if (!auth) return fail("unauthorized", "Please sign in again.", 401, traceId);
        const settings = await getRitaSettings();
        const key = (process.env["LOVABLE_API_KEY"] ?? "").trim();
        if (!key)
          return fail("not_configured", "Second-listen transcription is not configured.", 503, traceId);
        const allowance = await getRitaAllowance(auth.userId, settings);
        if (!allowance.allowed)
          return fail("usage_limited", "Rita's voice allowance is currently paused.", 429, traceId);

        const incoming = await request.formData().catch(() => null);
        const audio = incoming?.get("audio");
        if (!(audio instanceof File) || !audio.size || audio.size > 2_000_000)
          return fail("invalid_audio", "The recovery recording is invalid.", 400, traceId);

        const upstreamBody = new FormData();
        upstreamBody.append("model", "google/gemini-3.5-transcribe");
        upstreamBody.append("file", new File([audio], audio.name || "rita-turn.wav", { type: audio.type.startsWith("audio/") ? audio.type : "audio/wav" }));
        upstreamBody.append("response_format", "json");
        upstreamBody.append("stream", "true");
        const startedAt = performance.now();
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstreamBody,
          signal: request.signal,
        });
        const elapsed = performance.now() - startedAt;
        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          console.error(
            "Rita fallback transcription failed",
            traceId,
            upstream.status,
            detail.slice(0, 240),
          );
          return fail(
            "transcription_failed",
            "Rita could not recover that sentence.",
            502,
            traceId,
          );
        }
        const streamText = await upstream.text();
        let text = "";
        for (const line of streamText.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          let event: { type?: string; delta?: string; text?: string };
          try {
            event = JSON.parse(raw) as { type?: string; delta?: string; text?: string };
          } catch {
            continue;
          }
          if (event.type === "transcript.text.done") text = String(event.text ?? text);
          else if (event.type === "transcript.text.delta") text += String(event.delta ?? "");
        }
        text = text.trim();
        if (!text)
          return fail("empty_transcript", "Rita could not hear a clear sentence.", 422, traceId);
        return Response.json(
          {
            text,
            language: inferRitaTranscriptLanguage(text),
            traceId,
            totalMs: Math.round(elapsed),
          },
          {
            headers: {
              "Cache-Control": "private, no-store",
              "Server-Timing": `fallback_stt;dur=${elapsed.toFixed(1)}`,
            },
          },
        );
      },
    },
  },
});
