import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LanguageGate } from "@/components/language/LanguageGate";
import { LessonIntro } from "@/components/rita-study/LessonIntro";
import { StudyPage } from "@/components/rita-study/StudyPage";
import { useAuth } from "@/hooks/useAuth";
import { forgetLesson, knownLesson, loadLesson } from "@/lib/study/lesson-entry";
import type { StudyPageResult } from "@/lib/study/study.functions";

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

/** How long the lesson may take to arrive before the intro offers to try again. */
const SLOW_MS = 12_000;

function RitaStudyRoute() {
  const { lesson, preview } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [result, setResult] = useState<StudyPageResult | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  // The entering intro plays over the page while the lesson loads, then leaves. The page itself is
  // built only once the intro's word is drawn (building it is heavy and would stall the drawing),
  // and the intro leaves once the page says its guide is drawn.
  const [introDone, setIntroDone] = useState(false);
  const [introDrawn, setIntroDrawn] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const drawn = useCallback(() => setIntroDrawn(true), []);
  const ready = useCallback(() => setPageReady(true), []);
  const retry = useCallback(() => {
    if (lesson) forgetLesson(lesson, Boolean(preview));
    setError("");
    setAttempt((value) => value + 1);
  }, [lesson, preview]);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  // The lesson loads straight away (the request carries the session saved in this browser), or is
  // already on its way from the tap in the lessons list. It never waits forever: after SLOW_MS the
  // intro says so and offers to try again.
  useEffect(() => {
    if (!lesson) return;
    let live = true;
    const slow = window.setTimeout(() => {
      if (live) setError("الدرس طوّل بالتحميل. تأكد من النت وجرّب كمان مرة.");
    }, SLOW_MS);
    loadLesson(lesson, Boolean(preview))
      .then((value) => {
        if (!live) return;
        window.clearTimeout(slow);
        setError("");
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
      .catch((cause) => {
        if (!live) return;
        window.clearTimeout(slow);
        setError(cause instanceof Error ? cause.message : "تعذّر فتح الدرس.");
      });
    return () => {
      live = false;
      window.clearTimeout(slow);
    };
  }, [attempt, lesson, navigate, preview]);

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
  const data = result?.status === "study" ? result.data : null;
  // Signed out: the sign-in page takes over, so no error flashes on the intro first.
  const failed =
    !user && !loading
      ? ""
      : error || (result?.status === "unavailable" ? "هاد الدرس مش متاح." : "");
  const known = knownLesson(lesson);
  const shown = data
    ? {
        title: data.lesson.title,
        titleAr: data.lesson.title_ar,
        sections: data.guide.content.sections.length,
      }
    : known
      ? { title: known.title, titleAr: known.titleAr, sections: 0 }
      : null;
  return (
    <>
      {data && (introDrawn || introDone) && (
        <StudyPage key={`${lesson}:${preview ? 1 : 0}`} data={data} onReady={ready} />
      )}
      {!introDone && (
        <LessonIntro
          error={failed}
          lesson={shown}
          loaded={Boolean(data)}
          pageReady={pageReady}
          onDrawn={drawn}
          onRetry={error && !result ? retry : undefined}
          onDone={finishIntro}
        />
      )}
    </>
  );
}
