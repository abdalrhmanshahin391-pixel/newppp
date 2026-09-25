import { createFileRoute } from "@tanstack/react-router";

// This page was retired. Answer 410 Gone so search engines drop the old
// listing instead of treating it as a temporary error.
export const Route = createFileRoute("/about")({
  server: {
    handlers: {
      GET: async () =>
        new Response("This page is no longer available.", {
          status: 410,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Robots-Tag": "noindex",
            "Cache-Control": "no-store",
          },
        }),
    },
  },
});
