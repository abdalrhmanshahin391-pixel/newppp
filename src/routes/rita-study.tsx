import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { LanguageGate } from "@/components/language/LanguageGate";
import { StudyPage } from "@/components/rita-study/StudyPage";
import { useAuth } from "@/hooks/useAuth";
import { getStudyLesson, type StudyPageResult } from "@/lib/study/study.functions";

type StudySearch = { lesson?: string; preview?: boolean };

export const Route = createFileRoute("/rita-study")({
  head: () => ({
    meta: [{ title: "دراسة تفاعلية — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>): StudySearch => {
    const lesson = typeof search.lesson === "string" ? search.lesson.trim() : "";
    // preview=1 is an admin's "preview as a learner": checked on the server, nothing is saved.
    const preview = search.preview === "1" || search.preview === "true" || search.preview === true;
    return {
      ...(/^[0-9a-f-]{36}$/i.test(lesson) ? { lesson } : {}),
      ...(preview ? { preview: true } : {}),
    };
  },
  component: () => (
    <LanguageGate>
      <RitaStudyRoute />
    </LanguageGate>
  ),
});

function RitaStudyRoute() {
  const { lesson, preview } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const loadFn = useServerFn(getStudyLesson);
  const [result, setResult] = useState<StudyPageResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user || !lesson) return;
    loadFn({ data: { lessonId: lesson, preview: Boolean(preview) } })
      .then((value) => {
        // A lesson that opens as the current lesson (switch off, no guide yet...) goes there.
        if (value.status === "classic") {
          void navigate({
            to: "/rita-live",
            search: { lesson, ...(preview ? { preview: true } : {}) },
            replace: true,
          });
          return;
        }
        setResult(value);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "تعذّر فتح الدرس."));
  }, [lesson, loadFn, navigate, preview, user]);

  if (!lesson || error || result?.status === "unavailable") {
    return (
      <main
        className="edith-premium flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
        dir="rtl"
      >
        <p className="text-[17px] font-semibold">{error || "هاد الدرس مش متاح."}</p>
        <Link to="/rita-lessons" className="rita-btn rita-btn-primary">
          رجوع للدروس
        </Link>
      </main>
    );
  }
  if (!result || result.status !== "study") {
    return (
      <main className="flex min-h-screen items-center justify-center" dir="rtl">
        <p role="status" className="flex items-center gap-2 text-[15px] text-[var(--pp-muted)]">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> جاري فتح الدرس…
        </p>
      </main>
    );
  }
  return <StudyPage key={`${lesson}:${preview ? 1 : 0}`} data={result.data} />;
}
