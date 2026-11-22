import { useWorkspaceTask } from "../WorkspaceGuard";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, FileText, Loader2, Pencil, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { lessonPlan } from "@/lib/rita-book-flow";
import type { CurriculumRow, LessonRow, WindowRow } from "@/lib/rita-curriculum.functions";
import type { BookStudyState } from "@/lib/study/study.functions";
import { pipelineView, STEP_TEXT, type BookRow } from "@/lib/study/lesson-maker";
import { NextLessonPicker } from "@/components/rita-lessons/admin/NextLessonPicker";
import type { TopicSuggestion } from "@/lib/rita-slides";
import { pagesLabel } from "./book-utils";
import { BidiText, MakerSteps } from "./BookBits";
import { GuidesPanel } from "./GuidesPanel";
import { useGuides, type GuideProgress } from "./useGuides";
import { useLessonMaker } from "./useLessonMaker";

const keyOf = (item: TopicSuggestion) => `${item.topic}:${item.from_page}-${item.to_page}`;

/** Book lessons are made without exercises: slides on the right and Uzyra on the left. */
const NO_EXERCISES = false;

/**
 * Step 2: the lessons. The reading summaries suggest the book's lessons; the admin keeps the ones
 * wanted (and can rename a topic). One button makes each of them in full, one after the other: the
 * lesson, its slides (as many as the topic needs, like the pages of a book), then the slides checked
 * and linked. It can be stopped and started again; finished steps are not redone.
 */
