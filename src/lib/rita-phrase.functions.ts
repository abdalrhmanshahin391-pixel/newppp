// Explains one word or phrase from the chat: language, Arabic translation and
// how it sounds. Signed-in users only, short input, and a per-user request limit
// because every call spends the site's AI budget.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import {
  MAX_PHRASE_CHARS,
  allowRequest,
  cleanPhrase,
  parseExplanation,
  type PhraseExplanation,
} from "@/lib/rita-phrase";

const SYSTEM = `You help Arabic-speaking learners of German and English.
Given one word or short phrase, answer with JSON only:
{"lang":"de"|"en"|"other","translation_ar":"...","pronunciation_ar":"...","tip_ar":"..."}
- lang: the language of the phrase (de = German, en = English).
- translation_ar: the meaning in simple Modern Standard Arabic, a few words.
- pronunciation_ar: how it sounds, written with Arabic letters (e.g. Guten Morgen -> غوتن مورغن).
- tip_ar: one short Arabic sentence about the hardest sound, or an empty string.
Never add anything outside the JSON.`;

const hits = new Map<string, number[]>();
const LIMIT = 30;
const WINDOW_MS = 60_000;

export const explainPhrase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ text: z.string().trim().min(1).max(400) }).parse(data),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; explanation: PhraseExplanation } | { ok: false; reason: string }> => {
      const phrase = cleanPhrase(data.text).slice(0, MAX_PHRASE_CHARS);
      if (!phrase) return { ok: false, reason: "empty" };
      if (!allowRequest(hits, context.userId, Date.now(), LIMIT, WINDOW_MS)) {
        return { ok: false, reason: "rate_limited" };
      }
      const key = process.env.LOVABLE_API_KEY;
      if (!key) return { ok: false, reason: "unavailable" };
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: phrase },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) {
          console.warn("Phrase explanation failed", response.status);
          return { ok: false, reason: response.status === 429 ? "rate_limited" : "failed" };
        }
        const json = await response.json();
        const explanation = parseExplanation(json?.choices?.[0]?.message?.content);
        return explanation ? { ok: true, explanation } : { ok: false, reason: "failed" };
      } catch (cause) {
        console.warn("Phrase explanation error", cause);
        return { ok: false, reason: "failed" };
      }
    },
  );
