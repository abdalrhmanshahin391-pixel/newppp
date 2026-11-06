// Server-only: works out which Gemini key to use.
// Order: the project secret first, then any key saved in admin_ai_keys.

export async function resolveGeminiKey(
  supabase: any,
  purpose: "questions" | "rita" | "aio" | "lecture" | "archive" | "summaries" | "german" | null = null,
): Promise<{ key: string; model: string | null }> {
  const { resolveGeminiKeyForTool } = await import("@/lib/ai-engine.server");
  return await resolveGeminiKeyForTool(supabase, purpose ?? "questions");
}

/** Turns raw provider errors into something a student can read. */
export function friendlyAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/429|quota|rate/i.test(raw)) return "Uzyra is busy right now — wait a minute and try again.";
  if (/401|403|API key|permission/i.test(raw)) return "Uzyra's question engine needs attention from the site owner.";
  if (/safety|blocked/i.test(raw)) return "Uzyra couldn't work with that page. Try a different one.";
  if (/empty|did not return valid JSON|no candidate/i.test(raw))
    return "Uzyra couldn't read that clearly. Try a sharper photo or a bit more text.";
  return "Something went wrong while building your questions. Please try again.";
}
