/**
 * Groq requests a month, by plan (see 20261126190000_groq_request_quota.sql). Every written answer
 * from Uzyra's model counts once: a book explanation or translation, an exercise check, a word game
 * round, a whiteboard step. Voice calls are counted in minutes instead, so nothing here runs for
 * them. Call it with the learner's own Supabase client, right before the model is asked.
 */

export const GROQ_REQUESTS_USED_TEXT =
  "خلصت طلبات Groq تبعتك لهالشهر. بترجع أول الشهر، أو كبّر باقتك من صفحة الأسعار.";

/** True when the request may go ahead; false when this month's requests are used up. */
export async function takeGroqRequest(supabase: {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
}): Promise<boolean> {
  const { error } = await supabase.rpc("groq_request_take");
  if (!error) return true;
  const message = String((error as { message?: unknown })?.message ?? error);
  if (/groq_requests_used/.test(message)) return false;
  // The counter itself failed (not set up yet, or the database is busy): the learner is not
  // blocked for our fault. The worst case is one uncounted request.
  console.warn("Groq request counter unavailable", message.slice(0, 200));
  return true;
}
