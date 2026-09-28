import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";
import { ritaV3Environment, updateRitaV3Session } from "@/lib/rita-v3.server";

export const Route = createFileRoute("/api/rita-v3/session/end")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const sessionId = String(body.sessionId ?? "");
        const providerSessionId = String(body.providerSessionId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
          return Response.json({ ok: false, code: "invalid_session" }, { status: 400 });
        }

        const env = await ritaV3Environment();
        if (providerSessionId && env.privateKey) {
          await fetch(
            `https://api.pipecat.daily.co/v1/agents/${encodeURIComponent(env.agentName)}/sessions/${encodeURIComponent(providerSessionId)}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${env.privateKey}` } },
          ).catch(() => undefined);
        }
        await updateRitaV3Session(sessionId, auth.userId, {
          status: "ended",
          ended_at: new Date().toISOString(),
        }).catch(() => undefined);
        return Response.json({ ok: true });
      },
    },
  },
});
