import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/rita/demo")({
  server: {
    handlers: {
      POST: async () =>
        Response.json(
          {
            error:
              "This legacy demo route is retired. Rita now uses the protected GPT-4o Mini pipeline.",
          },
          { status: 410, headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
