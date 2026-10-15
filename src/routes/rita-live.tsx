import { createFileRoute } from "@tanstack/react-router";
import { RitaRealtimeV3 } from "@/components/rita/RitaRealtimeV3";

type RitaLiveSearch = { lesson?: string; preview?: boolean };

export const Route = createFileRoute("/rita-live")({
  head: () => ({
    meta: [
      { title: "Talk with Rita — RitaJet" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): RitaLiveSearch => {
    const lesson = typeof search.lesson === "string" ? search.lesson.trim() : "";
    // preview=1 (or true) marks an admin-only lesson preview; nothing is saved.
    const preview =
      search.preview === "1" || search.preview === "true" || search.preview === true;
    return {
      ...( /^[0-9a-f-]{36}$/i.test(lesson) ? { lesson } : {}),
      ...(preview ? { preview: true } : {}),
    };
  },
  component: RitaLivePage,
});

function RitaLivePage() {
  const { lesson, preview } = Route.useSearch();
  // A new key remounts Rita when the learner moves on to the next lesson
  // (or when the same lesson switches between preview and live mode).
  return (
    <RitaRealtimeV3
      key={`${lesson ?? "free"}:${preview ? 1 : 0}`}
      lessonId={lesson}
      preview={preview}
    />
  );
}
