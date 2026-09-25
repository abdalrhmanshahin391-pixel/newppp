import { createFileRoute } from "@tanstack/react-router";
import {
  getRitaAllowanceCached,
  getRitaSettings,
  requireRitaUser,
} from "@/lib/rita-voice.server";
import { resolveRitaGroqConfig } from "@/lib/rita-groq.server";
import { createRitaSessionTicket } from "@/lib/rita-session-ticket.server";

// Silent warm-up: fills the settings/key/allowance caches, opens the TLS
// state used by the live lesson and issues a short session ticket. No AI cost.
const lastWarm = new Map<string, number>();

async function issueTicket(userId: string) {
  try {
    return await createRitaSessionTicket(userId);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/rita/warm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response(null, { status: 401 });
        const headers = { "Cache-Control": "no-store" };
        const now = Date.now();
        if (now - (lastWarm.get(auth.userId) ?? 0) < 10_000)
          return Response.json(await issueTicket(auth.userId), { headers });
        lastWarm.set(auth.userId, now);
        try {
          const [settings] = await Promise.all([getRitaSettings(), resolveRitaGroqConfig()]);
          await Promise.all([
            getRitaAllowanceCached(auth.userId, settings).catch(() => null),
          ]);
        } catch {
          // Warm-up is best effort.
        }
        return Response.json(await issueTicket(auth.userId), { headers });
      },
    },
  },
});
