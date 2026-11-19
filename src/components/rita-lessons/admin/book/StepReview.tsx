import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArrowLeft, ChevronLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { lessonReadiness, type LessonReadiness, type SlidesState } from "@/lib/rita-book-flow";
import {
  adminSetLessonStatus,
  type CurriculumRow,
  type LessonRow,
} from "@/lib/rita-curriculum.functions";
import type { BookStudyState } from "@/lib/study/study.functions";
import { pipelineView, STEP_TEXT } from "@/lib/study/lesson-maker";
import type { Resource } from "@/lib/rita-resources";
import type { Slide } from "@/lib/rita-slides";
import { useWorkspaceTask } from "../WorkspaceGuard";
import { errorText, pagesLabel } from "./book-utils";
import { BidiText, MakerSteps, ReadinessChip } from "./BookBits";
import { LessonDrawer } from "./LessonDrawer";
import { useLessonMaker } from "./useLessonMaker";

const ORDER: LessonReadiness[] = ["no_slides", "warnings", "ready", "published"];

/**
 * Step 3: review. Every lesson with one word for its state. A lesson whose slides are not made or
 * not linked offers «كمّل», which carries on from the step it stopped at (an old talk-only lesson
 * becomes a slides lesson the same way). The old talk-only lessons of the book can be archived in
 * one go. A lesson opens in a side window with its slides, plan and resources.
 */
