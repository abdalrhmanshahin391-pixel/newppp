import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";
import { resolveRitaGroqConfig, ritaGroqReasoningFields } from "@/lib/rita-groq.server";
import { classifyRitaLearningIntent } from "@/lib/rita-learning-intent";

export const Route = createFileRoute("/api/rita/extract")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const data = await request.json().catch(() => null);
        const spoken = String(data?.spoken ?? "")
          .trim()
          .slice(0, 600);
        const reply = String(data?.reply ?? "")
          .trim()
          .slice(0, 900);
        if (!spoken || !reply) return Response.json({ learningItems: [], saveRequest: "none" });
        const intent = classifyRitaLearningIntent(spoken);
        if (intent === "none") return Response.json({ learningItems: [], saveRequest: "none" });
        const groq = await resolveRitaGroqConfig();
        const key = groq?.key;
        if (!key) return new Response("Rita key unavailable", { status: 503 });
        try {
          const provider = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-oss-20b",
            ...ritaGroqReasoningFields("openai/gpt-oss-20b"),
              temperature: 0,
              max_tokens: 1_200,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: `The deterministic gate classified this exchange as ${intent}. Extract only genuine language-learning material from the actual exchange. Valid: an explicit translation, word/sentence meaning, requested target-language vocabulary list, or explicit save to Flashcards/German Lab. Never extract general-knowledge concepts, people, wars, science explanations, or ordinary conversation. Extract ONLY the word or phrase the learner actually asked about (or explicitly requested sentences). Example sentences the tutor added to illustrate a word are NOT items: put them in that word's example field instead. Return JSON with learningItems (up to 20 objects: term, meaning (Arabic/learner language), language BCP-47, kind word|sentence, article der|die|das|null, plural string|null, example string|null, exampleMeaning string|null); saveRequest none|flashcards|german_lab; destinationName string only if user named it; rememberDestination boolean only when explicitly requested. If no valid language item was taught, learningItems is []. Never imply persistence.`,
                },
                { role: "user", content: JSON.stringify({ spoken, reply }) },
              ],
            }),
            signal: AbortSignal.timeout(12_000),
          });
          if (!provider.ok) return new Response("Learning extraction unavailable", { status: 502 });
          const json = await provider.json();
          const parsed = JSON.parse(String(json?.choices?.[0]?.message?.content || "{}"));
          const learningItems = (Array.isArray(parsed.learningItems) ? parsed.learningItems : [])
            .slice(0, 20)
            .flatMap((item: Record<string, unknown>) => {
              const term = String(item.term ?? "")
                .trim()
                .slice(0, 180);
              const meaning = String(item.meaning ?? "")
                .trim()
                .slice(0, 280);
              const language = String(item.language ?? "")
                .trim()
                .slice(0, 30);
              if (!term || !meaning || !/^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(language)) return [];
              return [
                {
                  term,
                  meaning,
                  language,
                  kind: item.kind === "sentence" ? "sentence" : "word",
                  article:
                    language.startsWith("de") &&
                    ["der", "die", "das"].includes(String(item.article))
                      ? item.article
                      : null,
                  plural: item.plural ? String(item.plural).slice(0, 120) : null,
                  example: item.example ? String(item.example).slice(0, 240) : null,
                  exampleMeaning: item.exampleMeaning ? String(item.exampleMeaning).slice(0, 240) : null,
                },
              ];
            });
          return Response.json(
            {
              learningItems,
              saveRequest: ["flashcards", "german_lab"].includes(parsed.saveRequest)
                ? parsed.saveRequest
                : "none",
              destinationName: String(parsed.destinationName ?? "").slice(0, 100),
              rememberDestination: parsed.rememberDestination === true,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return new Response("Learning extraction unavailable", { status: 502 });
        }
      },
    },
  },
});
