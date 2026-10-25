import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  answerLessonItem,
  sendLessonEvent,
  startLessonRun,
  type EventResult,
} from "@/lib/rita-lesson-run.functions";
import type { ClientEvent, Channel, RunView, SampleKey } from "@/lib/rita-lesson-run";
import type { LearnerResponse } from "@/lib/rita-lesson-grader";

export type RunSource = { lessonId?: string; sample?: SampleKey; preview?: boolean };

type Pending =
  | { kind: "event"; event: ClientEvent }
  | { kind: "answer"; itemId: string; response: LearnerResponse; channel: Channel };

/**
 * A lesson with exercises, as the page sees it. One request at a time: the step that comes back is
 * the truth, so a refused (stale) request simply shows the server's current step. A request that
 * failed on the network is kept so the learner can send it again; nothing is counted until the
 * server says so.
 */
export function useLessonRun(source: RunSource, enabled = true) {
  const startFn = useServerFn(startLessonRun);
  const eventFn = useServerFn(sendLessonEvent);
  const answerFn = useServerFn(answerLessonItem);
  const [view, setView] = useState<RunView | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Pending | null>(null);
  const [error, setError] = useState("");
  const viewRef = useRef<RunView | null>(null);
  const inFlight = useRef(false);
  const { lessonId, sample, preview } = source;

  const adopt = useCallback((next: RunView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const start = useCallback(
    async (restart = false) => {
      if (!enabled || (!lessonId && !sample)) return;
      setError("");
      try {
        const result = await startFn({
          data: { lessonId, sample, restart, preview: Boolean(preview) },
        });
        if (!result.available) {
          setAvailable(false);
          return;
        }
        setAvailable(true);
        adopt(result);
      } catch (cause) {
        setAvailable(false);
        setError(cause instanceof Error ? cause.message : "This lesson could not be opened.");
      }
    },
    [adopt, enabled, lessonId, preview, sample, startFn],
  );

  useEffect(() => {
    void start();
  }, [start]);

  const run = useCallback(
    async (pending: Pending): Promise<EventResult | null> => {
      const current = viewRef.current;
      if (!current || inFlight.current) return null;
      inFlight.current = true;
      setBusy(true);
      setFailed(null);
      try {
        const result =
          pending.kind === "event"
            ? await eventFn({
                data: {
                  runId: current.run_id,
                  revision: current.step.revision,
                  event: pending.event,
                },
              })
            : await answerFn({
                data: {
                  runId: current.run_id,
                  revision: current.step.revision,
                  itemId: pending.itemId,
                  response: pending.response,
                  channel: pending.channel,
                },
              });
        adopt(result);
        return result;
      } catch {
        setFailed(pending);
        return null;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [adopt, answerFn, eventFn],
  );

  const send = useCallback((event: ClientEvent) => run({ kind: "event", event }), [run]);
  const answer = useCallback(
    (itemId: string, response: LearnerResponse, channel: Channel = "tap") =>
      run({ kind: "answer", itemId, response, channel }),
    [run],
  );
  const retry = useCallback(() => (failed ? run(failed) : Promise.resolve(null)), [failed, run]);

  return {
    view,
    step: view?.step ?? null,
    available,
    busy,
    failed: Boolean(failed),
    error,
    send,
    answer,
    retry,
    restart: () => start(true),
  };
}

export type LessonRunHandle = ReturnType<typeof useLessonRun>;
