import { createFileRoute } from "@tanstack/react-router";
import { SectionPage } from "@/components/learn/SectionPage";
import { RequireAuth } from "@/components/study/RequireAuth";

export const Route = createFileRoute("/learn/study-space")({
  head: () => ({
    meta: [
      { title: "My Study Space — RitaJet" },
      {
        name: "description",
        content:
          "Your own flashcards, memory lab, PDF summaries, to-do list, exam schedule and AI study tools.",
      },
      { property: "og:title", content: "My Study Space — RitaJet" },
      {
        property: "og:description",
        content: "Flashcards, summaries, planner and AI study tools that belong only to you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth what="your study space">
      <SectionPage id="study-space" />
    </RequireAuth>
  ),
});
