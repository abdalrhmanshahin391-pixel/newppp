import { createFileRoute } from "@tanstack/react-router";
import { requireRitaV3Access, resolveRitaV3Key } from "@/lib/rita-v3.server";

const FILLERS = {
  ar: ["مم…", "فهمت عليك…", "خليني أشوف…"],
  en: ["Mm-hm…", "Got you…", "Let me think."],
  de: ["Mhm…", "Verstehe…", "Lass mich kurz überlegen."],
} as const;

function decodeBase64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function pcmPayload(bytes: Uint8Array) {
  if (
    bytes.byteLength < 12 ||
    String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" ||
    String.fromCharCode(...bytes.slice(8, 12)) !== "WAVE"
  ) return bytes;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const name = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const length = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (name === "data" && start + length <= bytes.byteLength) {
      return bytes.slice(start, start + length);
    }
    offset = start + length + (length % 2);
  }
  throw new Error("Gemini returned an invalid WAV payload");
}

export const Route = createFileRoute("/api/rita-v3/filler")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const access = await requireRitaV3Access(request);
        if (!access.ok) return access.response;
        const url = new URL(request.url);
        const language = url.searchParams.get("language") as keyof typeof FILLERS | null;
        const index = Number(url.searchParams.get("index"));
        if (!language || !(language in FILLERS) || !Number.isInteger(index) || index < 0 || index > 2) {
          return Response.json({ error: "Invalid filler" }, { status: 400 });
        }
        const key = await resolveRitaV3Key("google", "GOOGLE_API_KEY");
        if (!key) return Response.json({ error: "Gemini TTS is not configured" }, { status: 503 });
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{
                  text: FILLERS[language][index],
                  speech_metadata: {
                    style: "Rita: warm, close-mic, quick and natural; friendly Jordanian accent for Arabic.",
                  },
                }],
              }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { voice: "Achernar" } },
              },
            }),
            signal: AbortSignal.timeout(12_000),
          },
        );
        if (!response.ok) return Response.json({ error: "Filler generation failed" }, { status: 502 });
        const payload = (await response.json()) as {
          candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
        };
        const chunks = (payload.candidates ?? []).flatMap((candidate) =>
          (candidate.content?.parts ?? []).flatMap((part) =>
            part.inlineData?.data ? [pcmPayload(decodeBase64(part.inlineData.data))] : [],
          ),
        );
        if (!chunks.length) return Response.json({ error: "Gemini returned no filler audio" }, { status: 502 });
        const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
        const audio = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          audio.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return new Response(audio, {
          headers: {
            "Content-Type": "audio/l16;codec=pcm;rate=24000",
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Rita-Voice": "Gemini-3.8-Flash-Lite/Achernar",
          },
        });
      },
    },
  },
});
