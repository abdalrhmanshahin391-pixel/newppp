import { createFileRoute } from "@tanstack/react-router";
import { authorizeWorkerRequest } from "@/lib/worker-auth.server";

/**
 * Drains scheduled notifications. Called on a schedule with a private worker key.
 */
export const Route = createFileRoute("/api/public/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authorizeWorkerRequest(request);
        if (denied) return denied;


        const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
        const { deliverMessage } = await import("@/lib/push.server");
        const { data } = await (supabaseAdmin.from as any)("push_messages")
          .select("*")
          .eq("status", "scheduled")
          .lte("scheduled_at", new Date().toISOString())
          .limit(5);

        let handled = 0;
        for (const m of (data ?? []) as any[]) {
          await (supabaseAdmin.from as any)("push_messages").update({ status: "sending" }).eq("id", m.id);
          await deliverMessage(m.id, m, m.audience_group_ids ?? []);
          handled++;
        }
        return Response.json({ handled });
      },
    },
  },
});
