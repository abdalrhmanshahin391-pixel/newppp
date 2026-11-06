import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LETTERS } from "@/components/language/LanguageSplash";

/** How long the word takes to draw before the lesson's own lines may come in. */
const DRAWN_MS = 1500;
/** How long the lesson's title stays before the intro leaves. */
const HOLD_MS = 1400;
/** The intro's own exit (opacity and a slight grow). */
const LEAVE_MS = 450;
const REDUCED_MS = 900;

export type IntroLesson = { title: string; titleAr: string; sections: number };

/**
 * Entering a lesson: the same picture as the language change (UZYRA drawn in fine lines on deep
 * navy, a hairline opening under it), then the lesson itself rolls in (its title in English and
 * Arabic, and one small dot per section of its guide lighting up in turn). While the lesson is still
 * loading the hairline breathes; when it is ready the intro holds a moment, then fades away over the
 * study page, which has been loading underneath. It replaces the old "opening the lesson…" spinner.
 */
export function LessonIntro({
  lesson,
  error,
  onDone,
}: {
  /** Null while the lesson is loading. */
  lesson: IntroLesson | null;
  /** A message when the lesson cannot open: shown on the intro with a way back. */
  error: string;
  onDone: () => void;
}) {
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [drawn, setDrawn] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDrawn(true), reduced ? 0 : DRAWN_MS);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  const showLesson = drawn && Boolean(lesson) && !error;

  // Ready and shown: hold a moment, then leave, then hand the page over.
  useEffect(() => {
    if (!showLesson) return;
    const hold = window.setTimeout(() => setLeaving(true), reduced ? REDUCED_MS : HOLD_MS);
    return () => window.clearTimeout(hold);
  }, [reduced, showLesson]);
  useEffect(() => {
    if (!leaving) return;
    const done = window.setTimeout(onDone, reduced ? 150 : LEAVE_MS);
    return () => window.clearTimeout(done);
  }, [leaving, onDone, reduced]);

  return (
    <div
      className="uz-splash uz-lintro"
      data-tone="dark"
      data-waiting={drawn && !lesson && !error ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      role="status"
      aria-live="polite"
      aria-label={error ? error : lesson ? `الدرس: ${lesson.title}` : "جاري فتح الدرس"}
    >
      <div className="uz-splash-word" dir="ltr" aria-hidden="true">
        {LETTERS.map((letter, index) => (
          <svg
            key={letter.key}
            viewBox="-2 -2 60 104"
            className="uz-splash-letter"
            style={{ ["--i" as string]: index }}
            focusable="false"
          >
            <path d={letter.d} pathLength={1} />
          </svg>
        ))}
      </div>
      <span className="uz-splash-rule" data-tone="dark" aria-hidden="true" />

      {error ? (
        <div className="uz-lintro-info is-shown" dir="rtl">
          <p className="uz-lintro-error">{error}</p>
          <Link to="/rita-lessons" className="uz-lintro-back">
            رجوع للدروس
          </Link>
        </div>
      ) : (
        lesson && (
          <div className={`uz-lintro-info${showLesson ? " is-shown" : ""}`} aria-hidden="true">
            <p className="uz-lintro-label">الدرس</p>
            <p className="uz-lintro-title" dir="auto">
              {lesson.title}
            </p>
            {lesson.titleAr && lesson.titleAr !== lesson.title && (
              <p className="uz-lintro-ar" dir="rtl" lang="ar">
                {lesson.titleAr}
              </p>
            )}
            {lesson.sections > 0 && (
              <div className="uz-lintro-dots">
                {Array.from({ length: lesson.sections }, (_, index) => (
                  <span key={index} style={{ ["--i" as string]: index }} />
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
