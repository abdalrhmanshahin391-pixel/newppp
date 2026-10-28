import { useCallback, useEffect, useMemo, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { lessonPlan, type BookStep, type ExercisesState } from "@/lib/rita-book-flow";
import {
  adminSetCurriculumStatus,
  adminSetLessonStatus,
  type CurriculumRow,
  type LessonRow,
  type WindowRow,
} from "@/lib/rita-curriculum.functions";
import type { Resource } from "@/lib/rita-resources";
import type { Slide } from "@/lib/rita-slides";
import { adminBookStudyState, type BookStudyState } from "@/lib/study/study.functions";
import {
  bookRows,
  bookSummary,
  makeAllQueue,
  pipelineView,
  rowStatus,
  type BookRow,
  type LessonFacts,
  type MakerSetup,
} from "@/lib/study/lesson-maker";
import { lessonReadiness } from "@/lib/rita-book-flow";
import { NextLessonPicker } from "@/components/rita-lessons/admin/NextLessonPicker";
import { errorText, pagesLabel } from "./book-utils";
import { KindBadge } from "./BookBits";
import { AdvancedTools } from "./AdvancedTools";
import { BookHero, BookList, BookMeter, type ListRow } from "./BookList";
import { LessonDrawer, type DrawerTab } from "./LessonDrawer";
import { LessonSheet, type SheetTab } from "./LessonSheet";
import { StepPublish } from "./StepPublish";
import { StepRead } from "./StepRead";
import { useBookReader } from "./useBookReader";
import { useLessonMaker } from "./useLessonMaker";

/**
 * One book on one page: reading (while it is not finished), then every lesson in one list with one
 * button each. The top card makes everything left in one go: the lesson, its exercises and its PDF
 * guide, checked and linked. A lesson opens in a sheet with "try it as a learner" and "publish";
 * the full editor is one level deeper.
 */
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
  step?: BookStep;
  onStep?: (step: BookStep) => void;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const statusFn = useServerFn(adminSetCurriculumStatus);
  const lessonStatusFn = useServerFn(adminSetLessonStatus);
  const studyFn = useServerFn(adminBookStudyState);
  const reader = useBookReader({ book, missingText, pdfCache, onChanged });
  const [study, setStudy] = useState<BookStudyState | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ id: string; tab: DrawerTab } | null>(null);

  const loadStudy = useCallback(async () => {
    try {
      setStudy(await studyFn({ data: { curriculumId: book.id } }));
    } catch {
      // The list still works without it; the guide step is then left out.
      setStudy({ ready: false });
    }
  }, [book.id, studyFn]);
  useEffect(() => {
    void loadStudy();
  }, [loadStudy]);

  const refresh = useCallback(async () => {
    await Promise.all([onChanged(), loadStudy()]);
  }, [loadStudy, onChanged]);

  const setup: MakerSetup = { exercisesReady, studyReady: study?.ready === true };
  const maker = useLessonMaker({ book, setup, onChanged: refresh });

  const factsOf = useCallback(
    (row: BookRow): LessonFacts => {
      if (!row.lessonId) return { exists: false };
      const lesson = lessons.find((item) => item.id === row.lessonId);
      const ex = exercises[row.lessonId];
      return {
        exists: true,
        status: lesson?.status,
        exercises: ex?.status ?? "none",
        exerciseProblems: ex?.problems ?? 0,
        linked: study?.ready ? Boolean(study.linked[row.lessonId]) : false,
      };
    },
    [exercises, lessons, study],
  );

  const rows: ListRow[] = useMemo(() => {
    const suggestions = lessonPlan({
      suggestions: windows.flatMap((window) => window.summary.suggested_lessons),
      lessons,
      readCursor: book.read_cursor,
    });
    return bookRows(lessons, suggestions).map((row) => {
      const facts = factsOf(row);
      const run = maker.runs[row.key];
      const ex = row.lessonId ? exercises[row.lessonId] : undefined;
      const note = [
        pagesLabel(row.from, row.to),
        row.lessonId && ex && ex.status !== "none" ? "فيه تمارين" : "",
        facts.linked ? "دليل مربوط" : "",
        facts.status === "published" && !facts.linked && setup.studyReady
          ? "منشور بالشكل القديم"
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        row,
        status: rowStatus(facts, setup, run),
        run,
        pipeline: pipelineView(facts, setup, run),
        note,
      };
    });
    // `setup` is two booleans read from the values below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.read_cursor, exercises, factsOf, lessons, maker.runs, windows, exercisesReady, study]);

  const summary = bookSummary(rows.map((item) => item.status));
  const queue = makeAllQueue(rows.map((item) => ({ key: item.row.key, status: item.status })));
  const readyIds = rows
    .filter((item) => item.status === "ready" && item.row.lessonId)
    .map((item) => item.row.lessonId as string);
  const readDone = book.page_count > 0 && book.read_cursor >= book.page_count;
  const stuckPages = missingText.filter((page) => page <= book.read_cursor || readDone);
  const showReading =
    !readDone || reader.running || stuckPages.length > 0 || reader.remarks.length > 0;
  const [publishingAll, setPublishingAll] = useState(false);

  function makeKeys(keys: string[]) {
    void maker.make(
      rows
        .filter((item) => keys.includes(item.row.key))
        .map((item) => ({ row: item.row, facts: factsOf(item.row) })),
    );
  }

  async function publishAll() {
    setPublishingAll(true);
    try {
      for (const id of readyIds) await maker.publish(id);
    } finally {
      setPublishingAll(false);
    }
  }

  function leave(go: () => void) {
    if ((reader.running || maker.running) && !window.confirm("في شغل ماشي. إذا طلعت بيوقف. نطلع؟"))
      return;
    if (reader.running) reader.stop();
    maker.stop();
    go();
  }

  const sheetLesson = lessons.find((lesson) => lesson.id === sheetId) ?? null;
  const sheetRow = rows.find((item) => item.row.lessonId === sheetId);
  const drawerLesson = lessons.find((lesson) => lesson.id === drawer?.id) ?? null;
  const metaParts = [
    `${book.read_cursor >= book.page_count ? book.page_count : `${book.read_cursor} من ${book.page_count}`} صفحة مقروءة`,
    book.target_language.toUpperCase(),
    book.status === "published" ? "منشور" : "مسودة",
  ];

  let hero: { title: string; text: string; action: string; run: () => void } | null = null;
  if (maker.running) {
    const left = rows.filter(
      (item) => item.status === "queued" || item.status === "working",
    ).length;
    hero = {
      title: `ريتا بتصنع الدروس · باقي ${left}`,
      text: "كل درس بياخد كم دقيقة. خلّي الصفحة مفتوحة؛ إذا سكّرتها، «كمّل» بيرجع من مكان ما وقف.",
      action: "",
      run: () => {},
    };
  } else if (queue.length) {
    hero = {
      title:
        queue.length === 1
          ? "ريتا جاهزة تصنع الدرس الباقي"
          : `ريتا جاهزة تصنع ${queue.length} دروس`,
      text: "كل درس بيطلع كامل: شرح، تمارين، ودليل PDF مفحوص ومربوط بريتا.",
      action: queue.length === 1 ? "اصنع الدرس" : `اصنع ${queue.length} دروس`,
      run: () => makeKeys(queue),
    };
  } else if (readyIds.length) {
    hero = {
      title: readyIds.length === 1 ? "في درس جاهز للنشر" : `في ${readyIds.length} دروس جاهزة للنشر`,
      text: "بينشروا للطلاب مع تمارينهم، وبينشر الكتاب معهم إذا لسا مسودة.",
      action: readyIds.length === 1 ? "انشر الدرس" : `انشر ${readyIds.length} دروس`,
      run: () => void publishAll(),
    };
  }

  return (
    <div className="uz-book space-y-7">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => leave(onBack)} className="uz-btn uz-btn-quiet !px-1.5">
          <ArrowRight size={16} aria-hidden="true" /> كل الكتب
        </button>
        <Menu.Root dir="rtl">
          <Menu.Trigger asChild>
            <button type="button" className="uz-icon-btn" aria-label="خيارات الكتاب">
              <MoreHorizontal size={18} />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={6} className="rita-menu edith-premium">
              {book.status === "published" && (
                <Menu.Item
                  className="rita-menu-item"
                  onSelect={() => {
                    if (!window.confirm("إلغاء نشر الكتاب؟ كل دروسه بتختفي عن الطلاب.")) return;
                    void statusFn({ data: { curriculumId: book.id, status: "draft" } })
                      .then(async () => {
                        toast.success("رجع الكتاب مسودة");
                        await refresh();
                      })
                      .catch((error) => toast.error(errorText(error)));
                  }}
                >
                  إلغاء نشر الكتاب
                  <small>الدروس بتختفي عن الطلاب وما بينحذف إشي</small>
                </Menu.Item>
              )}
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

      <header className="space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[var(--pp-muted)]">
          <KindBadge kind={book.kind} />
          {metaParts.map((part, index) => (
            <span key={index} className="whitespace-nowrap tabular-nums">
              {index > 0 && <span aria-hidden="true">· </span>}
              {part}
            </span>
          ))}
        </p>
        <h1 className="uz-title">
          <bdi dir="auto">{book.title_ar || book.title}</bdi>
        </h1>
        {rows.length > 0 && (
          <BookMeter
            segments={summary.segments}
            label={[
              summary.published && `${summary.published} منشور`,
              summary.ready && `${summary.ready} جاهز`,
              summary.working && `${summary.working} بينعمل`,
              summary.left && `${summary.left} باقي`,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
      </header>

      {showReading && (
        <section className="uz-card">
          <StepRead
            book={book}
            missingText={missingText}
            reader={reader}
            onNext={() =>
              document.getElementById("uz-lessons")?.scrollIntoView({ behavior: "smooth" })
            }
            onChanged={refresh}
          />
        </section>
      )}

      {hero && (
        <BookHero
          title={hero.title}
          text={hero.text}
          action={hero.action}
          busy={maker.running || publishingAll}
          onAction={hero.run}
          onStop={maker.running ? maker.stop : undefined}
        />
      )}

      <div id="uz-lessons">
        {study === null ? (
          <div className="grid place-items-center py-16">
            <Loader2
              className="animate-spin text-[var(--pp-accent-text)]"
              aria-label="جاري التحميل"
            />
          </div>
        ) : rows.length === 0 ? (
          <p className="uz-card text-[15px] text-[var(--pp-muted)]">
            {book.read_cursor === 0
              ? "اقرأ الكتاب أولاً، وبعدين بتطلع دروسه هون."
              : "ما في دروس مقترحة من الصفحات المقروءة لهلأ. كمّل القراءة، أو اعمل درس من عندك تحت."}
          </p>
        ) : (
          <BookList
            rows={rows}
            busy={maker.running || publishingAll}
            publishing={maker.publishing}
            onOpen={(item) => item.row.lessonId && setSheetId(item.row.lessonId)}
            onAction={(item) => {
              const action = item.status;
              if (action === "ready" && item.row.lessonId) void maker.publish(item.row.lessonId);
              else if (action === "published" && item.row.lessonId) setSheetId(item.row.lessonId);
              else makeKeys([item.row.key]);
            }}
          />
        )}
      </div>

      {!setup.exercisesReady && (
        <p className="rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
          التمارين بدها تحديث قاعدة البيانات: طبّق migration ‏20261025100000_rita_lessons_v2 بـ
          Lovable Cloud. لحد هداك، الدروس بتنصنع بدون تمارين.
        </p>
      )}
      {study && !study.ready && (
        <p className="rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
          أدلة الـPDF وربطها بريتا بدها تحديث قاعدة البيانات: طبّق migration
          ‏20261028120000_rita_study_lessons بـ Lovable Cloud. لحد هداك، الدروس بتنصنع بدون دليل.
        </p>
      )}

      <div className="space-y-3">
        <details className="uz-fold">
          <summary>درس بموضوع وصفحات من عندك</summary>
          <div className="mt-3">
            <NextLessonPicker
              nextNo={lessons.reduce((max, lesson) => Math.max(max, lesson.lesson_no), 0) + 1}
              suggestions={[]}
              readCursor={book.read_cursor}
              defaultFrom={Math.min(book.taught_cursor + 1, Math.max(1, book.read_cursor))}
              busy={maker.running}
              generatingKey={maker.running ? "custom" : ""}
              onGenerate={(pick) =>
                void maker.make([
                  {
                    row: {
                      key: `custom:${pick.topic}:${pick.from}-${pick.to}`,
                      lessonId: null,
                      no: null,
                      title: pick.topic,
                      titleEn: pick.topic,
                      topic: pick.topic,
                      from: pick.from,
                      to: pick.to,
                    },
                    facts: { exists: false },
                  },
                ])
              }
            />
          </div>
        </details>
        <details className="uz-fold">
          <summary>النشر بالجملة وترتيب مسار الطلاب</summary>
          <div className="mt-3">
            <StepPublish
              book={book}
              lessons={lessons}
              allLessons={allLessons}
              exercises={exercises}
              onChanged={refresh}
            />
          </div>
        </details>
        <AdvancedTools book={book} windows={windows} reader={reader} onChanged={refresh} />
      </div>

      <LessonSheet
        lesson={sheetLesson}
        status={sheetRow?.status ?? "ready"}
        facts={{
          exercises: sheetLesson ? (exercises[sheetLesson.id]?.status ?? "none") : "none",
          exerciseProblems: sheetLesson ? (exercises[sheetLesson.id]?.problems ?? 0) : 0,
          linked: Boolean(sheetLesson && study?.ready && study.linked[sheetLesson.id]),
        }}
        busy={maker.running}
        publishing={Boolean(sheetLesson && maker.publishing === sheetLesson.id)}
        onClose={() => setSheetId(null)}
        onPublish={() => sheetLesson && void maker.publish(sheetLesson.id)}
        onUnpublish={() => {
          if (!sheetLesson) return;
          void lessonStatusFn({ data: { lessonId: sheetLesson.id, status: "draft" } })
            .then(async () => {
              toast.success("رجع الدرس مسودة");
              await refresh();
            })
            .catch((error) => toast.error(errorText(error)));
        }}
        onFinish={() => sheetRow && makeKeys([sheetRow.row.key])}
        onEdit={(tab: SheetTab) => {
          if (!sheetLesson) return;
          // One window at a time: the sheet closes and the full editor opens at that part.
          setSheetId(null);
          setDrawer({ id: sheetLesson.id, tab });
        }}
      />

      <LessonDrawer
        lesson={drawerLesson}
        initialTab={drawer?.tab}
        readiness={
          drawerLesson ? lessonReadiness(drawerLesson, exercises[drawerLesson.id]) : "no_exercises"
        }
        bookPublished={book.status === "published"}
        studyLinked={Boolean(drawerLesson && study?.ready && study.linked[drawerLesson.id])}
        slides={slides}
        slidesReady={slidesReady}
        slidesShared={slidesShared}
        sharedReady={sharedReady}
        resources={resources}
        resourcesReady={resourcesReady}
        onClose={() => setDrawer(null)}
        onChanged={refresh}
      />
    </div>
  );
}
