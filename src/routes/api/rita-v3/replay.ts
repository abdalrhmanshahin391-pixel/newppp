import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import { requireRitaUser } from "@/lib/rita-voice.server";

/** "Test on the current version": replays the turns behind one issue now (admin only). */
const BUDGET_MS = 120_000;

export const Route = createFileRoute("/api/rita-v3/replay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const issueId = String(body.issueId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(issueId)) return Response.json({ ok: false }, { status: 400 });
        const { url, publishableKey } = getSupabasePublicConfig();
        // The admin's own session: the database decides what they may read and write.
        const db = createClient(url, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${auth.token}` } },
        });
        const { data: isAdmin } = await db.rpc("has_role", {
          _user_id: auth.userId,
          _role: "admin",
        });
        if (!isAdmin) return Response.json({ ok: false, reason: "not_admin" }, { status: 403 });
        const { testIssue } = await import("@/lib/rita-replay.server");
        const { ReviewError } = await import("@/lib/rita-review.server");
        try {
          const result = await testIssue(db, {
            issueId,
            trigger: "manual",
            deadlineAt: Date.now() + BUDGET_MS,
          });
          return Response.json({
            ok: result.status !== "none" && result.status !== "failed",
            ...result,
          });
        } catch (error) {
          const status = error instanceof ReviewError ? error.status : 500;
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Replay failed" },
            { status },
          );
        }
      },
    },
  },
});
