// The admin check the guide functions share: the signed-in user must be an admin. It also hands the
// OpenAI key saved on the AI keys page to the AI module for this request, because the admin's own
// session can read it where the server has no service key (same approach as rita-curriculum.functions.ts).
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GuideDb = SupabaseClient<any, "public", any>;
export type GuideContext = { supabase: GuideDb; userId: string };

export async function assertGuideAdmin(ctx: GuideContext) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
  try {
    const { hasPrimedOpenAiKey, primeOpenAiKey } = await import("@/lib/rita-curriculum-ai.server");
    if (hasPrimedOpenAiKey()) return;
    for (const purpose of ["rita", "shared"]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row } = await (ctx.supabase.from as any)("admin_ai_keys")
        .select("api_key")
        .eq("provider", "openai")
        .eq("purpose", purpose)
        .eq("slot", 1)
        .maybeSingle();
      const saved = String(row?.api_key ?? "").trim();
      if (saved.length > 20) {
        primeOpenAiKey(saved);
        return;
      }
    }
  } catch {
    /* the AI call itself reports a missing key */
  }
}
