import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getLessonPath, type PathLesson, type ReviewSuggestion } from "@/lib/rita-curriculum.functions";
import { LessonPathView } from "@/components/rita-lessons/LessonPathView";

export const Route = createFileRoute("/rita-lessons")({
  head: () => ({
    meta: [{ title: "دروس ريتا — RitaJet" }, { name: "robots", content: "noindex" }],
  }),
  component: RitaLessonsPage,
});

function RitaLessonsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const pathFn = useServerFn(getLessonPath);
  const [lessons, setLessons] = useState<PathLesson[] | null>(null);
  const [reviews, setReviews] = useState<ReviewSuggestion[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    pathFn()
      .then((result) => {
        setLessons(result.lessons);
        setReviews(result.reviews);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "تعذّر تحميل الدروس."));
  }, [pathFn, user]);

  return (
    <LessonPathView
      lessons={lessons}
      reviews={reviews}
      error={error}
      onOpenLesson={(lesson) => void navigate({ to: "/rita-live", search: { lesson: lesson.id } })}
    />
  );
}
