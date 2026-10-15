import { createFileRoute } from "@tanstack/react-router";
import { RitaHub } from "@/components/rita-hub/RitaHub";

export const Route = createFileRoute("/rita")({
  head: () => ({
    meta: [
      { title: "Rita — Choose how to practise" },
      {
        name: "description",
        content: "Practise out loud with Rita: a free conversation or guided lessons.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RitaHub,
});