export function StepReview({
  book,
  lessons,
  study,
  slideStates,
  slides,
  slidesReady,
  slidesShared,
  sharedReady,
  resources,
  resourcesReady,
  onNext,
  onOpenLesson,
  onChanged,
}: {
  book: CurriculumRow;
  lessons: LessonRow[];
  study: BookStudyState;
  slideStates: Record<string, SlidesState>;
  slides: Record<string, Slide[]>;
  slidesReady: boolean;
  slidesShared: Record<string, boolean>;
  sharedReady: boolean;
  resources: Record<string, Resource[]>;
  resourcesReady: boolean;
  onNext: () => void;
  onOpenLesson?: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const statusFn = useServerFn(adminSetLessonStatus);
  const [openId, setOpenId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  useWorkspaceTask(archiving);
  const setup = { exercisesReady: false, studyReady: study.ready };
  const maker = useLessonMaker({ book, setup, onChanged });
  const linkedOf = (id: string) => Boolean(slideStates[id]?.linked);
  const live = useMemo(
    () =>
      lessons
        .filter((lesson) => lesson.status !== "archived")
        .sort((a, b) => a.lesson_no - b.lesson_no),
    [lessons],
  );
  const stateOf = (lesson: LessonRow) => lessonReadiness(lesson, slideStates[lesson.id]);
  const counts = useMemo(() => {
    const result = new Map<LessonReadiness, number>();
    for (const lesson of live) {
      const state = lessonReadiness(lesson, slideStates[lesson.id]);
      result.set(state, (result.get(state) ?? 0) + 1);
    }
    return result;
  }, [slideStates, live]);
  const open = live.find((lesson) => lesson.id === openId) ?? null;
  /** The old talk-only lessons (made before books had slides): offered for archiving. */
  const talkOnly = study.ready
    ? live.filter((lesson) => study.experience[lesson.id] !== "study" && !linkedOf(lesson.id))
    : [];
  const unfinished = study.ready ? live.filter((lesson) => !linkedOf(lesson.id)) : [];

  function finish(rows: LessonRow[]) {
    void maker.make(
      rows.map((lesson) => ({
        row: {
          key: lesson.id,
          lessonId: lesson.id,
          title: lesson.title_ar || lesson.title,
          titleEn: lesson.title,
          topic: lesson.topic,
          from: lesson.source_from_page,
          to: lesson.source_to_page,
        },
        facts: { exists: true, status: lesson.status, linked: linkedOf(lesson.id) },
      })),
    );
  }

  /** Archives the old talk-only lessons; the toast offers to put them back as they were. */
  async function archiveTalkOnly() {
    const rows = talkOnly;
    if (!rows.length) return;
    const published = rows.filter((lesson) => lesson.status === "published").length;
    if (
      !window.confirm(
        `أرشفة ${rows.length} درس محادثة قديم؟${published ? ` منهم ${published} منشور، وبيختفوا عن الطلاب.` : ""} بتقدر ترجعهم من الزر اللي بيطلع بعد الأرشفة.`,
      )
    )
      return;
    setArchiving(true);
    const done: LessonRow[] = [];
    try {
      for (const lesson of rows) {
        await statusFn({ data: { lessonId: lesson.id, status: "archived" } });
        done.push(lesson);
      }
      toast.success(`انأرشف ${done.length} درس محادثة`, {
        duration: 20_000,
        action: {
          label: "رجّعهم",
          onClick: () => {
            void (async () => {
              try {
                for (const lesson of done) {
                  await statusFn({
                    data: {
                      lessonId: lesson.id,
                      status: lesson.status === "published" ? "published" : "draft",
                    },
                  });
                }
                toast.success("رجعوا الدروس");
              } catch (error) {
                toast.error(errorText(error));
              } finally {
                await onChanged();
              }
            })();
          },
        },
      });
    } catch (error) {
      toast.error(`انأرشف ${done.length} من ${rows.length}: ${errorText(error)}`);
    } finally {
      setArchiving(false);
      await onChanged();
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="step-review-title">
      <div>
        <h2 id="step-review-title" className="text-[22px] font-bold">
          المراجعة
        </h2>
        <p className="mt-1 text-[15px] text-[var(--pp-muted)]">
          افتح كل درس وشوف شرائحه. «فيه ملاحظات» يعني المراجعة الثانية لقت شي يستاهل نظرة، مثل قاعدة
          بالكتاب ما ظهرت بأي شريحة. «بدون شرائح» يعني الدرس ما بينفع ينشر قبل ما يكمل.
        </p>
      </div>

      {live.length === 0 ? (
        <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">
          ما في دروس لسا. اصنعها من خطوة الدروس.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" aria-label="ملخص">
            {ORDER.filter((state) => counts.get(state)).map((state) => (
              <ReadinessChip key={state} state={state} count={counts.get(state)} />
            ))}
          </div>
          {talkOnly.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--pp-grey)] p-3 text-[14px]">
              <p className="min-w-0 flex-1">
                {talkOnly.length} درس محادثة قديم (يوزرا بس، بدون شرائح). إما «كمّل» لكل واحد ليصير
                درس شرائح، أو أرشفهم.
              </p>
              <button
                type="button"
                disabled={archiving || maker.running}
                onClick={() => void archiveTalkOnly()}
                className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
              >
                <Archive size={14} aria-hidden="true" />
                أرشف دروس المحادثة القديمة ({talkOnly.length})
              </button>
            </div>
          )}
          {unfinished.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
              <p className="min-w-0 flex-1">
                {unfinished.length} درس بدون شرائح مربوطة. ما بينشروا لحد ما تكمل شرائحهم.
              </p>
              {maker.running ? (
                <button
                  type="button"
                  onClick={maker.stop}
                  className="rita-btn rita-btn-soft rita-btn-sm"
                >
                  إيقاف بعد الدرس الحالي
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => finish(unfinished)}
                  className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  كمّلهم كلهم ({unfinished.length})
                </button>
              )}
            </div>
          )}
          {live.length > 0 && (
            <ul className="divide-y divide-[var(--pp-line)] overflow-hidden rounded-xl border border-[var(--pp-line)]">
              {live.map((lesson) => {
                const state = stateOf(lesson);
                const notes = slideStates[lesson.id]?.notes ?? 0;
                const linked = linkedOf(lesson.id);
                const run = maker.runs[lesson.id];
                const missing = study.ready && !linked;
                return (
                  <li
                    key={lesson.id}
                    className="lesson-row flex flex-col sm:flex-row sm:items-center"
                    data-kind="study"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onOpenLesson ? onOpenLesson(lesson.id) : setOpenId(lesson.id)
                      }
                      className="flex min-h-[64px] w-full min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-[var(--pp-grey)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--pp-ink)]"
                    >
                      <span className="w-8 shrink-0 text-center text-[14px] font-semibold tabular-nums text-[var(--pp-muted)]">
                        {lesson.lesson_no}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold">
                          <BidiText text={lesson.title_ar || lesson.title} />
                        </span>
                        <span className="block truncate text-[13.5px] text-[var(--pp-muted)]">
                          {pagesLabel(lesson.source_from_page, lesson.source_to_page)}
                          {lesson.title_ar && (
                            <>
                              {" "}
                              · <bdi dir="ltr">{lesson.title}</bdi>
                            </>
                          )}
                        </span>
                        {run ? (
                          <span className="block">
                            <MakerSteps
                              steps={pipelineView({ exists: true, linked }, setup, run)}
                            />
                            {run.state === "failed" && (
                              <span className="mt-1 block text-[13px] text-[#8c1a31]">
                                وقف عند «{STEP_TEXT[run.step].label}»: {run.message}
                              </span>
                            )}
                          </span>
                        ) : (
                          missing && (
                            <span className="mt-0.5 block text-[13px] font-semibold text-[#8a5a00]">
                              بدون شرائح مربوطة
                            </span>
                          )
                        )}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <ReadinessChip
                          state={state}
                          count={state === "warnings" ? notes : undefined}
                        />
                      </span>
                      <ChevronLeft
                        size={18}
                        className="shrink-0 text-[var(--pp-muted)]"
                        aria-hidden="true"
                      />
                    </button>
                    {missing && run?.state !== "running" && run?.state !== "queued" && (
                      <button
                        type="button"
                        disabled={maker.running}
                        onClick={() => finish([lesson])}
                        className="rita-btn rita-btn-soft rita-btn-sm mb-2.5 ms-14 shrink-0 gap-1 self-start sm:m-0 sm:me-3 sm:self-center"
                      >
                        <Sparkles size={13} aria-hidden="true" />
                        {run?.state === "failed" ? "أعِد" : "كمّل"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" onClick={onNext} className="rita-btn rita-btn-primary gap-2">
            الخطوة الجاية: النشر
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
        </>
      )}

      <LessonDrawer
        lesson={open}
        readiness={open ? stateOf(open) : "no_slides"}
        studyLinked={open ? linkedOf(open.id) : false}
        bookPublished={book.status === "published"}
        slides={slides}
        slidesReady={slidesReady}
        slidesShared={slidesShared}
        sharedReady={sharedReady}
        resources={resources}
        resourcesReady={resourcesReady}
        onClose={() => setOpenId(null)}
        onChanged={onChanged}
      />
    </section>
  );
}
