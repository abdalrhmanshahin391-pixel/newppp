import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminCurriculumOverview } from "@/lib/rita-curriculum.functions";
import type { SlidesState } from "@/lib/rita-book-flow";
import { adminBookStudyState } from "@/lib/study/study.functions";
import { errorText, slidesOf } from "./book-utils";

export function useCurriculumAdminData(enabled: boolean) {
  const overviewFn = useServerFn(adminCurriculumOverview);
  const studyFn = useServerFn(adminBookStudyState);
  const [overview, setOverview] = useState<Awaited<
    ReturnType<typeof adminCurriculumOverview>
  > | null>(null);
  /** Per book, per lesson: are its slides linked, and how many review points they have. */
  const [slides, setSlides] = useState<Record<string, Record<string, SlidesState>>>({});
  const sequence = useRef(0);
  const [loadError, setLoadError] = useState("");
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const run = ++sequence.current;
    setLoadError("");
    try {
      const next = await overviewFn();
      const states = await Promise.all(
        next.curricula.map(
          async (book) =>
            [book.id, slidesOf(await studyFn({ data: { curriculumId: book.id } }))] as const,
        ),
      );
      if (run !== sequence.current) return;
      setOverview(next);
      setSlides(Object.fromEntries(states));
    } catch (error) {
      if (run !== sequence.current) return;
      setLoadError(errorText(error));
    }
  }, [enabled, overviewFn, studyFn]);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  useEffect(() => {
    if (enabled) void refresh();
    return invalidate;
  }, [enabled, refresh, invalidate]);
  return { overview, slides, loadError, refresh };
}
