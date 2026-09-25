import { createFileRoute } from "@tanstack/react-router";
import {
  RITA_MODELS,
  getRitaSettings,
  resolveRitaCartesiaKey,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";
import { cartesiaSpeech } from "@/lib/rita-cartesia.server";
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
        } | null;
        const text = String(body?.text ?? "")
          .trim()
          .slice(0, 3_000);
        const turnId = String(body?.turnId ?? "");
        const index = Number(body?.index ?? -1);
        const ticket = String(body?.ticket ?? "");
        // The signed, 90-second ticket from /api/rita/respond is bound to this user,
        // turn, segment and exact text, so it replaces a second sign-in round trip.
        const ticketUser = readRitaSpeechTicketUser(ticket);
        if (!ticketUser)
          return speechError("unauthorized", "Please sign in again.", 401, traceId, false);
        const auth = { userId: ticketUser };
        if (!text || !/^[0-9a-f-]{36}$/i.test(turnId))
          return speechError(
            "invalid_request",
            "Rita received an invalid voice request.",
            400,
            traceId,
            false,
          );
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index > 2 ||
          !(await verifyRitaSpeechTicket({
            ticket,
            userId: auth.userId,
            turnId,
            index,
            text,
          }))
        )
          return speechError(
            "invalid_speech_ticket",
            "This voice segment is no longer authorized.",
            403,
            traceId,
            false,
          );

        const [settings, key] = await configPromise;

        if (settings.ttsProvider === "cartesia") {
          try {
            const cartesiaKey = await resolveRitaCartesiaKey();
            if (cartesiaKey) {
              const startedAt = performance.now();
              const upstream = await cartesiaSpeech({
                key: cartesiaKey,
                text,
                voiceId: settings.cartesiaVoiceId,
                model: settings.cartesiaModel,
                language: String(body?.language ?? ""),
                signal: request.signal,
              });
              if (upstream.ok && upstream.body) {
                return new Response(upstream.body, {
                  headers: {
                    "Content-Type": "audio/pcm;rate=24000",
                    "Cache-Control": "private, no-store",
                    "X-Rita-Voice": "cartesia",
                    "X-Rita-Trace": traceId,
                    "X-Rita-Segment": String(index),
                    "Server-Timing": `speech;dur=${(performance.now() - startedAt).toFixed(1)}`,
                  },
                });
              }
              const detail = await upstream.text().catch(() => "");
              console.error("Rita Cartesia failed, using OpenAI", traceId, upstream.status, detail.slice(0, 240));
            }
          } catch (error) {
            if (request.signal.aborted) return new Response(null, { status: 499 });
            console.error("Rita Cartesia request failed, using OpenAI", traceId, error);
          }
        }

        if (!key)
          return speechError(
            "not_configured",
            "Rita’s voice is not configured.",
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
              speed: 1.18,
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
              "X-Rita-Voice": "premium",
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
