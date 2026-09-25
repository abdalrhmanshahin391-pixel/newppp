import { createFileRoute } from "@tanstack/react-router";
import {
  getRitaAllowanceCached,
  getRitaSettings,
  requireRitaUser,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";

// Silent warm-up: fills the settings/key/allowance caches and opens the TLS
// connection to OpenAI so the first real turn skips the cold start. No AI cost.
const lastWarm = new Map<string, number>();

export const Route = createFileRoute("/api/rita/warm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response(null, { status: 401 });
        const now = Date.now();
        if (now - (lastWarm.get(auth.userId) ?? 0) < 10_000)
          return new Response(null, { status: 204 });
        lastWarm.set(auth.userId, now);
        try {
          const [settings, key] = await Promise.all([getRitaSettings(), resolveRitaOpenAiKey()]);
          await Promise.all([
            getRitaAllowanceCached(auth.userId, settings).catch(() => null),
            key
              ? fetch("https://api.openai.com/v1/models", {
                  method: "HEAD",
                  headers: { Authorization: `Bearer ${key}` },
                }).catch(() => null)
              : null,
          ]);
        } catch {
          // Warm-up is best effort.
        }
        return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
