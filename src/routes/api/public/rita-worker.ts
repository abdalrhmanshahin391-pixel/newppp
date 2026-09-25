import { createFileRoute } from "@tanstack/react-router";
import { authorizeWorkerRequest } from "@/lib/worker-auth.server";

/**
 * Background worker for Rita AI Model 3.8. Called on a schedule with a private
 * worker key. Bounded work per run: one job, a couple of new pieces, guarded by
 * a lease so runs never overlap.
 */
export const Route = createFileRoute("/api/public/rita-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authorizeWorkerRequest(request);
        if (denied) return denied;


        const { runRitaWorker } = await import("@/lib/rita-ai-38.worker.server");
        try {
          const result = await runRitaWorker(2);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
