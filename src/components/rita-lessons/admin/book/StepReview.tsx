import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, Sparkles } from "lucide-react";
import { lessonReadiness, type ExercisesState, type LessonReadiness } from "@/lib/rita-book-flow";
import type { CurriculumRow, LessonRow } from "@/lib/rita-curriculum.functions";
import type { BookStudyState } from "@/lib/study/study.functions";
import {
  KIND_TEXT,
  kindCounts,
  needsGuide,
  pipelineView,
  STEP_TEXT,
  type LessonKind,
} from "@/lib/study/lesson-maker";
import type { Resource } from "@/lib/rita-resources";
import type { Slide } from "@/lib/rita-slides";
import { pagesLabel } from "./book-utils";
import { BidiText, LessonKindBadge, MakerSteps, ReadinessChip } from "./BookBits";
import { LessonDrawer } from "./LessonDrawer";
import { useLessonMaker } from "./useLessonMaker";

const ORDER: LessonReadiness[] = ["problems", "warnings", "no_exercises", "ready", "published"];

type Filter = LessonKind | "all";

/**
 * Step 3: review. Every lesson with one word for its state and its kind (red or green); the ones that
 * need a look come first in the summary, and a filter shows one kind. A green lesson whose guide is
 * not linked offers «كمّل», which carries on from the step it stopped at. A lesson opens in a side
 * window with its exercises, plan, slides, resources and kind.
 */
export function StepReview({
  book,
  lessons,
  exercises,
  exercisesReady,
  study,
  slides,
  slidesReady,
  slidesShared,
  sharedReady,
  resources,
  resourcesReady,
  onNext,
  onChanged,
}: {
  book: CurriculumRow;
  lessons: LessonRow[];
  exercises: Record<string, ExercisesState>;
  exercisesReady: boolean;
  study: BookStudyState;
  slides: Record<string, Slide[]>;
  slidesReady: boolean;
  slidesShared: Record<string, boolean>;
  sharedReady: boolean;
  resources: Record<string, Resource[]>;
  resourcesReady: boolean;
  onNext: () => void;
  onChanged: () => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const setup = { exercisesReady, studyReady: study.ready };
  const maker = useLessonMaker({ book, setup, onChanged });
  const kindOf = (id: string): LessonKind =>
    study.ready ? (study.experience[id] ?? "classic") : "classic";
  const linkedOf = (id: string) => (study.ready ? Boolean(study.linked[id]) : false);
  const live = useMemo(
    () =>
      lessons
        .filter((lesson) => lesson.status !== "archived")
        .sort((a, b) => a.lesson_no - b.lesson_no),
    [lessons],
  );
  const counts = useMemo(() => {
    const result = new Map<LessonReadiness, number>();
    for (const lesson of live) {
      const state = lessonReadiness(lesson, exercises[lesson.id]);
      result.set(state, (result.get(state) ?? 0) + 1);
    }
    return result;
  }, [exercises, live]);
  const open = live.find((lesson) => lesson.id === openId) ?? null;
  const kinds = kindCounts(live.map((lesson) => kindOf(lesson.id)));
  const shown = filter === "all" ? live : live.filter((lesson) => kindOf(lesson.id) === filter);
  const unfinished = live.filter((lesson) =>
    needsGuide(kindOf(lesson.id), linkedOf(lesson.id), study.ready),
  );

  function finish(lessons: LessonRow[]) {
    void maker.make(
      lessons.map((lesson) => ({
        row: {
          key: lesson.id,
          lessonId: lesson.id,
          title: lesson.title_ar || lesson.title,
          titleEn: lesson.title,
          topic: lesson.topic,
          from: lesson.source_from_page,
          to: lesson.source_to_page,
        },
        facts: {
          exists: true,
          status: lesson.status,
          exercises: exercises[lesson.id]?.status ?? "none",
          linked: linkedOf(lesson.id),
        },
      })),
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="step-review-title">
      <div>
        <h2 id="step-review-title" className="text-[22px] font-bold">
          المراجعة
        </h2>
        <p className="mt-1 text-[15px] text-[var(--pp-muted)]">
          افتح كل درس وشوف تمارينه. «فيه ملاحظات» يعني المراجعة الثانية لقت شي يستاهل نظرة. «فيه
          مشكلة» يعني ما بينفع ينشر قبل ما يتصلّح. الأحمر درس ريتا، والأخضر ملف + ريتا.
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
          <div className="kind-filter" role="group" aria-label="نوع الدروس">
            {(["all", "classic", "study"] as const).map((value) => (
              <button
                key={value}
                type="button"
                data-kind={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "الكل" : KIND_TEXT[value].name}
                <span className="tabular-nums opacity-70">{kinds[value]}</span>
              </button>
            ))}
          </div>
          {unfinished.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
              <p className="min-w-0 flex-1">
                {unfinished.length} درس أخضر بدون دليل مربوط. لحد ما ينربط، الطلاب بياخدوه كدرس ريتا
                العادي.
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
          {shown.length > 0 && (
            <ul className="divide-y divide-[var(--pp-line)] overflow-hidden rounded-xl border border-[var(--pp-line)]">
              {shown.map((lesson) => {
                const state = lessonReadiness(lesson, exercises[lesson.id]);
                const notes = exercises[lesson.id]?.warnings ?? 0;
                const kind = kindOf(lesson.id);
                const linked = linkedOf(lesson.id);
                const run = maker.runs[lesson.id];
                const missing = needsGuide(kind, linked, study.ready);
                return (
                  <li
                    key={lesson.id}
                    className="lesson-row flex flex-col sm:flex-row sm:items-center"
                    data-kind={kind}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(lesson.id)}
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
                              steps={pipelineView(
                                {
                                  exists: true,
                                  exercises: exercises[lesson.id]?.status ?? "none",
                                  linked,
                                },
                                setup,
                                run,
                              )}
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
                              بدون دليل مربوط
                            </span>
                          )
                        )}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <LessonKindBadge kind={kind} />
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
          {shown.length === 0 && (
            <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">
              ما في دروس من هالنوع بهالكتاب.
            </p>
          )}
          <button type="button" onClick={onNext} className="rita-btn rita-btn-primary gap-2">
            الخطوة الجاية: النشر
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
        </>
      )}

      <LessonDrawer
        lesson={open}
        readiness={open ? lessonReadiness(open, exercises[open.id]) : "no_exercises"}
        kind={open ? kindOf(open.id) : undefined}
        studyLinked={open ? kindOf(open.id) === "study" && linkedOf(open.id) : false}
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
