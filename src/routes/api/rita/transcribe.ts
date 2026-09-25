import { createFileRoute } from "@tanstack/react-router";
import {
  getRitaAllowance,
  getRitaSettings,
  requireRitaUser,
  resolveRitaOpenAiKey,
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
        const auth = await requireRitaUser(request);
        if (!auth) return fail("unauthorized", "Please sign in again.", 401, traceId);
        const [settings, key] = await Promise.all([getRitaSettings(), resolveRitaOpenAiKey()]);
        if (!key)
          return fail("not_configured", "OpenAI transcription is not configured.", 503, traceId);
        const allowance = await getRitaAllowance(auth.userId, settings);
        if (!allowance.allowed)
          return fail("usage_limited", "Rita's voice allowance is currently paused.", 429, traceId);

        const incoming = await request.formData().catch(() => null);
        const audio = incoming?.get("audio");
        if (!(audio instanceof File) || !audio.size || audio.size > 2_000_000)
          return fail("invalid_audio", "The recovery recording is invalid.", 400, traceId);

        const upstreamBody = new FormData();
        upstreamBody.append("model", "gpt-4o-mini-transcribe");
        upstreamBody.append("file", audio, audio.name || "rita-turn.wav");
        upstreamBody.append("response_format", "json");
        upstreamBody.append(
          "prompt",
          "Transcribe exactly. The speaker may use Jordanian Arabic, English, German, or mix a foreign word inside one sentence. Do not translate.",
        );
        const startedAt = performance.now();
        const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
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
        const result = (await upstream.json().catch(() => null)) as { text?: string } | null;
        const text = String(result?.text ?? "").trim();
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
