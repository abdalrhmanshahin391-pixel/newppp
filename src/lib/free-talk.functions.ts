import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
export const myFreeTalkBudget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { freeTalkBudget } = await import("./free-talk.server");
    return freeTalkBudget(context.userId);
  });
