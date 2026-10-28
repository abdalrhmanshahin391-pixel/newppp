import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminGenerateExercises,
  adminGenerateLesson,
  adminLessonExercises,
  adminPublishExercises,
  adminSetCurriculumStatus,
  adminSetLessonStatus,
  type CurriculumRow,
} from "@/lib/rita-curriculum.functions";
import { adminRenderGuide, adminWriteGuide } from "@/lib/guides/guides.functions";
import { describeGuideError } from "@/lib/guides/guide-record";
import { shouldPublishExercisesWithLesson } from "@/lib/rita-engine-check";
import {
  adminLinkStudyGuide,
  adminSetLessonExperience,
  adminStudyLessonState,
} from "@/lib/study/study.functions";
import {
  guidePages,
  missingSteps,
  type BookRow,
  type LessonFacts,
  type MakerSetup,
  type MakerStep,
  type RunState,
} from "@/lib/study/lesson-maker";
import { errorDetail, errorText } from "./book-utils";

class StepError extends Error {
  constructor(
    readonly step: MakerStep,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

/**
 * The book page's "make" button: one lesson is made in full (lesson, exercises, PDF guide, then the
 * guide checked and linked), one lesson after the other. Each step looks at what is already saved,
 * so a stopped or closed page carries on where it stopped and nothing is made twice.
 */
export function useLessonMaker({
  book,
  setup,
  onChanged,
}: {
  book: CurriculumRow;
  setup: MakerSetup;
  onChanged: () => Promise<void>;
}) {
  const lessonFn = useServerFn(adminGenerateLesson);
  const exercisesFn = useServerFn(adminGenerateExercises);
  const experienceFn = useServerFn(adminSetLessonExperience);
  const stateFn = useServerFn(adminStudyLessonState);
  const writeFn = useServerFn(adminWriteGuide);
  const renderFn = useServerFn(adminRenderGuide);
  const linkFn = useServerFn(adminLinkStudyGuide);
  const viewFn = useServerFn(adminLessonExercises);
  const publishExercisesFn = useServerFn(adminPublishExercises);
  const lessonStatusFn = useServerFn(adminSetLessonStatus);
  const bookStatusFn = useServerFn(adminSetCurriculumStatus);

  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [running, setRunning] = useState(false);
  const [publishing, setPublishing] = useState("");
  const cancel = useRef(false);

  /** A run is kept under the row's key and, once the lesson exists, under the lesson too. */
  const setRun = (keys: (string | null)[], value: RunState | null) =>
    setRuns((current) => {
      const next = { ...current };
      for (const key of keys) {
        if (!key) continue;
        if (value) next[key] = value;
        else delete next[key];
      }
      return next;
    });

  async function makeOne(row: BookRow, facts: LessonFacts) {
    let lessonId = row.lessonId;
    let title = row.titleEn || row.topic;
    let step: MakerStep = "lesson";
    const show = (next: MakerStep) => {
      step = next;
      setRun([row.key, lessonId], { state: "running", step: next });
    };
    try {
      if (!lessonId) {
        show("lesson");
        const made = await lessonFn({
          data: { curriculumId: book.id, topic: row.topic, from: row.from, to: row.to },
        });
        lessonId = made.id;
        title = made.title || title;
      }
      const todo = missingSteps({ ...facts, exists: true }, setup);
      if (setup.studyReady) {
        await experienceFn({ data: { lessonId, experience: "study" } });
      }
      if (todo.includes("exercises")) {
        show("exercises");
        await exercisesFn({ data: { lessonId } });
      }
      if (todo.includes("guide")) {
        show("guide");
        const state = await stateFn({ data: { lessonId } });
        // A guide already made for these pages (and fit to link) is used instead of a new one.
        let guideId =
          state.ready &&
          state.guides.find((guide) => guide.status === "ready" && !guide.problem)?.id;
        if (!guideId) {
          const written = await writeFn({
            data: {
              curriculumId: book.id,
              title: title.slice(0, 200),
              ...guidePages(row.from, row.to),
            },
          });
          if (!written.ok) {
            throw new StepError(
              "guide",
              written.code === "already_running"
                ? "دليل لهاي الصفحات قيد الصنع هلأ. استنى دقيقة وأعِد."
                : describeGuideError(written.code),
              written.message,
            );
          }
          const rendered = await renderFn({ data: { guideId: written.guideId } });
          if (!rendered.ok)
            throw new StepError("guide", describeGuideError(rendered.code), rendered.message);
          guideId = written.guideId;
        }
        show("link");
        const linked = await linkFn({ data: { lessonId, guideId } });
        if (!linked.ok) throw new StepError("link", linked.message);
      }
      setRun([row.key, lessonId], null);
      return true;
    } catch (error) {
      const failed =
        error instanceof StepError
          ? { step: error.step, message: error.message, detail: error.detail }
          : { step, message: errorText(error), detail: errorDetail(error) };
      setRun([row.key, lessonId], { state: "failed", ...failed });
      return false;
    }
  }

  /** Makes the rows one after the other; "stop" takes effect after the current one. */
  async function make(queue: { row: BookRow; facts: LessonFacts }[]) {
    if (running || !queue.length) return;
    cancel.current = false;
    setRunning(true);
    setRuns((current) => {
      const next = { ...current };
      for (const { row } of queue) next[row.key] = { state: "queued" };
      return next;
    });
    let made = 0;
    try {
      for (const [index, item] of queue.entries()) {
        if (cancel.current) {
          setRuns((current) => {
            const next = { ...current };
            for (const rest of queue.slice(index)) delete next[rest.row.key];
            return next;
          });
          break;
        }
        if (await makeOne(item.row, item.facts)) made += 1;
        await onChanged();
      }
      if (made) toast.success(made === 1 ? "انصنع الدرس كامل" : `انصنعوا ${made} دروس كاملين`);
    } finally {
      setRunning(false);
    }
  }

  /** Publishes one lesson with its exercises, and the book too when it is still a draft. */
  async function publish(lessonId: string) {
    setPublishing(lessonId);
    try {
      const view = await viewFn({ data: { lessonId } });
      const withExercises = shouldPublishExercisesWithLesson({
        hasContent: view.content !== null,
        status: view.status,
        problems: view.problems.length,
      });
      if (withExercises) await publishExercisesFn({ data: { lessonId, publish: true } });
      await lessonStatusFn({ data: { lessonId, status: "published" } });
      if (book.status !== "published")
        await bookStatusFn({ data: { curriculumId: book.id, status: "published" } });
      toast.success(
        withExercises ? "انشر الدرس للطلاب مع تمارينه" : "انشر الدرس (تمارينه فيها مشكلة، فبدونها)",
      );
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPublishing("");
      await onChanged();
    }
  }

  return {
    runs,
    running,
    publishing,
    make,
    publish,
    stop: () => {
      cancel.current = true;
    },
    clear: (key: string) => setRun([key], null),
  };
}

export type LessonMaker = ReturnType<typeof useLessonMaker>;
