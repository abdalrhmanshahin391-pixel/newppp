import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => Response.json(
        { ok: true, service: "ritajet", time: new Date().toISOString() },
        { headers: { "cache-control": "no-store" } },
      ),
    },
  },
});