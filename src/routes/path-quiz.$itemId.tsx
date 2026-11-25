import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/study/RequireAuth";
import { PathQuizPage } from "@/components/rita-lessons/quiz-page/PathQuizPage";

// The quiz of a path quiz stop (Lecture Lab questions), on a page of its own.
export const Route = createFileRoute("/path-quiz/$itemId")({
  head: () => ({
    meta: [{ title: "اختبار — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  component: QuizRoute,
});

function QuizRoute() {
  const { itemId } = Route.useParams();
  return (
    <RequireAuth what="this quiz">
      <PathQuizPage itemId={itemId} />
    </RequireAuth>
  );
}
