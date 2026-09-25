import { createFileRoute } from "@tanstack/react-router";
import { TodoBoard } from "@/components/study/TodoBoard";

export const Route = createFileRoute("/study/todo")({
  head: () => ({
    meta: [
      { title: "To-do list — RitaJet study workspace" },
      {
        name: "description",
        content: "A calm, oversized to-do board for your study days: inbox, today and upcoming.",
      },
      { property: "og:title", content: "To-do list — RitaJet study workspace" },
      {
        property: "og:description",
        content: "Plan the study day in three simple lists with big, readable tasks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TodoPage,
});

function TodoPage() {
  return <TodoBoard />;
}
