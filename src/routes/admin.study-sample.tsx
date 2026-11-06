import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { LessonIntro } from "@/components/rita-study/LessonIntro";
import { useAuth } from "@/hooks/useAuth";
import { adminStudySample } from "@/lib/study/study.functions";

type SampleSearch = { another?: boolean };

export const Route = createFileRoute("/admin/study-sample")({
  head: () => ({
    meta: [{ title: "نموذج صفحة الدراسة — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>): SampleSearch => ({
    ...(search.another === true || search.another === "1" || search.another === "true"
      ? { another: true }
      : {}),
  }),
  component: StudySample,
});

/**
 * The admin's way in to the study page (the guide on the right, Rita on the left): it makes sure the
 * hidden practice lesson exists, then opens it as an admin preview, under the lesson intro. "Another guide" switches to a
 * different hand-written sample. Nothing is saved for learners and the AI is never called.
 */
function StudySample() {
  const { isAdmin, loading } = useAuth();
  const { another } = Route.useSearch();
  const navigate = useNavigate();
  const sampleFn = useServerFn(adminStudySample);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (loading || started.current) return;
    if (!isAdmin) {
      setError("هاي الصفحة للأدمن بس.");
      return;
    }
    started.current = true;
    sampleFn({ data: { another: Boolean(another) } })
      .then(({ lessonId }) =>
        navigate({ to: "/rita-study", search: { lesson: lessonId, preview: true }, replace: true }),
      )
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "ما قدرنا نفتح النموذج."),
      );
  }, [another, isAdmin, loading, navigate, sampleFn]);

  // The lesson intro starts here while the sample is prepared; the lesson page carries it on.
  return <LessonIntro lesson={null} error={error} backTo="/admin" backLabel="رجوع للإدارة" />;
}
