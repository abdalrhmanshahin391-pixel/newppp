import { createFileRoute } from "@tanstack/react-router";
import { LearnDoors } from "@/components/learn/LearnDoors";

export const Route = createFileRoute("/learn/")({
  head: () => ({
    meta: [
      { title: "Start Learning — RitaJet Study Hub" },
      {
        name: "description",
        content:
          "Three rooms to study in: My Study Space, Study Room and German. Pick one and open your tools.",
      },
      { property: "og:title", content: "Start Learning — RitaJet Study Hub" },
      {
        property: "og:description",
        content: "My Study Space, Study Room and German — pick a room and open your study tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LearnDoors,
});
