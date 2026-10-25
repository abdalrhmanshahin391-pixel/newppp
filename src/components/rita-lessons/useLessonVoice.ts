import { useCallback, useEffect, useRef } from "react";
import type { LessonStep } from "@/lib/rita-lesson-engine";
import {
  isItemPhase,
  silenceLine,
  stepMessage,
  type SpeechLanguage,
} from "@/lib/rita-lesson-speech";
import type { LessonRunHandle } from "./useLessonRun";

/** Seconds of quiet in an exercise before Rita offers a hint, then a repeat. */
const NUDGE_HINT_MS = 8_000;
const NUDGE_REPEAT_MS = 20_000;

export type LessonSignal = {
  type: "rita-lesson-signal";
  revision?: number | null;
  signal?: string;
  value?: string;
};

type Send = (type: string, data?: unknown) => void;

/**
 * Connects the lesson engine to Rita's voice during a call. Every new step goes to the worker
 * with the exact line Rita should say (or "teach this part"), and every signal Rita hears
 * ("ready", an answer, "hint"…) becomes an engine event or a spoken answer that the server grades.
 * A spoken answer is used only for the step it was heard against, so a late answer can never be
 * counted on the next question.
 */
export function useLessonVoice({
  run,
  connected,
  send,
  language,
  ritaTalking,
  learnerActivity,
}: {
  run: LessonRunHandle;
  /** The call is up and Rita is ready to hear and speak. */
  connected: boolean;
  send: Send;
  language: SpeechLanguage;
  ritaTalking: boolean;
  /** Changes whenever the learner starts speaking (resets the silence nudges). */
  learnerActivity: number;
}) {
  const step = run.step;
  const spoken = useRef<LessonStep | null>(null);
  const stepRef = useRef<LessonStep | null>(step);
  stepRef.current = step;

  // A new call starts from the current step (the intro, or the open question mid-lesson).
  useEffect(() => {
    if (!connected) spoken.current = null;
  }, [connected]);

  // Set when Rita is already answering a question that paused the exercise: the pause itself is
  // then not announced, so her answer is not interrupted by a second line.
  const quietPause = useRef(false);

  useEffect(() => {
    if (!connected || !step) return;
    const message = stepMessage(spoken.current, step, language);
    spoken.current = step;
    if (!message) return;
    if (message.paused && quietPause.current) {
      quietPause.current = false;
      message.say = "";
    }
    send("rita-lesson-step", message);
  }, [connected, language, send, step]);

  const say = useCallback((text: string) => send("rita-lesson-say", { text }), [send]);

  const onSignal = useCallback(
    (message: LessonSignal) => {
      const current = stepRef.current;
      if (!current || current.phase === "done") return;
      const signal = String(message.signal ?? "");
      const fresh = message.revision == null || Number(message.revision) === current.revision;
      const item = current.item;
      switch (signal) {
        case "ready":
        case "no_question":
          if (current.allowed.includes(signal)) void run.send({ type: signal });
          return;
        case "resume":
          void run.send({ type: "resume" });
          return;
        case "pause":
          void run.send({ type: "pause" });
          return;
        case "question":
          // A question in the middle of an exercise pauses it, so the answer is read in the chat
          // and the learner comes back to the same question.
          if (isItemPhase(current.phase) && !current.paused) {
            quietPause.current = true;
            void run.send({ type: "pause" });
          } else {
            void run.send({ type: "question" });
          }
          return;
        case "repeat":
          if (isItemPhase(current.phase) && !current.paused) {
            const again = stepMessage(null, current, language);
            if (again?.say) say(again.say);
          } else {
            void run.send({ type: "repeat" });
          }
          return;
        case "hint":
          if (item) void run.send({ type: "hint", item_id: item.id });
          return;
        case "answer":
          if (!item || !fresh || !isItemPhase(current.phase) || current.paused) return;
          if (!item.voice) {
            say(
              language === "ar"
                ? "هاد التمرين بالضغط على القطع على الشاشة."
                : "This one is done by tapping the pieces on the screen.",
            );
            return;
          }
          void run.answer(item.id, { kind: "spoken", text: String(message.value ?? "") }, "voice");
          return;
        default:
          return; // "ack" and anything unknown: nothing to do
      }
    },
    [language, run, say],
  );

  // Silence in an exercise: one offer of a hint, then one offer to repeat, per question.
  const nudges = useRef({ revision: 0, stage: 0 });
  useEffect(() => {
    if (!connected || !step || !isItemPhase(step.phase) || step.paused || ritaTalking) return;
    if (nudges.current.revision !== step.revision)
      nudges.current = { revision: step.revision, stage: 0 };
    const stage = nudges.current.stage;
    if (stage >= 2) return;
    const timer = window.setTimeout(
      () => {
        nudges.current.stage = stage + 1;
        say(silenceLine(stage === 0 ? 1 : 2, language));
      },
      stage === 0 ? NUDGE_HINT_MS : NUDGE_REPEAT_MS - NUDGE_HINT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [connected, language, learnerActivity, ritaTalking, say, step]);

  return { onSignal };
}
