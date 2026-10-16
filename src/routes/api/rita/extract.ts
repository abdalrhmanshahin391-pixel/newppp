import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";
import { classifyRitaLearningIntent } from "@/lib/rita-learning-intent";
import { guardItems, MAX_ITEMS_PER_TURN } from "@/lib/rita-learning-guard";
import { resolveRitaV3Key } from "@/lib/rita-v3.server";

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
        const key = await resolveRitaV3Key("groq", "GROQ_API_KEY");
        if (!key) return new Response("Rita key unavailable", { status: 503 });
        try {
          const provider = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-oss-120b",
              temperature: 0,
              max_completion_tokens: 1_200,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: `The deterministic gate classified this exchange as ${intent}. Extract ONLY the word, phrase or sentence the learner asked about (at most ${MAX_ITEMS_PER_TURN}), exactly as it appears in the exchange, with its meaning. Examples: "what does Guten Morgen mean" gives term "Guten Morgen" with the Arabic meaning; "how do we say صباح الخير in German" gives term "Guten Morgen" (the foreign word) with meaning "صباح الخير". Do not add other words from Rita's example sentences. Never extract general-knowledge concepts, people, wars, science, or ordinary conversation. Return JSON with learningItems (objects: term, meaning in the learner's language, language BCP-47 of the term, kind word|sentence, article der|die|das|null, plural string|null); saveRequest none|flashcards|german_lab; destinationName string only if the learner named a subject; rememberDestination boolean only when explicitly requested. If the learner did not ask about a specific word or phrase, learningItems is []. Never imply persistence.`,
                },
                { role: "user", content: JSON.stringify({ spoken, reply }) },
              ],
            }),
            signal: AbortSignal.timeout(12_000),
          });
          if (!provider.ok) return new Response("Learning extraction unavailable", { status: 502 });
          const json = await provider.json();
          const parsed = JSON.parse(String(json?.choices?.[0]?.message?.content || "{}"));
          // Nothing is accepted unless the term really occurs in this exchange.
          const learningItems = guardItems(parsed.learningItems, spoken, reply);
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
