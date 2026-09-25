import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser, resolveRitaOpenAiKey } from "@/lib/rita-voice.server";

export const Route = createFileRoute("/api/rita/summarize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const previous = String(body?.previous ?? "")
          .trim()
          .slice(0, 800);
        const turns = Array.isArray(body?.turns)
          ? body.turns.slice(-12).map((item: unknown) => String(item ?? "").slice(0, 500))
          : [];
        if (!turns.length) return Response.json({ summary: previous });
        const key = await resolveRitaOpenAiKey();
        if (!key) return new Response("OpenAI unavailable", { status: 503 });
        const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0,
            max_tokens: 140,
            messages: [
              {
                role: "system",
                content:
                  "Compress the language lesson into one short plain-text memory. Keep only the learner's goal, stable language/dialect, recurring corrections, and words they struggled with. No sensitive data, transcript, headings, or commentary.",
              },
              { role: "user", content: JSON.stringify({ previous, turns }) },
            ],
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!upstream.ok) return new Response("Summary unavailable", { status: 502 });
        const result = (await upstream.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const summary = String(result.choices?.[0]?.message?.content ?? "")
          .trim()
          .slice(0, 800);
        return Response.json({ summary }, { headers: { "Cache-Control": "private, no-store" } });
      },
    },
  },
});
