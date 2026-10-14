import { createFileRoute } from "@tanstack/react-router";
import { RitaRealtimeV3 } from "@/components/rita/RitaRealtimeV3";

type RitaLiveSearch = { lesson?: string };

export const Route = createFileRoute("/rita-live")({
  head: () => ({
    meta: [
      { title: "Talk with Rita — RitaJet" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): RitaLiveSearch => {
    const lesson = typeof search.lesson === "string" ? search.lesson.trim() : "";
    return /^[0-9a-f-]{36}$/i.test(lesson) ? { lesson } : {};
  },
  component: RitaLivePage,
});

function RitaLivePage() {
  const { lesson } = Route.useSearch();
  // A new key remounts Rita when the learner moves on to the next lesson.
  return <RitaRealtimeV3 key={lesson ?? "free"} lessonId={lesson} />;
}
