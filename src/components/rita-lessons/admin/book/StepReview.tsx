import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { lessonReadiness, type ExercisesState, type LessonReadiness } from "@/lib/rita-book-flow";
import type { CurriculumRow, LessonRow } from "@/lib/rita-curriculum.functions";
import type { Resource } from "@/lib/rita-resources";
import type { Slide } from "@/lib/rita-slides";
import { pagesLabel } from "./book-utils";
import { BidiText, ReadinessChip } from "./BookBits";
import { LessonDrawer } from "./LessonDrawer";

const ORDER: LessonReadiness[] = ["problems", "warnings", "no_exercises", "ready", "published"];

/**
 * Step 3: review. Every lesson with one word for its state; the ones that need a look come first
 * in the summary. A lesson opens in a side window with its exercises, plan, slides and resources.
 */
export function StepReview({
  book,
  lessons,
  exercises,
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

  return (
    <section className="space-y-5" aria-labelledby="step-review-title">
      <div>
        <h2 id="step-review-title" className="text-[22px] font-bold">
          المراجعة
        </h2>
        <p className="mt-1 text-[15px] text-[var(--pp-muted)]">
          افتح كل درس وشوف تمارينه. «فيه ملاحظات» يعني المراجعة الثانية لقت شي يستاهل نظرة. «فيه
          مشكلة» يعني ما بينفع ينشر قبل ما يتصلّح.
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
          <ul className="divide-y divide-[var(--pp-line)] rounded-xl border border-[var(--pp-line)]">
            {live.map((lesson) => {
              const state = lessonReadiness(lesson, exercises[lesson.id]);
              const notes = exercises[lesson.id]?.warnings ?? 0;
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(lesson.id)}
                    className="flex min-h-[64px] w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-[var(--pp-grey)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--pp-ink)]"
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
                    </span>
                    <ReadinessChip state={state} count={state === "warnings" ? notes : undefined} />
                    <ChevronLeft
                      size={18}
                      className="shrink-0 text-[var(--pp-muted)]"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={onNext} className="rita-btn rita-btn-primary gap-2">
            الخطوة الجاية: النشر
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
        </>
      )}

      <LessonDrawer
        lesson={open}
        readiness={open ? lessonReadiness(open, exercises[open.id]) : "no_exercises"}
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
