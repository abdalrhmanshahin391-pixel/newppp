import { createFileRoute } from "@tanstack/react-router";
import { getSupabasePublicConfig, LOVABLE_CLOUD_PROJECT_ID } from "@/integrations/supabase/config";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        let backendConnected = false;
        try {
          const config = getSupabasePublicConfig();
          backendConnected = config.projectId === LOVABLE_CLOUD_PROJECT_ID;
        } catch {
          backendConnected = false;
        }
        return Response.json(
          {
            ok: backendConnected,
            service: "ritajet",
            backend: "lovable-cloud",
            projectId: LOVABLE_CLOUD_PROJECT_ID,
            time: new Date().toISOString(),
          },
          {
            status: backendConnected ? 200 : 503,
            headers: { "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
