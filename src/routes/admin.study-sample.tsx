import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
 * hidden practice lesson exists, then opens it as an admin preview. "Another guide" switches to a
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

  return (
    <main
      className="edith-premium flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
      dir="rtl"
    >
      {error ? (
        <>
          <p className="max-w-[28rem] text-[16px] font-semibold">{error}</p>
          <Link to="/admin" className="rita-btn rita-btn-primary">
            رجوع للإدارة
          </Link>
        </>
      ) : (
        <p role="status" className="flex items-center gap-2 text-[15px] text-[var(--pp-muted)]">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> جاري فتح النموذج…
        </p>
      )}
    </main>
  );
}
