import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { StudyBridge } from "@/components/rita/RitaRealtimeV3";
import { useExplanationLanguage } from "@/hooks/useExplanationLanguage";
import { ACTION_INFO, type RitaAction } from "@/lib/study/study-actions";
import { resolveStudyRequest, studyExplainText } from "@/lib/study/study-request.functions";
import {
  ACK_MS,
  FIRST_AUDIO_MS,
  LATE_MESSAGE,
  ackStep,
  isLive,
  ritaEventStep,
  stopStep,
  type ActiveRequest,
  type RequestStep,
} from "@/lib/study/study-request-state";

export type { ActiveRequest };

export type SelectionRef = { segIds: string[]; exact: string; parts?: string[] };

/**
 * One request at a time: a new one cancels the old one, and a late answer from an old request is
 * never shown as the answer to the new one (each carries its request id). In a call, Rita answers
 * by voice and in the chat; without a call, "explain" and the like are answered in writing.
 */
export function useStudyRequests({
  lessonId,
  preview,
  bridge,
}: {
  lessonId: string;
  preview: boolean;
  bridge: StudyBridge;
}) {
  const resolveFn = useServerFn(resolveStudyRequest);
  const textFn = useServerFn(studyExplainText);
  const { value: language } = useExplanationLanguage();
  const [active, setActive] = useState<ActiveRequest | null>(null);
  const activeRef = useRef<ActiveRequest | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const update = useCallback((id: string, patch: Partial<ActiveRequest>) => {
    const current = activeRef.current;
    if (!current || current.id !== id) return; // an old request: ignore
    const next = { ...current, ...patch };
    activeRef.current = next;
    setActive(next);
  }, []);

  const clearTimer = () => window.clearTimeout(timer.current);

  const fail = useCallback(
    (id: string, message: string) => {
      clearTimer();
      update(id, { state: "failed", message });
    },
    [update],
  );

  /** Applies one step from study-request-state.ts to the current request. */
  const apply = useCallback(
    (step: RequestStep | null) => {
      const current = activeRef.current;
      if (!step || !current) return;
      if (step.timer !== "keep") clearTimer();
      update(current.id, { state: step.state, ...(step.message ? { message: step.message } : {}) });
      if (step.timer === "first_audio") {
        const id = current.id;
        timer.current = window.setTimeout(() => fail(id, LATE_MESSAGE), FIRST_AUDIO_MS);
      }
    },
    [fail, update],
  );

  // The worker's answers about a request.
  useEffect(() => {
    bridge.onMessage = (message) => apply(ackStep(activeRef.current, message));
    return () => {
      bridge.onMessage = undefined;
      clearTimer();
    };
  }, [apply, bridge]);

  /** Rita's speaking state, from the call (the study page forwards it). */
  const onRitaEvent = useCallback(
    (event: "ready" | "ended" | "speaking" | "quiet") =>
      apply(ritaEventStep(activeRef.current, event)),
    [apply],
  );

  const stop = useCallback(() => {
    const current = activeRef.current;
    const step = stopStep(current);
    if (!current || !step) return;
    if (current.channel === "voice") bridge.send?.("rita-study-cancel", { request_id: current.id });
    apply(step);
  }, [apply, bridge]);

  const run = useCallback(
    async (action: RitaAction, selection: SelectionRef): Promise<boolean> => {
      const voice = Boolean(bridge.send);
      if (ACTION_INFO[action].voiceOnly && !voice) {
        toast.message("ابدأ مع ريتا أول، وبعدين اشرحلها بصوتك.");
        return false;
      }
      // A new request replaces the old one.
      const previous = activeRef.current;
      if (previous && isLive(previous.state)) {
        if (previous.channel === "voice")
          bridge.send?.("rita-study-cancel", { request_id: previous.id });
        update(previous.id, { state: "cancelled" });
      }
      clearTimer();
      const id = crypto.randomUUID();
      const request: ActiveRequest = {
        id,
        action,
        quote: selection.exact,
        channel: voice ? "voice" : "text",
        state: "resolving",
      };
      activeRef.current = request;
      setActive(request);
      const payload = {
        lessonId,
        preview,
        requestId: id,
        action,
        channel: request.channel,
        selection: { segIds: selection.segIds, exact: selection.exact, parts: selection.parts },
      };
      try {
        if (voice) {
          const result = await resolveFn({ data: payload });
          if (activeRef.current?.id !== id) return false;
          if (!result.ok) {
            fail(id, result.message);
            if (result.code === "rate_limited") toast.message(result.message);
            return false;
          }
          bridge.post?.("you", `[${ACTION_INFO[action].label}] «${result.quote.slice(0, 160)}»`);
          const sent = bridge.send?.("rita-study-action", {
            request_id: id,
            action,
            quote: result.quote,
            context: result.context,
          });
          if (!sent) {
            fail(id, "ريتا مش متصلة. اكبس «ابدأ مع ريتا».");
            return false;
          }
          update(id, { state: "sent", quote: result.quote });
          timer.current = window.setTimeout(() => fail(id, LATE_MESSAGE), ACK_MS);
          return true;
        }
        bridge.post?.("you", `[${ACTION_INFO[action].label}] «${selection.exact.slice(0, 160)}»`);
        const result = await textFn({ data: { ...payload, channel: "text", language } });
        if (activeRef.current?.id !== id) return false;
        if (!result.ok) {
          fail(id, result.message);
          if (result.code === "rate_limited") toast.message(result.message);
          return false;
        }
        if ("text" in result) bridge.post?.("rita", result.text);
        update(id, { state: "done" });
        return true;
      } catch {
        fail(id, "ما قدرت أبعث الطلب. جرّب مرة ثانية.");
        return false;
      }
    },
    [bridge, fail, language, lessonId, preview, resolveFn, textFn, update],
  );

  const report = useCallback(
    async (selection: SelectionRef, note: string) => {
      try {
        const result = await resolveFn({
          data: {
            lessonId,
            preview,
            requestId: crypto.randomUUID(),
            action: "report",
            channel: "text",
            selection,
            note: note || undefined,
          },
        });
        if (result.ok) toast.success("وصل البلاغ. شكرًا!");
        else toast.error(result.message);
        return result.ok;
      } catch {
        toast.error("ما وصل البلاغ. جرّب مرة ثانية.");
        return false;
      }
    },
    [lessonId, preview, resolveFn],
  );

  return { active, run, stop, report, onRitaEvent, busy: Boolean(active && isLive(active.state)) };
}
