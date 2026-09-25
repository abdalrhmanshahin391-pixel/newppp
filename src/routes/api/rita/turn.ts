import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/rita/turn")({
  server: {
    handlers: {
      POST: () =>
        Response.json(
          {
            code: "rita_legacy_retired",
            stage: "legacy_blocked",
            error:
              "The upload-and-wait Rita pipeline is retired. Economic v2 must be repaired in place; no fallback was attempted.",
            retryable: false,
          },
          { status: 410, headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
