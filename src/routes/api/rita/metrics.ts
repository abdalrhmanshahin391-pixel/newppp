/* eslint-disable @typescript-eslint/no-explicit-any -- migration types are generated after deployment. */
import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";

function bounded(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(120_000, Math.max(0, Math.round(number))) : null;
}

function uuid(value: unknown) {
  const candidate = String(value ?? "");
  return /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : null;
}

function count(value: unknown, max = 1_000_000) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(0, Math.round(number))) : 0;
}

export const Route = createFileRoute("/api/rita/metrics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
          const sessionId = uuid(body?.sessionId);
          const turnId = uuid(body?.turnId);
          const clientTurnId = uuid(body?.clientTurnId);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const marks = (body?.marks && typeof body.marks === "object" ? body.marks : {}) as Record<string, unknown>;
            const elapsed = (from: unknown, to: unknown) => {
              const start = Number(from);
              const end = Number(to);
              return Number.isFinite(start) && Number.isFinite(end) && end >= start ? bounded(end - start) : null;
            };
            const row = {
            user_id: auth.userId,
              session_id: sessionId,
              turn_id: turnId,
              client_turn_id: clientTurnId,
              trace_id: uuid(body?.traceId),
              diagnostic_code: String(body?.diagnosticCode ?? "").slice(0, 16) || null,
            pipeline_mode: body?.pipelineMode === "legacy" ? "legacy" : "economic_v2",
            language: String(body?.language ?? "").slice(0, 20) || null,
            browser: String(body?.browser ?? "").slice(0, 120) || null,
            network_type: String(body?.networkType ?? "").slice(0, 30) || null,
            speech_end_to_transcript_ms: bounded(body?.speechEndToTranscriptMs) ?? elapsed(marks.speechEnd, marks.transcriptFinal),
            transcript_to_first_token_ms: bounded(body?.transcriptToFirstTokenMs) ?? elapsed(marks.transcriptFinal, marks.firstToken),
            first_token_to_tts_ms: bounded(body?.firstTokenToTtsMs) ?? elapsed(marks.firstToken, marks.firstAudio),
            speech_end_to_first_audio_ms: bounded(body?.speechEndToFirstAudioMs) ?? elapsed(marks.speechEnd, marks.firstAudio),
            interrupted: body?.interrupted === true,
            fallback_used: body?.fallbackUsed === true,
            reconnect_count: Math.min(
              50,
              Math.max(0, Math.round(Number(body?.reconnectCount) || 0)),
            ),
            error_stage: String(body?.errorStage ?? "").slice(0, 60) || null,
              status: ["started", "streaming", "completed", "failed", "aborted", "partial"].includes(String(body?.status)) ? String(body?.status) : "started",
              end_reason: String(body?.endReason ?? "").slice(0, 60) || null,
              last_stage: String(body?.lastStage ?? "").slice(0, 60) || null,
              speech_start_ms: bounded(marks.speechStart),
              speech_end_ms: bounded(marks.speechEnd),
              first_interim_ms: bounded(marks.firstInterim),
              transcript_final_ms: bounded(marks.transcriptFinal),
              request_sent_ms: bounded(marks.requestSent),
              first_token_ms: bounded(marks.firstToken),
              text_complete_ms: bounded(marks.textComplete),
              text_rendered_ms: bounded(marks.textRendered),
              first_audio_ms: bounded(marks.firstAudio),
              playback_end_ms: bounded(marks.playbackEnd),
              server_auth_ms: bounded((body?.serverTimings as Record<string, unknown> | undefined)?.auth),
              server_config_ms: bounded((body?.serverTimings as Record<string, unknown> | undefined)?.config),
              server_allowance_ms: bounded((body?.serverTimings as Record<string, unknown> | undefined)?.allowance),
              server_first_token_ms: bounded((body?.serverTimings as Record<string, unknown> | undefined)?.firstToken),
              server_reply_done_ms: bounded((body?.serverTimings as Record<string, unknown> | undefined)?.replyDone),
              transcript_char_count: count(body?.transcriptCharCount, 2_000),
              reply_char_count: count(body?.replyCharCount, 10_000),
              segments_planned: count(body?.segmentsPlanned, 16),
              segments_requested: count(body?.segmentsRequested, 16),
              segments_received: count(body?.segmentsReceived, 16),
              segments_played: count(body?.segmentsPlayed, 16),
              segments_completed: count(body?.segmentsCompleted, 16),
              planned_audio_ms: count(body?.plannedAudioMs, 300_000),
              received_audio_ms: count(body?.receivedAudioMs, 300_000),
              played_audio_ms: count(body?.playedAudioMs, 300_000),
              filler_used: body?.fillerUsed === true,
              updated_at: new Date().toISOString(),
            };
            const conflict = turnId ? "user_id,turn_id" : "user_id,client_turn_id";
            const { error } = await (supabaseAdmin.from as any)("rita_turn_metrics").upsert(row, { onConflict: conflict });
          if (error) throw error;
            const segment = body?.segment as Record<string, unknown> | undefined;
            if (turnId && segment && Number.isInteger(Number(segment.index))) {
              const segmentRow = {
                user_id: auth.userId,
                turn_id: turnId,
                segment_index: count(segment.index, 15),
                char_count: count(segment.charCount, 3_000),
                request_ms: bounded(segment.requestMs),
                headers_ms: bounded(segment.headersMs),
                first_byte_ms: bounded(segment.firstByteMs),
                received_ms: bounded(segment.receivedMs),
                queued_ms: bounded(segment.queuedMs),
                playback_start_ms: bounded(segment.playbackStartMs),
                playback_end_ms: bounded(segment.playbackEndMs),
                received_bytes: count(segment.receivedBytes, 20_000_000),
                played_audio_ms: count(segment.playedAudioMs, 300_000),
                provider_ms: bounded(segment.providerMs),
                http_status: count(segment.httpStatus, 599) || null,
                status: String(segment.status ?? "planned").slice(0, 40),
                error_code: String(segment.errorCode ?? "").slice(0, 80) || null,
                updated_at: new Date().toISOString(),
              };
              const { error: segmentError } = await (supabaseAdmin.from as any)("rita_turn_segments").upsert(segmentRow, { onConflict: "user_id,turn_id,segment_index" });
              if (segmentError) throw segmentError;
            }
          return Response.json({ ok: true });
        } catch (error) {
          console.warn("Rita metric was not persisted", error);
          return Response.json({ ok: false }, { status: 503 });
        }
      },
    },
  },
});
