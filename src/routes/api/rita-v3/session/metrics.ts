import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";
import { recordRitaV3Event } from "@/lib/rita-v3.server";
import { cleanMetricEvent } from "@/lib/rita-v3-metrics";

export const Route = createFileRoute("/api/rita-v3/session/metrics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const sessionId = String(body.sessionId ?? "");
        const event = cleanMetricEvent(body);
        if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !event) {
          return Response.json({ ok: false }, { status: 400 });
        }
        try {
          await recordRitaV3Event({
            sessionId,
            userId: auth.userId,
            accessToken: auth.token,
            name: event.name,
            valueMs: event.valueMs,
            metadata: event.metadata,
          });
        } catch (error) {
          console.error("Rita v3 metric storage failed", error);
          return Response.json({ ok: false }, { status: 503 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
