import { createFileRoute } from "@tanstack/react-router";
import { LearnHome } from "@/components/learn/LearnHome";

export const Route = createFileRoute("/learn/")({
  head: () => ({
    meta: [
      { title: "Start Learning — RitaJet Study Hub" },
      {
        name: "description",
        content:
          "Talk to Rita and open every study tool from one place: flashcards, summaries, question bank, planner and German.",
      },
      { property: "og:title", content: "Start Learning — RitaJet Study Hub" },
      {
        property: "og:description",
        content: "Rita, your flashcards, your plan and every study tool in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LearnHome,
});
