/* eslint-disable @typescript-eslint/no-explicit-any -- migration types are generated after deployment. */
import { createFileRoute } from "@tanstack/react-router";
import { requireRitaUser } from "@/lib/rita-voice.server";

export const Route = createFileRoute("/api/rita/preferences")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await (supabaseAdmin.from as any)("rita_user_preferences")
            .select("active_language,active_dialect,auto_save_words")
            .eq("user_id", auth.userId)
            .maybeSingle();
          return Response.json({
            language: String(data?.active_language ?? "unknown"),
            dialect: String(data?.active_dialect ?? "standard"),
            autoSaveWords: data?.auto_save_words !== false,
          });
        } catch {
          return Response.json({ language: "unknown", dialect: "standard" });
        }
      },
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const language = String(body?.language ?? "unknown").slice(0, 20);
        const dialect = String(body?.dialect ?? "standard").slice(0, 40);
        const autoSaveWords = body?.autoSaveWords;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const row: Record<string, unknown> = {
            user_id: auth.userId,
            active_language: language,
            active_dialect: dialect,
            updated_at: new Date().toISOString(),
          };
          if (typeof autoSaveWords === "boolean") row.auto_save_words = autoSaveWords;
          const { error } = await (supabaseAdmin.from as any)("rita_user_preferences").upsert(row);
          if (error) throw error;
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: false }, { status: 503 });
        }
      },
    },
  },
});
