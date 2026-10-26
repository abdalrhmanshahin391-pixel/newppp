import { createFileRoute } from "@tanstack/react-router";
import { SectionPage } from "@/components/learn/SectionPage";
import { RequireAuth } from "@/components/study/RequireAuth";

export const Route = createFileRoute("/learn/study-room")({
  head: () => ({
    meta: [
      { title: "Study Room — Uzyra" },
      {
        name: "description",
        content: "Shared flashcards, classrooms and study groups on Uzyra.",
      },
      { property: "og:title", content: "Study Room — Uzyra" },
      {
        property: "og:description",
        content: "Share decks, join your classroom and study with your group.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth what="the study room">
      <SectionPage id="study-room" />
    </RequireAuth>
  ),
});
