import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";
import { updateRitaV3Session } from "@/lib/rita-v3.server";

export const Route = createFileRoute("/api/rita-v3/session/end")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-uzyra-voice-control") === "1") {
          const { handleFreeTalkControl } = await import("@/lib/free-talk-control.server");
          return handleFreeTalkControl(request);
        }
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const sessionId = String(body.sessionId ?? "");
        const providerSessionId = String(body.providerSessionId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
          return Response.json({ ok: false, code: "invalid_session" }, { status: 400 });
        }

        try {
          const { endFreeTalk } = await import("@/lib/free-talk.server");
          await endFreeTalk(auth.userId, sessionId);
        } catch { return Response.json({ok:false,code:"free_talk_stop_unconfirmed"},{status:503}); }
        // Modal owns worker lifetime; do not invoke the retired Pipecat control plane.
        void providerSessionId;
        await updateRitaV3Session(sessionId, auth.userId, auth.token, {
          status: "ended",
          ended_at: new Date().toISOString(),
        }).catch(() => undefined);
        return Response.json({ ok: true });
      },
    },
  },
});
