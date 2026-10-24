import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";
import { recordRitaV3Events } from "@/lib/rita-v3.server";
import { cleanMetricEvent } from "@/lib/rita-v3-metrics";

/** More events than this in one request is not a page batch. */
const MAX_EVENTS = 50;
/** A page batch is a few kilobytes; anything near this is not one. */
const MAX_BODY_BYTES = 200_000;

export const Route = createFileRoute("/api/rita-v3/session/metrics-batch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const length = Number(request.headers.get("content-length") ?? 0);
        if (length > MAX_BODY_BYTES) return Response.json({ ok: false }, { status: 413 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const sessionId = String(body.sessionId ?? "");
        const raw = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
        if (!/^[0-9a-f-]{36}$/i.test(sessionId) || raw.length === 0) {
          return Response.json({ ok: false }, { status: 400 });
        }
        const events = raw.flatMap((item) => {
          const event = cleanMetricEvent(item);
          if (!event) return [];
          // The page's event id travels with the event so a repeated batch can be told apart later.
          const eventId =
            item && typeof item === "object"
              ? String((item as { eventId?: unknown }).eventId ?? "")
              : "";
          return [
            eventId
              ? { ...event, metadata: { ...event.metadata, eventId: eventId.slice(0, 64) } }
              : event,
          ];
        });
        try {
          await recordRitaV3Events({
            sessionId,
            userId: auth.userId,
            accessToken: auth.token,
            events,
          });
        } catch (error) {
          console.error("Rita v3 metric batch storage failed", error);
          return Response.json({ ok: false }, { status: 503 });
        }
        return Response.json({
          ok: true,
          stored: events.length,
          rejected: raw.length - events.length,
        });
      },
    },
  },
});
