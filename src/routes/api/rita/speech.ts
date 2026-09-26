import { createFileRoute } from "@tanstack/react-router";
import { RITA_MODELS, getRitaSettings, requireRitaUser, resolveRitaOpenAiKey } from "@/lib/rita-voice.server";
import { fishSpeech, resolveFishKey, RITA_ARABIC_FISH_VOICE_ID, RITA_GERMAN_FISH_VOICE_ID } from "@/lib/rita-fish.server";
import { ritaVoiceInstructions } from "@/lib/rita-voice-style";
import { readRitaSpeechTicketUser, verifyRitaSpeechTicket } from "@/lib/rita-speech-ticket.server";

const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

function speechError(
  code: string,
  message: string,
  status: number,
  traceId = "",
  retryable = true,
) {
  return Response.json(
    { code, error: message, retryable, traceId },
    { status, headers: traceId ? { "X-Rita-Trace": traceId } : undefined },
  );
}

export const Route = createFileRoute("/api/rita/speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        // Settings and key load while the request is validated.
        const configPromise = Promise.all([getRitaSettings(), resolveRitaOpenAiKey()]);
        const body = (await request.json().catch(() => null)) as {
          text?: string;
          turnId?: string;
          language?: string;
          dialect?: string;
          emotion?: string;
          index?: number;
          ticket?: string;
          engine?: string;
          voiceRole?: "arabic" | "german";
          speed?: "normal" | "slow";
          interactive?: boolean;
        } | null;
        const text = String(body?.text ?? "")
          .trim()
          .slice(0, 3_000);
        const turnId = String(body?.turnId ?? "");
        const index = Number(body?.index ?? -1);
        const ticket = String(body?.ticket ?? "");
        // The signed, 90-second ticket from /api/rita/respond is bound to this user,
        // turn, segment and exact text, so it replaces a second sign-in round trip.
        const interactiveAuth = body?.interactive ? await requireRitaUser(request) : null;
        const ticketUser = readRitaSpeechTicketUser(ticket) || interactiveAuth?.userId || "";
        if (!ticketUser)
          return speechError("unauthorized", "Please sign in again.", 401, traceId, false);
        const auth = { userId: ticketUser };
        if (!text || !/^[0-9a-f-]{36}$/i.test(turnId) || (body?.interactive && text.length > 180))
          return speechError(
            "invalid_request",
            "Rita received an invalid voice request.",
            400,
            traceId,
            false,
          );
        if (!body?.interactive && (
          !Number.isInteger(index) ||
          index < 0 ||
          index > 7 ||
          !(await verifyRitaSpeechTicket({
            ticket,
            userId: auth.userId,
            turnId,
            index,
            text,
          }))
        ))
          return speechError(
            "invalid_speech_ticket",
            "This voice segment is no longer authorized.",
            403,
            traceId,
            false,
          );

        const [settings, key] = await configPromise;
        const requestedEngine =
          body?.engine === "fish" || body?.engine === "openai" ? body.engine : settings.voiceEngine;
        const voiceRole = body?.voiceRole === "german" ? "german" : "arabic";
        const fishVoiceId = voiceRole === "german"
          ? RITA_GERMAN_FISH_VOICE_ID
          : (settings.fishVoiceId || RITA_ARABIC_FISH_VOICE_ID);
        if ((requestedEngine === "fish" || voiceRole === "german") && fishVoiceId) {
          const fishKey = await resolveFishKey();
          if (fishKey) {
            const fishStartedAt = performance.now();
            try {
              const stream = await fishSpeech({
                key: fishKey,
                voiceId: fishVoiceId,
                text,
                signal: request.signal,
                firstAudioTimeoutMs: 2_500,
                speed: body?.speed === "slow" ? 0.72 : 1,
              });
              return new Response(stream, {
                headers: {
                  "Content-Type": "audio/pcm;rate=24000",
                  "Cache-Control": "private, no-store",
                  "X-Rita-Voice": "fish",
                  "X-Rita-Trace": traceId,
                  "X-Rita-Segment": String(index),
                  "Server-Timing": `speech;dur=${(performance.now() - fishStartedAt).toFixed(1)}`,
                },
              });
            } catch (error) {
              if (request.signal.aborted) return new Response(null, { status: 499 });
              console.warn("Rita Fish voice failed", traceId, voiceRole, String(error).slice(0, 200));
              return speechError(
                voiceRole === "german" ? "german_voice_unavailable" : "arabic_voice_unavailable",
                voiceRole === "german" ? "صوت Emma غير متاح هلأ." : "صوت ليان غير متاح هلأ.",
                502,
                traceId,
              );
            }
          }
          return speechError(
            voiceRole === "german" ? "german_voice_unavailable" : "arabic_voice_unavailable",
            voiceRole === "german" ? "صوت Emma غير متاح هلأ." : "صوت ليان غير متاح هلأ.",
            503,
            traceId,
            false,
          );
        }

        if (!key)
          return speechError(
            "not_configured",
            requestedEngine === "fish"
              ? "Fish voice is unavailable and no backup voice is configured."
              : "Rita’s voice is not configured.",
            503,
            traceId,
            false,
          );

        try {
          const voice = ALLOWED_VOICES.has(settings.voice) ? settings.voice : "marin";
          const speechStartedAt = performance.now();
          const responseFormat = "pcm";
          const contentType = "audio/pcm;rate=24000";
          const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: RITA_MODELS.speech,
              voice,
              input: text,
              instructions: ritaVoiceInstructions(
                String(body?.language ?? ""),
                String(body?.dialect ?? ""),
                String(body?.emotion ?? "warm"),
              ),
              response_format: responseFormat,
              stream_format: "audio",
              // 1.18 keeps speech natural but removes the slow, dragging feel.
              speed: body?.speed === "slow" ? 0.82 : 1.18,
            }),
            signal: request.signal,
          });
          const speechDurationMs = performance.now() - speechStartedAt;
          if (!upstream.ok || !upstream.body) {
            const detail = await upstream.text().catch(() => "");
            console.error("Rita speech failed", traceId, upstream.status, detail.slice(0, 240));
            return speechError(
              "provider_unavailable",
              "Rita’s voice service could not generate audio.",
              502,
              traceId,
            );
          }
          // Economic v2 always passes raw 24 kHz PCM through exactly once.
          return new Response(upstream.body, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "private, no-store",
              "X-Rita-Voice": requestedEngine === "fish" ? "openai-fallback" : "openai",
              "X-Rita-Trace": traceId,
              "X-Rita-Segment": String(index),
              "Server-Timing": `speech;dur=${speechDurationMs.toFixed(1)}`,
            },
          });
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Rita speech request failed", traceId, error);
          return speechError("speech_failed", "Rita’s voice could not be prepared.", 502, traceId);
        }
      },
    },
  },
});
