import { createFileRoute } from "@tanstack/react-router";
import { authorizeWorkerRequest } from "@/lib/worker-auth.server";

/**
 * Background worker for the Archive Solver. Called on a schedule with a private
 * worker key. Bounded work per run: one job, two chunks, guarded by a lease so
 * runs never overlap.
 */
export const Route = createFileRoute("/api/public/archive-solver")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authorizeWorkerRequest(request);
        if (denied) return denied;


        const { runArchiveWorker } = await import("@/lib/archive-solver.server");
        try {
          const result = await runArchiveWorker(2);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
