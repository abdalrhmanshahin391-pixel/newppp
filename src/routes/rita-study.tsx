import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { LanguageGate } from "@/components/language/LanguageGate";
import { LessonIntro } from "@/components/rita-study/LessonIntro";
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
  // The entering intro plays over the page while the lesson loads, then leaves.
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);

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

  if (!lesson) {
    return (
      <main
        className="edith-premium flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
        dir="rtl"
      >
        <p className="text-[17px] font-semibold">هاد الدرس مش متاح.</p>
        <Link to="/rita-lessons" className="rita-btn rita-btn-primary">
          رجوع للدروس
        </Link>
      </main>
    );
  }
  const failed = error || (result?.status === "unavailable" ? "هاد الدرس مش متاح." : "");
  const data = result?.status === "study" ? result.data : null;
  return (
    <>
      {data && <StudyPage key={`${lesson}:${preview ? 1 : 0}`} data={data} />}
      {!introDone && (
        <LessonIntro
          error={failed}
          lesson={
            data
              ? {
                  title: data.lesson.title,
                  titleAr: data.lesson.title_ar,
                  sections: data.guide.content.sections.length,
                }
              : null
          }
          onDone={finishIntro}
        />
      )}
    </>
  );
}
