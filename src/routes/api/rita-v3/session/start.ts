import { createFileRoute } from "@tanstack/react-router";
import {
  RITA_V3_MODELS,
  persistRitaV3Session,
  loadOwnedRitaConversation,
  recordRitaV3Event,
  requireRitaV3Access,
  updateRitaV3Session,
} from "@/lib/rita-v3.server";
import { cleanLanguage, normalizePersonality } from "@/lib/rita-voice.server";
import { classifyPipecatStartFailure as classifyWorkerStartFailure } from "@/lib/rita-v3-diagnostics";
import {
  normalizeRitaDiagnosticTraceId,
  readModalTimingEvidence,
} from "@/lib/rita-v3-diagnostics-trace";
import { fetchPipecatStartWithDeadline as fetchStartWithDeadline } from "@/lib/rita-v3-startup";
import { getServerRuntimeSecret } from "@/lib/config.server";
import { loadVoiceLesson } from "@/lib/rita-curriculum.server";

const DEFAULT_MODAL_START_URL =
  "https://abdalrhmanshahin391--ritajet-voice-start-session.modal.run";

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
        const requestedLessonId = typeof body.lessonId === "string" ? body.lessonId : "";
        const lessonPreview = body.preview === true;
        const lesson = requestedLessonId
          ? await loadVoiceLesson(
              access.auth.token,
              access.auth.userId,
              requestedLessonId,
              lessonPreview,
            ).catch((error) => {
              console.warn("Rita lesson could not be loaded", error);
              return null;
            })
          : null;
        if (requestedLessonId && !lesson) {
          return Response.json(
            { ok: false, code: "lesson_unavailable", message: "This lesson is not available." },
            { status: 404 },
          );
        }
        const mode = lesson
          ? "guided_lesson"
          : ["free_conversation", "guided_lesson", "pronunciation_drill"].includes(
                String(body.mode),
              )
            ? String(body.mode)
            : "free_conversation";
        const rawConversationId = String(body.conversationId ?? "").trim();
        const conversationId =
          mode === "free_conversation" && /^[0-9a-f-]{36}$/i.test(rawConversationId)
            ? rawConversationId
            : "";
        if (mode === "free_conversation" && rawConversationId && !conversationId) {
          return Response.json(
            { ok: false, code: "invalid_conversation", message: "Invalid conversation id." },
            { status: 400 },
          );
        }
        const savedConversation = conversationId
          ? await loadOwnedRitaConversation({
              conversationId,
              userId: access.auth.userId,
              accessToken: access.auth.token,
            }).catch((error) => {
              console.warn("Rita conversation history could not be loaded", error);
              return null;
            })
          : null;
        if (conversationId && !savedConversation) {
          return Response.json(
            {
              ok: false,
              code: "conversation_unavailable",
              message: "This conversation is not available.",
            },
            { status: 404 },
          );
        }
        const traceId = normalizeRitaDiagnosticTraceId(body.traceId);
        const modalUrl =
          (await getServerRuntimeSecret("MODAL_START_URL")) || DEFAULT_MODAL_START_URL;
        const modalToken = await getServerRuntimeSecret("MODAL_START_TOKEN");

        console.info("Rita v3 runtime configuration", {
          backend: "modal",
          hasModalUrl: Boolean(modalUrl),
          hasModalToken: Boolean(modalToken),
        });

        if (!modalToken) {
          return Response.json(
            {
              ok: false,
              code: "modal_not_configured",
              message: "Rita v3 needs MODAL_START_TOKEN in the Lovable server runtime.",
              models: RITA_V3_MODELS,
            },
            { status: 503 },
          );
        }

        let sessionId: string;
        try {
          sessionId = await persistRitaV3Session({
            userId: access.auth.userId,
            accessToken: access.auth.token,
            personality,
            language,
            dialect,
            traceId,
            ...(conversationId ? { conversationId } : {}),
          });
        } catch (error) {
          console.error("Rita v3 session persistence failed", error);
          return Response.json(
            {
              ok: false,
              code: "session_storage_failed",
              message: "Rita session storage is not ready.",
            },
            { status: 503 },
          );
        }

        const startedAt = performance.now();
        const startBody = {
          appSessionId: sessionId,
          traceId,
          personality,
          language,
          dialect,
          mode,
          userId: access.auth.userId,
          ...(conversationId ? { conversationId } : {}),
          ...(savedConversation?.history?.length
            ? { conversationHistory: savedConversation.history }
            : {}),
          ...(lesson ? { lesson } : {}),
        };
        const diagnosticBase = {
          traceId,
          source: "lovable-server",
          backend: "modal",
        };
        const recordStartMetric = (
          name: string,
          valueMs?: number,
          metadata?: Record<string, unknown>,
        ) =>
          recordRitaV3Event({
            sessionId,
            userId: access.auth.userId,
            accessToken: access.auth.token,
            name,
            valueMs,
            metadata: { ...diagnosticBase, ...metadata },
          }).catch((error) => console.warn("Rita diagnostic metric failed", { name, error }));
        await recordStartMetric("start_request_received");
        await recordStartMetric("start_upstream_requested");
        try {
          const upstream = await fetchStartWithDeadline(
            fetch,
            modalUrl,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: modalToken, body: startBody }),
            },
            10_000,
          );
          console.info("Rita Modal start request", {
            elapsedMs: Math.round(performance.now() - startedAt),
            upstreamStatus: upstream.status,
          });
          const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
          const upstreamElapsedMs = Math.round(performance.now() - startedAt);
          await recordStartMetric("start_upstream_response", upstreamElapsedMs, {
            upstreamStatus: upstream.status,
          });
          if (!upstream.ok || !payload.dailyRoom || !payload.dailyToken) {
            const failure = classifyWorkerStartFailure(upstream.status, payload, upstream.headers);
            await updateRitaV3Session(sessionId, access.auth.userId, access.auth.token, {
              status: "failed",
              error_code: failure.code,
              model_proof: {
                ...RITA_V3_MODELS,
                startDiagnostic: {
                  code: failure.code,
                  upstreamStatus: failure.upstreamStatus,
                  requestId: failure.requestId,
                },
              },
            });
            await recordStartMetric("start_upstream_failed", upstreamElapsedMs, {
              code: failure.code,
              upstreamStatus: failure.upstreamStatus,
              requestId: failure.requestId,
            });
            return Response.json(
              {
                ok: false,
                ...failure,
                info: failure.message,
                detail: failure.message,
                fallbackUsed: false,
                models: RITA_V3_MODELS,
              },
              { status: upstream.status >= 400 ? upstream.status : 502 },
            );
          }
          await updateRitaV3Session(sessionId, access.auth.userId, access.auth.token, {
            status: "connected",
            provider_session_id: String(payload.sessionId ?? payload.id ?? ""),
            connected_at: new Date().toISOString(),
          });
          const modalTimings = readModalTimingEvidence(payload.diagnostics);
          await recordStartMetric("start_credentials_ready", upstreamElapsedMs, {
            upstreamStatus: upstream.status,
            modalTimings,
          });
          return Response.json(
            {
              dailyRoom: payload.dailyRoom,
              dailyToken: payload.dailyToken,
              sessionId,
              providerSessionId: payload.sessionId ?? payload.id ?? null,
              traceId,
              conversationId: conversationId || null,
              models: RITA_V3_MODELS,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          console.error("Rita Modal start request failed", {
            elapsedMs: Math.round(performance.now() - startedAt),
            errorName: error instanceof Error ? error.name : "unknown",
          });
          const timedOut = error instanceof DOMException && error.name === "AbortError";
          const code = timedOut ? "modal_start_timeout" : "modal_network_error";
          const message = timedOut
            ? "Rita's voice worker did not respond in time. Check its deployment health and logs."
            : "The Rita website could not reach the Modal voice worker. Check its deployment and network status.";
          await updateRitaV3Session(sessionId, access.auth.userId, access.auth.token, {
            status: "failed",
            error_code: code,
            model_proof: {
              ...RITA_V3_MODELS,
              startDiagnostic: { code },
            },
          }).catch(() => undefined);
          await recordStartMetric(
            "start_upstream_failed",
            Math.round(performance.now() - startedAt),
            {
              code,
              errorName: error instanceof Error ? error.name : "unknown",
            },
          );
          return Response.json(
            {
              ok: false,
              code,
              message,
              info: message,
              detail: message,
              retryable: true,
              fallbackUsed: false,
              models: RITA_V3_MODELS,
            },
            { status: timedOut ? 504 : 502 },
          );
        }
      },
    },
  },
});
