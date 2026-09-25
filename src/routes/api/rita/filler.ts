import { createFileRoute } from "@tanstack/react-router";
import {
  RITA_MODELS,
  getRitaAllowance,
  getRitaSettings,
  requireRitaUser,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";
import { ritaVoiceInstructions } from "@/lib/rita-voice-style";

const FILLERS = {
  ar: ["مم…", "فهمت عليك…", "خليني أشوف…"],
  en: ["Mm-hm…", "Got you…", "Let me think."],
  de: ["Mhm…", "Verstehe…", "Lass mich kurz überlegen."],
} as const;

const ALLOWED_VOICES = new Set(["marin", "cedar"]);

export const Route = createFileRoute("/api/rita/filler")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(request.url);
        const language = url.searchParams.get("language") as keyof typeof FILLERS | null;
        const index = Number(url.searchParams.get("index"));
        if (
          !language ||
          !(language in FILLERS) ||
          !Number.isInteger(index) ||
          index < 0 ||
          index > 2
        )
          return Response.json({ error: "Invalid filler" }, { status: 400 });

        const settings = await getRitaSettings();
        const allowance = await getRitaAllowance(auth.userId, settings);
        if (!allowance.allowed)
          return Response.json({ error: "Rita voice is unavailable" }, { status: 429 });
        const key = await resolveRitaOpenAiKey();
        if (!key) return Response.json({ error: "Rita voice is not configured" }, { status: 503 });

        const voice = ALLOWED_VOICES.has(settings.voice) ? settings.voice : "marin";
        const text = FILLERS[language][index];
        const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: RITA_MODELS.speech,
            voice,
            input: text,
            instructions: ritaVoiceInstructions(
              language === "ar" ? "ar" : language,
              language === "ar" ? "ar-JO" : language === "en" ? "en-GB" : "standard",
              "warm",
            ),
            response_format: "pcm",
            stream_format: "audio",
            speed: 1,
          }),
          signal: request.signal,
        });
        if (!upstream.ok || !upstream.body)
          return Response.json({ error: "Filler voice failed" }, { status: 502 });

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "audio/pcm;rate=24000",
            // The browser also stores this response in Cache Storage. Each device
            // generates each of the nine tiny phrases only once per selected voice.
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Rita-Voice": voice,
          },
        });
      },
    },
  },
});
