import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/rita/usage")({
  server: {
    handlers: {
      POST: () =>
        Response.json(
          {
            code: "rita_legacy_retired",
            stage: "legacy_blocked",
            error:
              "The old Realtime usage route is retired. Economic v2 records usage inside its response pipeline.",
            retryable: false,
          },
          { status: 410, headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
