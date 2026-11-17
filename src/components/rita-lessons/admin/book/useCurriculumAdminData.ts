import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminCurriculumOverview, adminExercisesSummary } from "@/lib/rita-curriculum.functions";
import type { ExercisesState } from "@/lib/rita-book-flow";
import { errorText } from "./book-utils";

export function useCurriculumAdminData(enabled: boolean) {
  const overviewFn = useServerFn(adminCurriculumOverview);
  const summaryFn = useServerFn(adminExercisesSummary);
  const [overview, setOverview] = useState<Awaited<
    ReturnType<typeof adminCurriculumOverview>
  > | null>(null);
  const [exercises, setExercises] = useState<Record<string, Record<string, ExercisesState>>>({});
  const [exercisesReady, setExercisesReady] = useState(false);
  const sequence = useRef(0);
  const [loadError, setLoadError] = useState("");
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const run = ++sequence.current;
    setLoadError("");
    try {
      const next = await overviewFn();
      const summaries = await Promise.all(
        next.curricula.map(
          async (book) => [book.id, await summaryFn({ data: { curriculumId: book.id } })] as const,
        ),
      );
      if (run !== sequence.current) return;
      setOverview(next);
      setExercises(Object.fromEntries(summaries.map(([id, summary]) => [id, summary.byLesson])));
      setExercisesReady(summaries.every(([, summary]) => summary.ready));
    } catch (error) {
      if (run !== sequence.current) return;
      setLoadError(errorText(error));
      // Unknown exercise readiness must not make bulk publication look safe.
      setExercisesReady(false);
    }
  }, [enabled, overviewFn, summaryFn]);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  useEffect(() => {
    if (enabled) void refresh();
    return invalidate;
  }, [enabled, refresh, invalidate]);
  return { overview, exercises, exercisesReady, loadError, refresh };
}
