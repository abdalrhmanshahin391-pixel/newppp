import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLessonPath } from "@/lib/rita-curriculum.functions";
import type { LessonLite } from "@/lib/learn-home";
import { useActiveLanguage } from "@/lib/language-scope";

export type LessonPathState =
  | { status: "idle" | "loading" | "error"; lessons: null }
  | { status: "ready"; lessons: LessonLite[] };

/** The learner's lesson path, read once. Lessons are a nicety: a failure never blocks the page. */
export function useLessonPath(enabled: boolean): LessonPathState {
  const pathFn = useServerFn(getLessonPath);
  // Each language has its own path.
  const language = useActiveLanguage();
  const [state, setState] = useState<LessonPathState>({ status: "idle", lessons: null });

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle", lessons: null });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", lessons: null });
    pathFn({ data: { language } })
      .then((result) => {
        if (!cancelled) setState({ status: "ready", lessons: result.lessons });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", lessons: null });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, pathFn, language]);

  return state;
}
