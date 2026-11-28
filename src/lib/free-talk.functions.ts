import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import type { GroqRequestStatus } from "@/lib/groq-requests";

export const myFreeTalkBudget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { freeTalkBudgetForPage } = await import("./free-talk.server");
    return freeTalkBudgetForPage(context.userId);
  });

/** This month's Emith requests for the signed-in learner, read without taking one. */
export const myGroqRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GroqRequestStatus> => {
    const { data, error } = await (context.supabase as any).rpc("groq_request_status");
    if (!error && data) return data as GroqRequestStatus;
    const { isVoiceAdmin } = await import("./free-talk.server");
    if (await isVoiceAdmin(context.userId))
      return {
        unlimited: true,
        plan: "admin",
        used: null,
        limit: null,
        left: null,
        period: "",
        resetsAt: null,
      };
    console.error(
      "Emith request status unavailable",
      String(error?.message ?? error).slice(0, 200),
    );
    throw new Error("groq_requests_unavailable");
  });
