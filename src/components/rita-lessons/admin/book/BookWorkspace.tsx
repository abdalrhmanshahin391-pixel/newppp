import { useCallback, useEffect, useMemo, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  BOOK_STEPS,
  STEP_LABEL,
  bookProgress,
  lessonPlan,
  type BookStep,
  type ExercisesState,
} from "@/lib/rita-book-flow";
import {
  adminSetCurriculumStatus,
  type CurriculumRow,
  type LessonRow,
  type WindowRow,
} from "@/lib/rita-curriculum.functions";
import type { Resource } from "@/lib/rita-resources";
import { adminBookStudyState, type BookStudyState } from "@/lib/study/study.functions";
import type { Slide } from "@/lib/rita-slides";
import { errorText } from "./book-utils";
import { KindBadge } from "./BookBits";
import { AdvancedTools } from "./AdvancedTools";
import { StepLessons } from "./StepLessons";
import { StepPublish } from "./StepPublish";
import { StepRead } from "./StepRead";
import { StepReview } from "./StepReview";
import { useBookReader } from "./useBookReader";

/** One book, one step at a time: read, lessons, review, publish. */
export function BookWorkspace({
  book,
  windows,
  lessons,
  allLessons,
  missingText,
  exercises,
  exercisesReady,
  slides,
  slidesReady,
  slidesShared,
  sharedReady,
  resources,
  resourcesReady,
  pdfCache,
  step,
  onStep,
  onBack,
  onChanged,
}: {
  book: CurriculumRow;
  windows: WindowRow[];
  lessons: LessonRow[];
  allLessons: LessonRow[];
  missingText: number[];
  exercises: Record<string, ExercisesState>;
  exercisesReady: boolean;
  slides: Record<string, Slide[]>;
  slidesReady: boolean;
  slidesShared: Record<string, boolean>;
  sharedReady: boolean;
  resources: Record<string, Resource[]>;
  resourcesReady: boolean;
  pdfCache: Map<string, File>;
  step: BookStep;
  onStep: (step: BookStep) => void;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const statusFn = useServerFn(adminSetCurriculumStatus);
  const studyFn = useServerFn(adminBookStudyState);
  // Each lesson's kind (red or green) and whether its guide is linked. Read again after each change.
  const [study, setStudy] = useState<BookStudyState>({ ready: false });
  const loadStudy = useCallback(async () => {
    try {
      setStudy(await studyFn({ data: { curriculumId: book.id } }));
    } catch {
      // Without it every lesson shows as red and green lessons cannot be made; the rest works.
      setStudy({ ready: false });
    }
  }, [book.id, studyFn]);
  useEffect(() => {
    void loadStudy();
  }, [loadStudy]);
  const changed = useCallback(async () => {
    await Promise.all([onChanged(), loadStudy()]);
  }, [loadStudy, onChanged]);
  const reader = useBookReader({ book, missingText, pdfCache, onChanged });
  const openSuggestions = useMemo(
    () =>
      lessonPlan({
        suggestions: windows.flatMap((window) => window.summary.suggested_lessons),
        lessons,
        readCursor: book.read_cursor,
      }).length,
    [book.read_cursor, lessons, windows],
  );
  const progress = bookProgress({
    book,
    lessons,
    missingPages: missingText.length,
    exercises,
    openSuggestions,
  });

  function leave(go: () => void) {
    if (reader.running && !window.confirm("القراءة شغالة. إذا طلعت بتوقف. نطلع؟")) return;
    if (reader.running) reader.stop();
    go();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => leave(onBack)}
          className="rita-btn rita-btn-quiet rita-btn-sm gap-1.5 !px-1"
        >
          <ArrowRight size={16} aria-hidden="true" /> كل الكتب
        </button>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="rh-app-title truncate text-[28px] font-bold leading-tight">
              {book.title_ar || book.title}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-[var(--pp-muted)]">
              <KindBadge kind={book.kind} />
              {[
                <bdi key="title" dir="ltr">
                  {book.title}
                </bdi>,
                `${book.page_count} صفحة`,
                book.target_language.toUpperCase(),
                book.status === "published" ? "منشور" : "مسودة",
              ].map((part, index) => (
                <span key={index} className="whitespace-nowrap">
                  {index > 0 && <span aria-hidden="true">· </span>}
                  {part}
                </span>
              ))}
            </p>
          </div>
          <Menu.Root dir="rtl">
            <Menu.Trigger asChild>
              <button
                type="button"
                className="rita-btn rita-btn-quiet rita-btn-sm"
                aria-label="خيارات الكتاب"
              >
                <MoreHorizontal size={18} />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="rita-menu edith-premium">
                <Menu.Item
                  className="rita-menu-item rita-menu-item-danger"
                  onSelect={() => {
                    if (!window.confirm("أرشفة الكتاب؟ دروسه بتختفي من مسار الطلاب.")) return;
                    void statusFn({ data: { curriculumId: book.id, status: "archived" } })
                      .then(async () => {
                        toast.success("انأرشف الكتاب");
                        await onChanged();
                        onBack();
                      })
                      .catch((error) => toast.error(errorText(error)));
                  }}
                >
                  أرشفة الكتاب
                  <small>بيختفي من القائمة ومن مسار الطلاب</small>
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>

      <nav aria-label="مراحل الكتاب">
        <ol className="rita-stepper">
          {BOOK_STEPS.map((item, index) => (
            <li key={item} className="contents">
              <button
                type="button"
                onClick={() => onStep(item)}
                className="rita-step text-start"
                data-done={progress.done[item]}
                aria-current={item === step ? "step" : undefined}
              >
                <span className="block text-[12.5px] text-[var(--pp-muted)]">{index + 1}</span>
                {STEP_LABEL[item]}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="rounded-2xl border border-[var(--pp-line)] bg-white p-5 sm:p-6">
        {step === "read" && (
          <StepRead
            book={book}
            missingText={missingText}
            reader={reader}
            onNext={() => onStep("lessons")}
            onChanged={onChanged}
          />
        )}
        {step === "lessons" && (
          <StepLessons
            book={book}
            windows={windows}
            lessons={lessons}
            exercisesReady={exercisesReady}
            study={study}
            onNext={() => onStep("review")}
            onChanged={changed}
          />
        )}
        {step === "review" && (
          <StepReview
            book={book}
            lessons={lessons}
            exercises={exercises}
            exercisesReady={exercisesReady}
            study={study}
            slides={slides}
            slidesReady={slidesReady}
            slidesShared={slidesShared}
            sharedReady={sharedReady}
            resources={resources}
            resourcesReady={resourcesReady}
            onNext={() => onStep("publish")}
            onChanged={changed}
          />
        )}
        {step === "publish" && (
          <StepPublish
            book={book}
            lessons={lessons}
            allLessons={allLessons}
            exercises={exercises}
            onChanged={onChanged}
          />
        )}
      </div>

      {!exercisesReady && (
        <p className="rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
          التمارين بدها تحديث قاعدة البيانات: طبّق migration ‏20261025100000_rita_lessons_v2 بـ
          Lovable Cloud. لحد هداك، الدروس بتنصنع بدون تمارين.
        </p>
      )}

      <AdvancedTools book={book} windows={windows} reader={reader} onChanged={onChanged} />
    </div>
  );
}
