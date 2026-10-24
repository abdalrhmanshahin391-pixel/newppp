import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import { requireRitaUser } from "@/lib/rita-voice.server";

/** "Check the reviewer": reviews the fixed set of replies with known answers (admin only). */
const BUDGET_MS = 200_000;

export const Route = createFileRoute("/api/rita-v3/reviewer-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { url, publishableKey } = getSupabasePublicConfig();
        const db = createClient(url, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${auth.token}` } },
        });
        const { data: isAdmin } = await db.rpc("has_role", {
          _user_id: auth.userId,
          _role: "admin",
        });
        if (!isAdmin) return Response.json({ ok: false, reason: "not_admin" }, { status: 403 });
        const { runReviewerCheck } = await import("@/lib/rita-golden.server");
        try {
          const result = await runReviewerCheck(db, {
            trigger: "manual",
            deadlineAt: Date.now() + BUDGET_MS,
          });
          return Response.json({ ok: result.status !== "failed", ...result });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "The check failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