export function StepLessons({
  book,
  windows,
  lessons,
  study,
  onNext,
  onChanged,
}: {
  book: CurriculumRow;
  windows: WindowRow[];
  lessons: LessonRow[];
  study: BookStudyState;
  onNext: () => void;
  onChanged: () => Promise<void>;
}) {
  const setup = { exercisesReady: NO_EXERCISES, studyReady: study.ready };
  const maker = useLessonMaker({ book, setup, onChanged });
  /** The lessons sent in this visit, by key, so a failure is still named after its row leaves. */
  const [sent, setSent] = useState<Record<string, string>>({});
  const plan = useMemo(
    () =>
      lessonPlan({
        suggestions: windows.flatMap((window) => window.summary.suggested_lessons),
        lessons,
        readCursor: book.read_cursor,
      }),
    [book.read_cursor, lessons, windows],
  );
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState("");
  const guides = useGuides(book.id);
  const working = guides.running || maker.running;
  useWorkspaceTask(working);
  const live = lessons.filter((lesson) => lesson.status !== "archived");
  const chosen = plan.filter((item) => !unchecked.has(keyOf(item)));
  const nextNo = lessons.reduce((max, lesson) => Math.max(max, lesson.lesson_no), 0) + 1;

  const rowOf = (item: TopicSuggestion): BookRow => ({
    key: keyOf(item),
    lessonId: null,
    title: item.title_ar || item.topic,
    titleEn: item.topic,
    topic: (topics[keyOf(item)] ?? item.topic).trim() || item.topic,
    from: item.from_page,
    to: item.to_page,
  });

  /** Each lesson is made in full (lesson, slides, check and link) by the lesson maker. */
  async function make(rows: BookRow[]) {
    if (!study.ready || !rows.length) return;
    setSent((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((row) => [row.key, row.title])),
    }));
    await maker.make(rows.map((row) => ({ row, facts: { exists: false } })));
  }

  // Lessons that were made but stopped at a later step: their row has left the suggestions.
  const inPlan = new Set(plan.map(keyOf));
  const stops = Object.entries(sent).flatMap(([key, title]) => {
    const run = maker.runs[key];
    return run?.state === "failed" && !inPlan.has(key) ? [{ key, title, run }] : [];
  });

  return (
    <section className="space-y-5" aria-labelledby="step-lessons-title">
      <div>
        <h2 id="step-lessons-title" className="text-[22px] font-bold">
          الدروس
        </h2>
        <p className="mt-1 text-[15px] text-[var(--pp-muted)]">
          هاي الدروس اللي اقترحناها من الكتاب. شيل الصح عن اللي ما بدك إياه، وبعدين اصنعها. كل درس
          بيطلع شرائح يمين (قد ما القاعدة بدها، زي صفحات الكتاب) ويوزرا يسار.
        </p>
        {live.length > 0 && (
          <p className="mt-1 text-[15px] font-semibold">بالكتاب هلأ {live.length} درس.</p>
        )}
      </div>

      {!study.ready && (
        <p className="rounded-xl bg-[#fff6e5] p-4 text-[15px] text-[#6b4100]">
          صناعة الدروس بدها جداول الدراسة التفاعلية بقاعدة البيانات. طبّقها من Lovable Cloud وارجع.
        </p>
      )}

      {book.read_cursor === 0 ? (
        <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">
          اقرأ الكتاب أولاً، وبعدين بتطلع الدروس المقترحة هون.
        </p>
      ) : plan.length === 0 && !maker.running && stops.length === 0 ? (
        <div className="space-y-3 rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">
          <p>
            {live.length
              ? "كل الدروس المقترحة من الصفحات المقروءة انصنعت."
              : "ما في دروس مقترحة من الصفحات المقروءة لهلأ."}
            {book.read_cursor < book.page_count ? " كمّل قراءة الكتاب لتطلع دروس جديدة." : ""}
          </p>
          {live.length > 0 && (
            <button type="button" onClick={onNext} className="rita-btn rita-btn-primary gap-2">
              الخطوة الجاية: المراجعة
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <>
          {plan.length > 0 && (
            <ul className="divide-y divide-[var(--pp-line)] rounded-xl border border-[var(--pp-line)]">
              {plan.map((item) => {
                const key = keyOf(item);
                const run = maker.runs[key];
                const checked = !unchecked.has(key);
                return (
                  <li key={key} className="flex items-start gap-3 p-3">
                    <input
                      type="checkbox"
                      className="mt-1.5 h-5 w-5 shrink-0 accent-[var(--pp-accent)]"
                      checked={checked}
                      disabled={working}
                      aria-label={`اختيار ${item.title_ar || item.topic}`}
                      onChange={() =>
                        setUnchecked((current) => {
                          const next = new Set(current);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-semibold">
                        <BidiText text={item.title_ar || item.topic} />
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-[var(--pp-muted)]">
                        <span>{pagesLabel(item.from_page, item.to_page)}</span>
                        <span aria-hidden="true">·</span>
                        {editing === key ? (
                          <input
                            autoFocus
                            value={topics[key] ?? item.topic}
                            onChange={(event) =>
                              setTopics((current) => ({ ...current, [key]: event.target.value }))
                            }
                            onBlur={() => setEditing("")}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === "Escape") setEditing("");
                            }}
                            dir="ltr"
                            aria-label="موضوع الدرس بالإنجليزي"
                            className="w-full max-w-[22rem] rounded-md border border-[var(--pp-ink)] px-2 py-1 text-[16px] text-[var(--pp-ink)]"
                          />
                        ) : (
                          <>
                            <bdi dir="ltr">{topics[key] ?? item.topic}</bdi>
                            <button
                              type="button"
                              disabled={working}
                              onClick={() => setEditing(key)}
                              aria-label="تعديل موضوع الدرس"
                              className="rita-btn rita-btn-quiet rita-btn-sm !h-8 !px-2"
                            >
                              <Pencil size={14} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                      {guides.progress[key] && <GuideLine value={guides.progress[key]} />}
                      {run && (
                        <span className="mt-1 block">
                          <MakerSteps steps={pipelineView({ exists: false }, setup, run)} />
                        </span>
                      )}
                      {run?.state === "failed" && (
                        <div className="mt-1 space-y-1">
                          <p className="text-[14px] font-semibold text-[#8c1a31]">
                            وقف عند «{STEP_TEXT[run.step].label}»: {run.message}
                          </p>
                          {run.detail && (
                            <p
                              className="break-words text-[12.5px] text-[var(--pp-muted)]"
                              dir="ltr"
                            >
                              {run.detail}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {maker.running ? (
            <button type="button" onClick={maker.stop} className="rita-btn rita-btn-soft gap-2">
              <Square size={14} fill="currentColor" aria-hidden="true" />
              إيقاف بعد الدرس الحالي
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!chosen.length || working || !study.ready}
                onClick={() => void make(chosen.map(rowOf))}
                className="rita-btn rita-btn-primary gap-2"
              >
                <Sparkles size={17} aria-hidden="true" />
                اصنع الدروس ({chosen.length})
              </button>
              {live.length > 0 && (
                <button type="button" onClick={onNext} className="rita-btn rita-btn-soft gap-2">
                  للمراجعة
                  <ArrowLeft size={17} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {maker.running && (
            <p role="status" className="text-[14px] text-[var(--pp-muted)]">
              كل درس بياخد كم دقيقة (الدرس، الشرائح، الفحص والربط). خلّي الصفحة مفتوحة.
            </p>
          )}
          {!maker.running && stops.length > 0 && (
            <div className="space-y-2 rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
              <p className="font-semibold">
                {stops.length} درس انصنع بس ما كمل. الشغل يلي قبل الوقفة محفوظ. كمّله من «المراجعة»
                بزر «كمّل».
              </p>
              <ul className="space-y-2">
                {stops.map(({ key, title, run }) => (
                  <li key={key}>
                    <p>
                      <BidiText text={title} /> · وقف عند «{STEP_TEXT[run.step].label}»:{" "}
                      {run.message}
                    </p>
                    {run.detail && (
                      <p className="break-words text-[12.5px]" dir="ltr">
                        {run.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <details className="rounded-xl border border-[var(--pp-line)] p-3">
        <summary className="cursor-pointer text-[15px] font-semibold">
          درس بموضوع وصفحات من عندك
        </summary>
        <div className="mt-3">
          <NextLessonPicker
            nextNo={nextNo}
            suggestions={[]}
            readCursor={book.read_cursor}
            defaultFrom={Math.min(book.taught_cursor + 1, Math.max(1, book.read_cursor))}
            busy={working || !study.ready}
            generatingKey={maker.running ? "custom" : ""}
            onGenerate={(pick) =>
              void make([
                {
                  key: `custom:${pick.topic}:${pick.from}-${pick.to}`,
                  lessonId: null,
                  title: pick.topic,
                  titleEn: pick.topic,
                  ...pick,
                },
              ])
            }
          />
        </div>
      </details>

      <details className="rounded-xl border border-[var(--pp-line)] p-3">
        <summary className="cursor-pointer text-[15px] font-semibold">خيارات متقدمة</summary>
        <div className="mt-3 space-y-3">
          <p className="text-[14px] text-[var(--pp-muted)]">
            شرائح PDF بس، بدون ما ينصنع درس (للطباعة أو المراجعة).
          </p>
          <button
            type="button"
            disabled={!chosen.length || working}
            onClick={() =>
              void guides
                .make(
                  chosen.map((item) => ({
                    key: keyOf(item),
                    title: (topics[keyOf(item)] ?? item.topic).trim() || item.topic,
                    from: item.from_page,
                    to: item.to_page,
                  })),
                )
                .then((made) => {
                  if (made) toast.success(`انصنع ${made} ملف PDF`);
                })
            }
            className="rita-btn rita-btn-soft gap-2"
          >
            <FileText size={17} aria-hidden="true" />
            اصنع PDF بس للمختارة ({chosen.length})
          </button>
          <GuidesPanel guides={guides} />
        </div>
      </details>
    </section>
  );
}

function GuideLine({ value }: { value: GuideProgress }) {
  if (value.stage === "failed") {
    return (
      <div className="mt-1 space-y-0.5">
        <p className="text-[14px] font-semibold text-[#8c1a31]">دليل PDF: {value.message}</p>
        {value.detail && (
          <p className="break-words text-[12.5px] text-[var(--pp-muted)]" dir="ltr">
            {value.detail}
          </p>
        )}
      </div>
    );
  }
  if (value.stage === "done") {
    return (
      <p className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-[#1d6b3a]">
        <Check size={15} aria-hidden="true" /> دليل PDF جاهز (بالقائمة تحت)
      </p>
    );
  }
  return (
    <p
      role="status"
      className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-[var(--pp-accent-text)]"
    >
      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      دليل PDF: {value.stage === "writing" ? "جاري الكتابة…" : "جاري الرسم…"}
    </p>
  );
}
