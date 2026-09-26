import { createFileRoute } from "@tanstack/react-router";
import {
  getRitaAllowanceCached,
  getRitaSettings,
  requireRitaUser,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";

// Premium mode: OpenAI Realtime hears the learner directly. Only runs when the admin selects it.
const RITA_REALTIME_MODEL = "gpt-realtime";

const INSTRUCTIONS = `You are Rita, a warm, witty and slightly strict German teacher for Arabic-speaking learners (Levantine/Jordanian dialect).
Free conversation only. Speak Arabic in the learner's dialect for explanations and clear standard German for German words and sentences.
Keep replies short (1-3 sentences) unless the learner asks for detail. Give a German sentence on its own, never glued to Arabic.
Correct big mistakes once with a light, kind joke, never at the learner's expense; if they get it after two tries, accept and move on.
Never invent facts. Do not judge pronunciation unless you clearly heard a problem. Understand mixed Arabic, German and English naturally.`;

function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/rita/live")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return fail("Please sign in again.", 401);
        const [settings, key] = await Promise.all([getRitaSettings(), resolveRitaOpenAiKey()]);
        if (settings.sttEngine !== "realtime")
          return fail("Realtime mode is not selected in admin.", 409);
        if (!key) return fail("Add an OpenAI key in Admin → AI keys for Realtime mode.", 503);
        const allowance = await getRitaAllowanceCached(auth.userId, settings);
        if (!allowance.allowed) return fail("Rita's voice allowance is currently paused.", 429);
        const sdp = await request.text();
        if (!sdp || sdp.length > 60_000) return fail("Invalid connection offer.", 400);

        const form = new FormData();
        form.set("sdp", sdp);
        form.set(
          "session",
          JSON.stringify({
            type: "realtime",
            model: RITA_REALTIME_MODEL,
            instructions: INSTRUCTIONS,
            audio: {
              input: {
                transcription: { model: "gpt-4o-transcribe" },
                turn_detection: { type: "server_vad", silence_duration_ms: 500 },
              },
              output: { voice: "marin" },
            },
          }),
        );
        const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
        });
        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          console.error("Rita realtime connect failed", upstream.status, detail.slice(0, 300));
          return fail(
            upstream.status === 429
              ? "OpenAI is busy or out of credit. Try again later."
              : upstream.status === 401 || upstream.status === 403
                ? "The OpenAI key was rejected. Check it in Admin → AI keys."
                : "Could not connect Rita Realtime.",
            upstream.status === 429 ? 429 : 502,
          );
        }
        return new Response(await upstream.text(), {
          headers: {
            "Content-Type": "application/sdp",
            "Cache-Control": "no-store",
            "X-Rita-Model": RITA_REALTIME_MODEL,
          },
        });
      },
    },
  },
});
