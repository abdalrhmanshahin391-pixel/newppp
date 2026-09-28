import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";
import { recordRitaV3Event } from "@/lib/rita-v3.server";

const ALLOWED_EVENTS = new Set([
  "speech_start",
  "speech_end",
  "transcript_final",
  "llm_start",
  "tts_start",
  "first_audio",
  "interrupted",
  "provider_error",
  "session_connected",
  "provider_metrics",
  "playback_stop",
  "turn_commit",
  "backchannel",
  "false_interruption",
]);

export const Route = createFileRoute("/api/rita-v3/session/metrics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const sessionId = String(body.sessionId ?? "");
        const name = String(body.name ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !ALLOWED_EVENTS.has(name)) {
          return Response.json({ ok: false }, { status: 400 });
        }
        const rawMetadata =
          body.metadata && typeof body.metadata === "object"
            ? JSON.stringify(body.metadata)
            : "{}";
        const metadata =
          rawMetadata.length <= 12_000
            ? (JSON.parse(rawMetadata) as Record<string, unknown>)
            : { truncated: true, preview: rawMetadata.slice(0, 11_500) };
        await recordRitaV3Event({
          sessionId,
          userId: auth.userId,
          name,
          valueMs: Number.isFinite(Number(body.valueMs)) ? Math.max(0, Number(body.valueMs)) : undefined,
          metadata,
        }).catch(() => undefined);
        return Response.json({ ok: true });
      },
    },
  },
});
