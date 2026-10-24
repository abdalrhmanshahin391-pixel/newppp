import { createFileRoute } from "@tanstack/react-router";
import { authorizeWorkerRequest } from "@/lib/worker-auth.server";

/**
 * Reviews Rita's turns after the call. Called on a schedule with the private worker key.
 */
export const Route = createFileRoute("/api/public/rita-review")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authorizeWorkerRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runScheduledReview, ReviewError } = await import("@/lib/rita-review.server");
        try {
          return Response.json(await runScheduledReview(supabaseAdmin));
        } catch (error) {
          const status = error instanceof ReviewError ? error.status : 500;
          console.error("Rita review run failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Review failed" },
            { status },
          );
        }
      },
    },
  },
});
