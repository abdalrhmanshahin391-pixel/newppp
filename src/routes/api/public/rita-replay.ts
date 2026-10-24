import { createFileRoute } from "@tanstack/react-router";
import { authorizeWorkerRequest } from "@/lib/worker-auth.server";

/**
 * After the voice worker is deployed, replays the turns behind every issue being fixed. Called every
 * ten minutes with the private worker key; it does nothing until the worker's build changes.
 */
export const Route = createFileRoute("/api/public/rita-replay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authorizeWorkerRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { autoReplay } = await import("@/lib/rita-replay.server");
        const { ReviewError } = await import("@/lib/rita-review.server");
        try {
          const replay = await autoReplay(supabaseAdmin);
          // Nothing left to replay: use the quiet time to check the reviewer after its rules changed.
          const { autoReviewerCheck } = await import("@/lib/rita-golden.server");
          const check =
            replay.enabled && "tested" in replay && replay.tested === 0
              ? await autoReviewerCheck(supabaseAdmin)
              : { ran: false as const };
          return Response.json({ ...replay, reviewerCheck: check });
        } catch (error) {
          const status = error instanceof ReviewError ? error.status : 500;
          console.error("Rita replay run failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Replay failed" },
            { status },
          );
        }
      },
    },
  },
});
