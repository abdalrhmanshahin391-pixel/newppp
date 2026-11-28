/**
 * Emith (Groq) requests a month, by plan (20261128020000_groq_voice_plan_quotas.sql). Every written
 * answer from Uzyra's model counts once: a book explanation or translation, an exercise check, a
 * word game round, a whiteboard step. Voice calls are counted in minutes instead, so nothing here
 * runs for them. Take one right before the model is asked, with the learner's own Supabase client.
 *
 * The counter is the gate: when it cannot be reached (after one retry) the request does not go
 * ahead, so no answer is ever given uncounted. Admins are never held back, even then.
 */

export const GROQ_REQUESTS_USED_TEXT =
  "خلصت طلبات Emith تبعتك لهالشهر. بترجع أول الشهر، أو كبّر باقتك من صفحة الأسعار.";

export const GROQ_REQUESTS_UNAVAILABLE_TEXT = "ما قدرنا نحسب طلبك هلأ. جرّب كمان شوي.";

type RpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  // The learner's own client can read the learner's own roles (as the site does at sign-in).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from?: (table: string) => any;
};

/** Whether the learner is an admin, read with their own client (no server-only imports here). */
async function isAdminLearner(supabase: RpcClient, userId: string): Promise<boolean> {
  try {
    if (!supabase.from) return false;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export type GroqRequestOutcome =
  | { ok: true }
  | { ok: false; reason: "used" | "unavailable"; message: string };

/** Take one request for the signed-in learner. */
export async function takeGroqRequestFor(context: {
  supabase: RpcClient;
  userId?: string;
}): Promise<GroqRequestOutcome> {
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await context.supabase.rpc("groq_request_take");
    if (!error) return { ok: true };
    last = String((error as { message?: unknown })?.message ?? error);
    if (/groq_requests_used/.test(last))
      return { ok: false, reason: "used", message: GROQ_REQUESTS_USED_TEXT };
  }
  console.error("Emith request counter unavailable", last.slice(0, 200));
  if (context.userId && (await isAdminLearner(context.supabase, context.userId)))
    return { ok: true };
  return { ok: false, reason: "unavailable", message: GROQ_REQUESTS_UNAVAILABLE_TEXT };
}

/** True when the request may go ahead (kept for callers that only need yes or no). */
export async function takeGroqRequest(context: {
  supabase: RpcClient;
  userId?: string;
}): Promise<boolean> {
  return (await takeGroqRequestFor(context)).ok;
}
