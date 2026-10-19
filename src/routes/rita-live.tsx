import { createFileRoute } from "@tanstack/react-router";
import { RitaRealtimeV3 } from "@/components/rita/RitaRealtimeV3";

type RitaLiveSearch = { lesson?: string; conversation?: string; preview?: boolean };

export const Route = createFileRoute("/rita-live")({
  head: () => ({
    meta: [{ title: "Talk with Rita — RitaJet" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>): RitaLiveSearch => {
    const lesson = typeof search.lesson === "string" ? search.lesson.trim() : "";
    const conversation = typeof search.conversation === "string" ? search.conversation.trim() : "";
    // preview=1 (or true) marks an admin-only lesson preview; nothing is saved.
    const preview = search.preview === "1" || search.preview === "true" || search.preview === true;
    return {
      ...(/^[0-9a-f-]{36}$/i.test(lesson) ? { lesson } : {}),
      ...(!lesson && /^[0-9a-f-]{36}$/i.test(conversation) ? { conversation } : {}),
      ...(preview ? { preview: true } : {}),
    };
  },
  component: RitaLivePage,
});

function RitaLivePage() {
  const { lesson, conversation, preview } = Route.useSearch();
  // A new key remounts Rita when the learner moves on to the next lesson
  // (or when the same lesson switches between preview and live mode).
  return (
    <RitaRealtimeV3
      key={`${lesson ?? conversation ?? "free"}:${preview ? 1 : 0}`}
      lessonId={lesson}
      conversationId={conversation}
      preview={preview}
    />
  );
}
