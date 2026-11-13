// A Wordcraft round for a signed-in learner: Groq suggests words for the chosen level, the engine
// in round.ts keeps the good ones and builds a grid with exactly one answer. When the AI cannot
// help (no key, busy, slow, a bad answer, words that make no good grid) the round comes from the
// built-in list instead, so the game always starts. Nothing is stored.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { askPracticeModel } from "@/lib/study/study-practice";
import {
  buildRound,
  cleanCandidates,
  LEVEL_IDS,
  listRound,
  roundSystemPrompt,
  roundUserMessage,
  THEMES,
  type Level,
  type Round,
} from "./round";

const RoundInput = z.object({
  level: z.enum(LEVEL_IDS as [Level, ...Level[]]),
  avoid: z
    .array(z.string().regex(/^[A-Z]{2,12}$/))
    .max(60)
    .default([]),
});

export type RoundResult = {
  round: Round;
  /** Why the words came from the built-in list (absent when the AI made them). */
  fallback?: "no_key" | "busy" | "slow" | "failed" | "too_soon" | "no_grid";
};

// One AI round per learner every few seconds on this server (not shared between servers).
const lastAsk = new Map<string, number>();
const GAP_MS = 3_000;

function tooSoon(userId: string): boolean {
  const now = Date.now();
  const last = lastAsk.get(userId) ?? 0;
  if (now - last < GAP_MS) return true;
  lastAsk.set(userId, now);
  if (lastAsk.size > 5_000)
    for (const [id, at] of lastAsk) if (now - at > 60_000) lastAsk.delete(id);
  return false;
}

export const wordcraftRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const result = RoundInput.safeParse(data);
    if (!result.success) throw new Error("Bad request.");
    return result.data;
  })
  .handler(async ({ data, context }): Promise<RoundResult> => {
    const fallback = (reason: NonNullable<RoundResult["fallback"]>): RoundResult => ({
      round: listRound(data.level, undefined, data.avoid),
      fallback: reason,
    });
    if (tooSoon(String(context.userId))) return fallback("too_soon");
    const { resolveRitaV3Key } = await import("@/lib/rita-v3.server");
    const key = await resolveRitaV3Key("groq", "GROQ_API_KEY");
    if (!key) {
      console.warn("Wordcraft: no Groq key reachable from the website (GROQ_API_KEY secret).");
      return fallback("no_key");
    }
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const asked = await askPracticeModel({
      fetch: (input, init) => fetch(input, init),
      key,
      system: roundSystemPrompt(),
      user: roundUserMessage(data.level, theme, data.avoid),
      maxTokens: 3000,
      budgetMs: 25_000,
    });
    if (!asked.ok) return fallback(asked.reason);
    const candidates = cleanCandidates(asked.reply, data.level).filter(
      (c) => !data.avoid.includes(c.word),
    );
    const round = buildRound(candidates, data.level, "ai");
    if (!round) {
      console.warn(
        `Wordcraft: ${candidates.length} usable AI words for ${data.level} made no good grid.`,
      );
      return fallback("no_grid");
    }
    return { round };
  });
