import { createFileRoute } from "@tanstack/react-router";

function retired() {
  return Response.json(
    {
      code: "rita_legacy_retired",
      stage: "legacy_blocked",
      error:
        "This old Realtime route is retired. Rita uses Economic v2 only; no fallback was attempted.",
      retryable: false,
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/rita/live")({
  server: { handlers: { POST: retired } },
});
