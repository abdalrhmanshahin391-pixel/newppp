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
const FILLER_BUCKET = "site-media";

async function generateFiller(
  key: string,
  voice: string,
  language: keyof typeof FILLERS,
  index: number,
): Promise<ArrayBuffer | null> {
  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: RITA_MODELS.speech,
      voice,
      input: FILLERS[language][index],
      instructions: ritaVoiceInstructions(
        language === "ar" ? "ar" : language,
        language === "ar" ? "ar-JO" : language === "en" ? "en-GB" : "standard",
        "warm",
      ),
      response_format: "pcm",
      speed: 1,
    }),
  });
  if (!upstream.ok) return null;
  const audio = await upstream.arrayBuffer();
  return audio.byteLength ? audio : null;
}

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
        const voice = ALLOWED_VOICES.has(settings.voice) ? settings.voice : "marin";
        const path = `rita-fillers/${voice}/${language}-${index}.pcm`;
        const headers = {
          "Content-Type": "audio/pcm;rate=24000",
          // The browser also keeps it in Cache Storage for the rest of the year.
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Rita-Voice": voice,
        };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Each of the 18 tiny phrases is generated once for the whole site, then served
        // from storage — no OpenAI call during normal lessons.
        const stored = await supabaseAdmin.storage.from(FILLER_BUCKET).download(path);
        if (stored.data && stored.data.size > 0)
          return new Response(stored.data, { headers: { ...headers, "X-Rita-Filler": "stored" } });

        const allowance = await getRitaAllowance(auth.userId, settings);
        if (!allowance.allowed)
          return Response.json({ error: "Rita voice is unavailable" }, { status: 429 });
        const key = await resolveRitaOpenAiKey();
        if (!key) return Response.json({ error: "Rita voice is not configured" }, { status: 503 });
        const audio = await generateFiller(key, voice, language, index);
        if (!audio) return Response.json({ error: "Filler voice failed" }, { status: 502 });
        await supabaseAdmin.storage
          .from(FILLER_BUCKET)
          .upload(path, audio, { contentType: "application/octet-stream", upsert: true })
          .catch(() => undefined);
        return new Response(audio, { headers: { ...headers, "X-Rita-Filler": "generated" } });
      },
    },
  },
});
