import { createFileRoute } from "@tanstack/react-router";
import {
  getRitaAllowanceCached,
  getRitaSettings,
  requireRitaUser,
} from "@/lib/rita-voice.server";
import { resolveRitaGroqConfig } from "@/lib/rita-groq.server";
import { inferRitaTranscriptLanguage } from "@/lib/rita-language-state";

const RITA_WHISPER_MODEL = "whisper-large-v3-turbo";

function fail(code: string, error: string, status: number, traceId: string) {
  return Response.json({ code, error, traceId }, { status, headers: { "X-Rita-Trace": traceId } });
}

export const Route = createFileRoute("/api/rita/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (Number.isFinite(contentLength) && contentLength > 3_000_000)
          return fail("audio_too_large", "That recording is too long.", 413, traceId);
        const auth = await requireRitaUser(request);
        if (!auth) return fail("unauthorized", "Please sign in again.", 401, traceId);
        const [settings, groq] = await Promise.all([getRitaSettings(), resolveRitaGroqConfig()]);
        if (!groq) return fail("not_configured", "Add a Groq key in Admin → AI keys.", 503, traceId);
        const allowance = await getRitaAllowanceCached(auth.userId, settings);
        if (!allowance.allowed)
          return fail("usage_limited", "Rita's voice allowance is currently paused.", 429, traceId);

        const incoming = await request.formData().catch(() => null);
        const audio = incoming?.get("audio");
        const hint = String(incoming?.get("language") ?? "").slice(0, 5);
        // 16 kHz mono PCM16 ≈ 32 KB/s, so 2.9 MB covers ~45 s of speech.
        if (!(audio instanceof File) || audio.size < 1_000 || audio.size > 2_900_000)
          return fail("invalid_audio", "The recording is invalid.", 400, traceId);

        const upstreamBody = new FormData();
        upstreamBody.append("model", RITA_WHISPER_MODEL);
        upstreamBody.append("file", new File([audio], "rita-turn.wav", { type: "audio/wav" }));
        upstreamBody.append("response_format", "verbose_json");
        upstreamBody.append("temperature", "0");
        if (/^(ar|de|en)$/.test(hint)) upstreamBody.append("language", hint);
        const startedAt = performance.now();
        const upstream = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groq.key}` },
          body: upstreamBody,
          signal: request.signal,
        });
        const elapsed = performance.now() - startedAt;
        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          console.error("Rita Whisper transcription failed", traceId, upstream.status, detail.slice(0, 240));
          return fail(
            upstream.status === 429 ? "rate_limited" : "transcription_failed",
            "Rita could not hear that sentence.",
            upstream.status === 429 ? 429 : 502,
            traceId,
          );
        }
        const result = (await upstream.json().catch(() => null)) as
          | { text?: string; language?: string; segments?: Array<{ no_speech_prob?: number }> }
          | null;
        const text = String(result?.text ?? "").trim();
        const segments = result?.segments ?? [];
        const silent = segments.length > 0 && segments.every((segment) => Number(segment.no_speech_prob ?? 0) > 0.8);
        if (!text || silent)
          return fail("empty_transcript", "Rita could not hear a clear sentence.", 422, traceId);
        return Response.json(
          {
            text,
            language: inferRitaTranscriptLanguage(text).language,
            engine: RITA_WHISPER_MODEL,
            traceId,
            totalMs: Math.round(elapsed),
          },
          {
            headers: {
              "Cache-Control": "private, no-store",
              "Server-Timing": `whisper_stt;dur=${elapsed.toFixed(1)}`,
            },
          },
        );
      },
    },
  },
});
