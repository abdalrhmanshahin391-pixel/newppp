import { createFileRoute } from "@tanstack/react-router";
import { RitaRealtimeV3 } from "@/components/rita/RitaRealtimeV3";

export const Route = createFileRoute("/rita-live")({
  head: () => ({
    meta: [
      { title: "Talk with Rita — RitaJet" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RitaRealtimeV3,
});
