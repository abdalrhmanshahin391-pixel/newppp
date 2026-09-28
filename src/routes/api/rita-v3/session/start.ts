import { createFileRoute } from "@tanstack/react-router";
import {
  RITA_V3_MODELS,
  persistRitaV3Session,
  requireRitaV3Access,
  ritaV3Environment,
  updateRitaV3Session,
} from "@/lib/rita-v3.server";
import { cleanLanguage, normalizePersonality } from "@/lib/rita-voice.server";

export const Route = createFileRoute("/api/rita-v3/session/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = await requireRitaV3Access(request);
        if (!access.ok) return access.response;
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const personality = normalizePersonality(body.personality);
        const language = cleanLanguage(body.language);
        const dialect = String(body.dialect ?? "ar-JO").slice(0, 32) || "ar-JO";
        const mode = ["free_conversation", "guided_lesson", "pronunciation_drill"].includes(String(body.mode))
          ? String(body.mode)
          : "free_conversation";
        const env = await ritaV3Environment();

        if (!env.publicKey) {
          return Response.json(
            {
              ok: false,
              code: "pipecat_not_configured",
              message: "Rita v3 is installed but its Pipecat public key is not configured yet.",
              models: RITA_V3_MODELS,
            },
            { status: 503 },
          );
        }

        let sessionId: string;
        try {
          sessionId = await persistRitaV3Session({
            userId: access.auth.userId,
            personality,
            language,
            dialect,
          });
        } catch (error) {
          console.error("Rita v3 session persistence failed", error);
          return Response.json(
            { ok: false, code: "session_storage_failed", message: "Rita session storage is not ready." },
            { status: 503 },
          );
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
          const upstream = await fetch(
            `https://api.pipecat.daily.co/v1/public/${encodeURIComponent(env.agentName)}/start`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.publicKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                createDailyRoom: true,
                body: {
                  appSessionId: sessionId,
                  personality,
                  language,
                  dialect,
                  mode,
                  userId: access.auth.userId,
                },
              }),
              signal: controller.signal,
            },
          );
          const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
          if (!upstream.ok || !payload.dailyRoom || !payload.dailyToken) {
            await updateRitaV3Session(sessionId, access.auth.userId, {
              status: "failed",
              error_code: String(payload.code ?? upstream.status),
            });
            const isCapacity = upstream.status === 429;
            return Response.json(
              {
                ok: false,
                code: isCapacity ? "capacity_busy" : "pipecat_start_failed",
                message: isCapacity
                  ? "Rita is busy right now. Please retry in a moment."
                  : "Rita v3 could not start. The old voice system was not used.",
                models: RITA_V3_MODELS,
              },
              { status: isCapacity ? 429 : 502 },
            );
          }
          await updateRitaV3Session(sessionId, access.auth.userId, {
            status: "connected",
            provider_session_id: String(payload.sessionId ?? payload.id ?? ""),
            connected_at: new Date().toISOString(),
          });
          return Response.json(
            {
              dailyRoom: payload.dailyRoom,
              dailyToken: payload.dailyToken,
              sessionId,
              providerSessionId: payload.sessionId ?? payload.id ?? null,
              models: RITA_V3_MODELS,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          await updateRitaV3Session(sessionId, access.auth.userId, {
            status: "failed",
            error_code: error instanceof DOMException && error.name === "AbortError" ? "start_timeout" : "network_error",
          }).catch(() => undefined);
          return Response.json(
            {
              ok: false,
              code: "pipecat_unreachable",
              message: "Rita v3 did not answer in time. Please retry; no legacy fallback was started.",
              models: RITA_V3_MODELS,
            },
            { status: 504 },
          );
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});
