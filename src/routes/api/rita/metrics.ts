/* eslint-disable @typescript-eslint/no-explicit-any -- migration types are generated after deployment. */
import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";

function bounded(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(120_000, Math.max(0, Math.round(number))) : null;
}

export const Route = createFileRoute("/api/rita/metrics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const sessionId = String(body?.sessionId ?? "");
        const turnId = String(body?.turnId ?? "");
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await (supabaseAdmin.from as any)("rita_turn_metrics").insert({
            user_id: auth.userId,
            session_id: /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : null,
            turn_id: /^[0-9a-f-]{36}$/i.test(turnId) ? turnId : null,
            pipeline_mode: body?.pipelineMode === "legacy" ? "legacy" : "economic_v2",
            language: String(body?.language ?? "").slice(0, 20) || null,
            browser: String(body?.browser ?? "").slice(0, 120) || null,
            network_type: String(body?.networkType ?? "").slice(0, 30) || null,
            speech_end_to_transcript_ms: bounded(body?.speechEndToTranscriptMs),
            transcript_to_first_token_ms: bounded(body?.transcriptToFirstTokenMs),
            first_token_to_tts_ms: bounded(body?.firstTokenToTtsMs),
            speech_end_to_first_audio_ms: bounded(body?.speechEndToFirstAudioMs),
            interrupted: body?.interrupted === true,
            fallback_used: body?.fallbackUsed === true,
            error_stage: String(body?.errorStage ?? "").slice(0, 60) || null,
          });
          if (error) throw error;
          return Response.json({ ok: true });
        } catch (error) {
          console.warn("Rita metric was not persisted", error);
          return Response.json({ ok: false }, { status: 503 });
        }
      },
    },
  },
});
