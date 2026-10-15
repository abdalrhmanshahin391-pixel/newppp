import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  evaluateLessonTurn,
  startLessonAttempt,
  type LessonSession,
} from "@/lib/rita-curriculum.functions";
import type { LessonTurn, ObjectiveState } from "@/lib/rita-curriculum";

export type LessonResult = { score: number; stars: number };

/**
 * Curriculum lesson state inside Rita Live. Evaluations run one at a time:
 * turns that arrive while a check is running are folded into the next check,
 * so the stored objectives are never overwritten by an older answer.
 * In preview mode (admins only, checked on the server) nothing is saved.
 */
export function useRitaLesson(lessonId: string | undefined, preview = false) {
  const startFn = useServerFn(startLessonAttempt);
  const evaluateFn = useServerFn(evaluateLessonTurn);
  const [session, setSession] = useState<LessonSession | null>(null);
  const [objectives, setObjectives] = useState<ObjectiveState>({});
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [justMet, setJustMet] = useState<string[]>([]);
  const running = useRef(false);
  const queued = useRef<LessonTurn[] | null>(null);
  const finished = useRef(false);
  // The latest objectives, read at call time: a queued check must send the
  // state that includes the previous check's result, not a stale render's.
  const objectivesRef = useRef<ObjectiveState>({});

  const load = useCallback(
    async (restart = false) => {
      if (!lessonId) return;
      setError("");
      try {
        const next = await startFn({ data: { lessonId, restart, preview } });
        finished.current = false;
        setSession(next);
        setObjectives(next.progress.objectives);
        objectivesRef.current = next.progress.objectives;
        setScore(next.progress.score);
        setResult(null);
        setJustMet([]);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "This lesson could not be opened.");
      }
    },
    [lessonId, preview, startFn],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (turns: LessonTurn[]) => {
      if (!lessonId) return;
      running.current = true;
      setChecking(true);
      try {
        const outcome = await evaluateFn({
          data: {
            lessonId,
            turns,
            preview,
            // Preview keeps its state client-side so nothing is ever persisted.
            ...(preview ? { previewState: objectivesRef.current } : {}),
          },
        });
        setObjectives(outcome.objectives);
        objectivesRef.current = outcome.objectives;
        setScore(outcome.score);
        if (outcome.newlyMet.length) setJustMet(outcome.newlyMet);
        if (outcome.completed) {
          finished.current = true;
          queued.current = null;
          setResult({ score: outcome.score, stars: outcome.stars });
        }
      } catch (cause) {
        // A failed check is not fatal: the next answer is checked again.
        console.warn("Lesson check failed", cause);
      } finally {
        running.current = false;
        setChecking(false);
        const pending = queued.current;
        queued.current = null;
        if (pending && !finished.current) void run(pending);
      }
    },
    [evaluateFn, lessonId, preview],
  );

  /** Call with the latest conversation after each learner turn. */
  const checkTurns = useCallback(
    (turns: LessonTurn[]) => {
      if (!session || finished.current || !turns.some((turn) => turn.role === "user")) return;
      const recent = turns.slice(-8);
      if (running.current) {
        queued.current = recent;
        return;
      }
      void run(recent);
    },
    [run, session],
  );

  return {
    enabled: Boolean(lessonId),
    session,
    objectives,
    score,
    result,
    checking,
    error,
    justMet,
    checkTurns,
    restart: () => load(true),
  };
}
