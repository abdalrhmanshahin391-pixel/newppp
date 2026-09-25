import { createFileRoute } from "@tanstack/react-router";
import {
  getRitaAllowance,
  getRitaSettings,
  requireRitaUser,
  resolveRitaDeepgramKey,
} from "@/lib/rita-voice.server";

function fail(code: string, error: string, status: number, traceId: string) {
  return Response.json(
    { code, error, stage: "deepgram_auth", retryable: status >= 500, traceId },
    { status, headers: { "Cache-Control": "no-store", "X-Rita-Trace": traceId } },
  );
}

export const Route = createFileRoute("/api/rita/deepgram-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        const auth = await requireRitaUser(request);
        if (!auth) return fail("unauthorized", "Please sign in again.", 401, traceId);
        const settings = await getRitaSettings();
        const allowance = await getRitaAllowance(auth.userId, settings);
        if (!allowance.allowed)
          return fail(
            "allowance_reached",
            "Rita Economic v2 has reached its voice usage limit.",
            429,
            traceId,
          );
        const key = await resolveRitaDeepgramKey();
        if (!key)
          return fail(
            "deepgram_not_configured",
            "Rita Economic v2 needs a Deepgram key in Admin → AI keys.",
            503,
            traceId,
          );
        try {
          const upstream = await fetch("https://api.deepgram.com/v1/auth/grant", {
            method: "POST",
            headers: {
              Authorization: `Token ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ttl_seconds: 30 }),
            signal: request.signal,
          });
          const payload = (await upstream.json().catch(() => null)) as {
            access_token?: string;
            expires_in?: number;
            err_msg?: string;
          } | null;
          if (!upstream.ok || !payload?.access_token) {
            console.error("Deepgram token grant failed", traceId, upstream.status, payload?.err_msg);
            return fail(
              "deepgram_auth_failed",
              "Deepgram rejected Rita's key or project permissions.",
              502,
              traceId,
            );
          }
          return Response.json(
            { token: payload.access_token, expiresIn: payload.expires_in ?? 30, traceId },
            { headers: { "Cache-Control": "no-store", "X-Rita-Trace": traceId } },
          );
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Deepgram token request failed", traceId, error);
          return fail(
            "deepgram_unreachable",
            "Rita could not connect to Deepgram.",
            502,
            traceId,
          );
        }
      },
    },
  },
});
