import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LETTERS } from "@/components/language/LanguageSplash";
import { introSound } from "@/components/rita-study/tech-sound";

/** How long the word takes to draw; the lesson's lines and the heavy study page wait for it. */
const DRAWN_MS = 1100;
/** The least time the lesson's title stays before the intro leaves. */
const HOLD_MS = 700;
/** The most time the intro waits for the page underneath once the lesson is known. */
const MAX_WAIT_MS = 2600;
/** The intro's own exit (opacity and a slight grow). */
const LEAVE_MS = 350;
const REDUCED_HOLD_MS = 500;
/** A second intro mounting this soon after the first (another page of the same entry) continues it. */
const CONTINUE_MS = 6000;

/** When the current entry's intro started (shared across the pages one entry passes through). */
let startedAt: number | null = null;

export type IntroLesson = { title: string; titleAr: string; sections: number };

/**
 * Entering a lesson: the same picture as the language change (UZYRA drawn in fine lines on deep
 * navy, a hairline opening under it), then the lesson itself rolls in (its title in English and
 * Arabic, and one small dot per section of its guide lighting up in turn), with a soft sound as the
 * word starts. While the lesson is still loading the hairline breathes. Only transforms, opacity and
 * the line drawing move, and the page underneath is not built until the word is drawn (`onDrawn`),
 * so the drawing never stalls. The intro leaves once the page says it is ready (`pageReady`), or
 * after MAX_WAIT_MS at most. An admin's sample page shows the same intro first; when the lesson page
 * takes over it carries on from the same moment instead of drawing again.
 */
export function LessonIntro({
  lesson,
  error,
  pageReady = false,
  onDrawn,
  onDone,
  backTo = "/rita-lessons",
  backLabel = "رجوع للدروس",
}: {
  /** Null while the lesson is loading. */
  lesson: IntroLesson | null;
  /** A message when the lesson cannot open: shown on the intro with a way back. */
  error: string;
  /** The page underneath has drawn its guide. */
  pageReady?: boolean;
  /** The word is drawn and the lesson shown on it: the page underneath may be built now. */
  onDrawn?: () => void;
  onDone?: () => void;
  backTo?: "/rita-lessons" | "/admin";
  backLabel?: string;
}) {
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  // How far into an entry this intro starts (0 for a new one; the server always renders 0).
  const [elapsed] = useState(() => {
    if (typeof window === "undefined") return 0;
    const now = Date.now();
    // (Within 50ms it is the same mount run twice by React's development checks.)
    if (startedAt !== null && now - startedAt < 50) return 0;
    if (startedAt !== null && now - startedAt < CONTINUE_MS) return now - startedAt;
    startedAt = now;
    return 0;
  });
  const [drawn, setDrawn] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [shownAt, setShownAt] = useState(0);
  const drawnRef = useRef(onDrawn);
  const doneRef = useRef(onDone);
  useEffect(() => {
    drawnRef.current = onDrawn;
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (elapsed === 0) introSound();
  }, [elapsed]);

  useEffect(() => {
    const wait = reduced ? 0 : Math.max(0, DRAWN_MS - elapsed);
    const timer = window.setTimeout(() => setDrawn(true), wait);
    return () => window.clearTimeout(timer);
  }, [elapsed, reduced]);

  const showLesson = drawn && Boolean(lesson) && !error;
  useEffect(() => {
    if (!showLesson) return;
    setShownAt(Date.now());
    // Two frames later the title's roll-in is already running on its own, so building the heavy
    // page underneath does not hold up its first frame.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => drawnRef.current?.());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [showLesson]);

  // Shown: once the page is ready and the title has stayed a moment, leave (or stop waiting).
  useEffect(() => {
    if (!showLesson || !shownAt || leaving) return;
    const hold = reduced ? REDUCED_HOLD_MS : HOLD_MS;
    const since = Date.now() - shownAt;
    const wait = pageReady ? Math.max(0, hold - since) : Math.max(0, MAX_WAIT_MS - since);
    const timer = window.setTimeout(() => setLeaving(true), wait);
    return () => window.clearTimeout(timer);
  }, [leaving, pageReady, reduced, showLesson, shownAt]);

  useEffect(() => {
    if (!leaving) return;
    const done = window.setTimeout(
      () => {
        startedAt = null;
        doneRef.current?.();
      },
      reduced ? 150 : LEAVE_MS,
    );
    return () => window.clearTimeout(done);
  }, [leaving, reduced]);

  return (
    <div
      className="uz-splash uz-lintro"
      data-tone="dark"
      data-waiting={drawn && !lesson && !error ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      style={elapsed > 0 ? { ["--lintro-t" as string]: `${elapsed}ms` } : undefined}
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
          <Link to={backTo} className="uz-lintro-back">
            {backLabel}
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
