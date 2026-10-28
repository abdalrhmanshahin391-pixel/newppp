import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import { requireRitaUser } from "@/lib/rita-voice.server";

/**
 * The admin's "review now" for one conversation, in small steps: each call reviews at most two
 * replies (side by side), or does the closing work once none are left, and says how far it got.
 * The page calls again until it is finished, so no single request runs for minutes.
 */
const BUDGET_MS = 60_000;
const TURNS_PER_STEP = 2;

export const Route = createFileRoute("/api/rita-v3/review")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const conversationId = String(body.conversationId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(conversationId)) {
          return Response.json({ ok: false }, { status: 400 });
        }
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
        const { reviewConversation, reviewEnabled, ReviewError } =
          await import("@/lib/rita-review.server");
        try {
          if (!(await reviewEnabled(db))) return Response.json({ ok: true, enabled: false });
          const summary = await reviewConversation(db, {
            conversationId,
            deadlineAt: Date.now() + BUDGET_MS,
            maxTurns: TURNS_PER_STEP,
          });
          return Response.json({ ok: true, enabled: true, ...summary });
        } catch (error) {
          const status = error instanceof ReviewError ? error.status : 500;
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Review failed" },
            { status },
          );
        }
      },
    },
  },
});
