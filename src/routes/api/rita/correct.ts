import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";
import { resolveRitaV3Key } from "@/lib/rita-v3.server";
import { sanitizeCorrection, shouldCheckCorrection } from "@/lib/rita-correction";

const MODES = new Set(["free_conversation", "guided_lesson", "pronunciation_drill"]);

const SYSTEM = `You help a language tutor show one short correction card to an Arabic-speaking learner.
You receive the learner's spoken message ("spoken", from speech-to-text) and the tutor's reply ("reply").
Return JSON: {"correction": null} or {"correction": {"said","better","why","translation","language"}}.
Rules:
- Return a correction only if "spoken" contains a real mistake in a German or English sentence AND the tutor's reply actually corrects or recasts it.
- Return null when the sentence is correct, when the only difference is capitalisation or punctuation, when the learner only asked a question, or when the error could just be a speech-to-text slip on a correct sentence.
- "said": the faulty phrase exactly as the learner said it (the faulty sentence only).
- "better": the natural corrected phrase. Plain text only, no markdown.
- "why": one short sentence, at most 14 words, naming the single main fix. Write it in the language of the tutor's reply.
- "translation": the meaning of "better" in Arabic.
- "language": "de" or "en".
Never invent a mistake. Never add a second correction.`;

export const Route = createFileRoute("/api/rita/correct")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const data = await request.json().catch(() => null);
        const spoken = String(data?.spoken ?? "")
          .trim()
          .slice(0, 400);
        const reply = String(data?.reply ?? "")
          .trim()
          .slice(0, 900);
        const mode = MODES.has(String(data?.mode)) ? String(data?.mode) : "free_conversation";
        const none = () =>
          Response.json({ correction: null }, { headers: { "Cache-Control": "no-store" } });
        if (!spoken || !reply || !shouldCheckCorrection(spoken, mode)) return none();
        const key = await resolveRitaV3Key("groq", "GROQ_API_KEY");
        if (!key) return new Response("Rita key unavailable", { status: 503 });
        try {
          const provider = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-oss-120b",
              temperature: 0,
              max_completion_tokens: 800,
              reasoning_effort: "low",
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: JSON.stringify({ spoken, reply }) },
              ],
            }),
            signal: AbortSignal.timeout(8_000),
          });
          if (!provider.ok) return new Response("Correction unavailable", { status: 502 });
          const json = await provider.json();
          const parsed = JSON.parse(String(json?.choices?.[0]?.message?.content || "{}"));
          return Response.json(
            { correction: sanitizeCorrection(parsed?.correction) },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return new Response("Correction unavailable", { status: 502 });
        }
      },
    },
  },
});
