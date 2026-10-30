import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, FileText, Loader2, Pencil, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";
import { lessonPlan } from "@/lib/rita-book-flow";
import {
  adminGenerateExercises,
  adminGenerateLesson,
  type CurriculumRow,
  type LessonRow,
  type WindowRow,
} from "@/lib/rita-curriculum.functions";
import type { BookStudyState } from "@/lib/study/study.functions";
import {
  KIND_TEXT,
  pipelineView,
  STEP_TEXT,
  type BookRow,
  type LessonKind,
} from "@/lib/study/lesson-maker";
import { NextLessonPicker } from "@/components/rita-lessons/admin/NextLessonPicker";
import type { TopicSuggestion } from "@/lib/rita-slides";
import { errorDetail, errorText, pagesLabel } from "./book-utils";
import { BidiText, LessonKindBadge, MakerSteps } from "./BookBits";
import { GuidesPanel } from "./GuidesPanel";
import { useGuides, type GuideProgress } from "./useGuides";
import { useLessonMaker } from "./useLessonMaker";

type ItemState = {
  state: "waiting" | "lesson" | "exercises" | "done" | "failed";
  error?: string;
  /** The server's own words, shown small under the hint. */
  detail?: string;
  /** The lesson was made but its exercises were not: it leaves the suggestions, so it is listed apart. */
  partial?: boolean;
  title?: string;
};

const keyOf = (item: TopicSuggestion) => `${item.topic}:${item.from_page}-${item.to_page}`;

/**
 * Step 2: the lessons. The reading summaries suggest the book's lessons; the admin keeps the ones
 * wanted (and can rename a topic) and picks their kind: red (Rita's lesson) or green (guide + Rita).
 * One button then writes each lesson and its exercises, one after the other, with progress; a green
 * lesson also gets its PDF guide, checked and linked. It can be stopped and started again; finished
 * lessons are not redone.
 */
export function StepLessons({
  book,
  windows,
  lessons,
  exercisesReady,
  study,
  onNext,
  onChanged,
}: {
  book: CurriculumRow;
  windows: WindowRow[];
  lessons: LessonRow[];
  exercisesReady: boolean;
  study: BookStudyState;
  onNext: () => void;
  onChanged: () => Promise<void>;
}) {
  const lessonFn = useServerFn(adminGenerateLesson);
  const exercisesFn = useServerFn(adminGenerateExercises);
  const [experience, setExperience] = useState<LessonKind>("classic");
  const setup = { exercisesReady, studyReady: study.ready };
  const maker = useLessonMaker({ book, setup, onChanged });
  // A green lesson needs the study tables; until they are there every new lesson is red.
  const kind: LessonKind = study.ready ? experience : "classic";
  /** The green lessons sent in this visit, by key, so a failure is still named after its row leaves. */
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
  const [progress, setProgress] = useState<Record<string, ItemState>>({});
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState("");
  const cancel = useRef(false);
  const guides = useGuides(book.id);
  const working = running || guides.running || maker.running;
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

  /** Green lessons: each one made in full (lesson, exercises, guide, link) by the lesson maker. */
  async function makeGreen(rows: BookRow[]) {
    setSent((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((row) => [row.key, row.title])),
    }));
    await maker.make(rows.map((row) => ({ row, facts: { exists: false } })));
  }

  async function makeLessons() {
    if (kind === "study") return makeGreen(chosen.map(rowOf));
    cancel.current = false;
    setRunning(true);
    const queue = [...chosen];
    let made = 0;
    try {
      for (const item of queue) {
        if (cancel.current) break;
        const key = keyOf(item);
        const set = (state: ItemState) => setProgress((current) => ({ ...current, [key]: state }));
        // Which step failed decides what the admin does next.
        let stage: "lesson" | "exercises" = "lesson";
        try {
          set({ state: "lesson" });
          const row = await lessonFn({
            data: {
              curriculumId: book.id,
              topic: (topics[key] ?? item.topic).trim() || item.topic,
              from: item.from_page,
              to: item.to_page,
            },
          });
          if (exercisesReady) {
            stage = "exercises";
            set({ state: "exercises" });
            await exercisesFn({ data: { lessonId: row.id } });
          }
          set({ state: "done" });
          made += 1;
        } catch (error) {
          set({
            state: "failed",
            error:
              stage === "exercises"
                ? `التمارين ما انكتبت: ${errorText(error)}`
                : `ما انكتب الدرس: ${errorText(error)}`,
            detail: errorDetail(error),
            partial: stage === "exercises",
            title: item.title_ar || item.topic,
          });
        }
      }
      if (made) toast.success(`انصنع ${made} درس`);
    } finally {
      setRunning(false);
      await onChanged();
    }
  }

  // Lessons made in this run stay listed with their result until the page is reloaded.
  const finished = Object.entries(progress).filter(([, value]) => value.state === "done").length;
  const failures = Object.entries(progress).filter(
    ([, value]) => value.state === "failed" && !value.partial,
  );
  const partials = Object.values(progress).filter(
    (value) => value.state === "failed" && value.partial,
  );
  // Green lessons that were made but stopped at a later step: their row has left the suggestions.
  const inPlan = new Set(plan.map(keyOf));
  const greenStops = Object.entries(sent).flatMap(([key, title]) => {
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
          هاي الدروس اللي اقترحناها من الكتاب. شيل الصح عن اللي ما بدك إياه، وبعدين اصنعها.
          {exercisesReady ? " كل درس بينصنع مع تمارينه." : ""}
        </p>
        {live.length > 0 && (
          <p className="mt-1 text-[15px] font-semibold">بالكتاب هلأ {live.length} درس.</p>
        )}
      </div>

      {book.read_cursor === 0 ? (
        <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">
          اقرأ الكتاب أولاً، وبعدين بتطلع الدروس المقترحة هون.
        </p>
      ) : plan.length === 0 &&
        !running &&
        !maker.running &&
        finished === 0 &&
        greenStops.length === 0 ? (
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
                const state = progress[key];
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
                      {state?.state === "failed" && (
                        <div className="mt-1 space-y-1">
                          <p className="text-[14px] font-semibold text-[#8c1a31]">{state.error}</p>
                          {state.detail && (
                            <p
                              className="break-words text-[12.5px] text-[var(--pp-muted)]"
                              dir="ltr"
                            >
                              {state.detail}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <ItemStatus state={state} />
                  </li>
                );
              })}
            </ul>
          )}

          {running || maker.running ? (
            <button
              type="button"
              onClick={() => {
                cancel.current = true;
                maker.stop();
              }}
              className="rita-btn rita-btn-soft gap-2"
            >
              <Square size={14} fill="currentColor" aria-hidden="true" />
              إيقاف بعد الدرس الحالي
            </button>
          ) : (
            <>
              <KindChoice
                value={kind}
                studyReady={study.ready}
                disabled={working}
                onChange={setExperience}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!chosen.length || working}
                  onClick={() => void makeLessons()}
                  className="rita-btn rita-btn-primary gap-2"
                >
                  <Sparkles size={17} aria-hidden="true" />
                  اصنع الدروس المختارة ({chosen.length})
                  <LessonKindBadge kind={kind} />
                </button>
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
                        if (made) toast.success(`انصنع ${made} دليل PDF`);
                      })
                  }
                  className="rita-btn rita-btn-soft gap-2"
                >
                  <FileText size={17} aria-hidden="true" />
                  اصنع دليل PDF ({chosen.length})
                </button>
                {live.length > 0 && (
                  <button type="button" onClick={onNext} className="rita-btn rita-btn-soft gap-2">
                    للمراجعة
                    <ArrowLeft size={17} aria-hidden="true" />
                  </button>
                )}
              </div>
            </>
          )}
          {(running || maker.running) && (
            <p role="status" className="text-[14px] text-[var(--pp-muted)]">
              {maker.running
                ? "كل درس أخضر بياخد كم دقيقة (الدرس، التمارين، الدليل، الربط). خلّي الصفحة مفتوحة."
                : "كل درس بياخد دقيقة لدقيقتين. خلّي الصفحة مفتوحة."}
            </p>
          )}
          {!maker.running && greenStops.length > 0 && (
            <div className="space-y-2 rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
              <p className="font-semibold">
                {greenStops.length} درس أخضر انصنع بس ما كمل. الشغل يلي قبل الوقفة محفوظ، والطلاب
                بياخدوا الدرس العادي لحد ما ينربط دليله. كمّله من «المراجعة» بزر «كمّل».
              </p>
              <ul className="space-y-2">
                {greenStops.map(({ key, title, run }) => (
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
          {!running && partials.length > 0 && (
            <div className="space-y-2 rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
              <p className="font-semibold">
                {partials.length} درس انصنع بدون تمارين. افتحه من «المراجعة» (الدرس ← التمارين)
                واضغط «اصنع التمارين».
              </p>
              <ul className="space-y-2">
                {partials.map((partial) => (
                  <li key={partial.title}>
                    <p>
                      <BidiText text={partial.title ?? ""} /> · {partial.error}
                    </p>
                    {partial.detail && (
                      <p className="break-words text-[12.5px]" dir="ltr">
                        {partial.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!running && failures.length > 0 && (
            <p className="text-[14px] text-[#8c1a31]">
              {failures.length} درس ما انصنع. صلّح السبب المكتوب تحته واضغط «اصنع» مرة ثانية.
            </p>
          )}
        </>
      )}

      <GuidesPanel guides={guides} />

      <details className="rounded-xl border border-[var(--pp-line)] p-3">
        <summary className="cursor-pointer text-[15px] font-semibold">
          درس بموضوع وصفحات من عندك <LessonKindBadge kind={kind} />
        </summary>
        <div className="mt-3">
          <NextLessonPicker
            nextNo={nextNo}
            suggestions={[]}
            readCursor={book.read_cursor}
            defaultFrom={Math.min(book.taught_cursor + 1, Math.max(1, book.read_cursor))}
            busy={working}
            generatingKey={running || maker.running ? "custom" : ""}
            onGenerate={(pick) => {
              if (kind === "study") {
                void makeGreen([
                  {
                    key: `custom:${pick.topic}:${pick.from}-${pick.to}`,
                    lessonId: null,
                    title: pick.topic,
                    titleEn: pick.topic,
                    ...pick,
                  },
                ]);
                return;
              }
              setRunning(true);
              void (async () => {
                try {
                  const row = await lessonFn({ data: { curriculumId: book.id, ...pick } });
                  if (exercisesReady) await exercisesFn({ data: { lessonId: row.id } });
                  toast.success("انصنع الدرس");
                } catch (error) {
                  toast.error(errorText(error));
                } finally {
                  setRunning(false);
                  await onChanged();
                }
              })();
            }}
          />
        </div>
      </details>
    </section>
  );
}

/** The kind of the new lessons: two cards, red for Rita's lesson and green for the guide + Rita. */
function KindChoice({
  value,
  studyReady,
  disabled,
  onChange,
}: {
  value: LessonKind;
  studyReady: boolean;
  disabled: boolean;
  onChange: (kind: LessonKind) => void;
}) {
  return (
    <div className="space-y-2">
      <p id="new-lessons-kind" className="text-[15px] font-semibold">
        نوع الدروس الجديدة
      </p>
      <div role="radiogroup" aria-labelledby="new-lessons-kind" className="kind-choice">
        {(["classic", "study"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={value === kind}
            data-kind={kind}
            disabled={disabled || (kind === "study" && !studyReady)}
            onClick={() => onChange(kind)}
            className="kind-card"
          >
            <span className="kind-pic" aria-hidden="true">
              <i />
              <i />
              {kind === "classic" && <i />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold">{KIND_TEXT[kind].name}</span>
              <span className="mt-0.5 block text-[13.5px] leading-relaxed text-[var(--pp-muted)]">
                {KIND_TEXT[kind].about}
              </span>
            </span>
          </button>
        ))}
      </div>
      {!studyReady && (
        <p className="text-[13.5px] text-[var(--pp-muted)]">
          «ملف + ريتا» بده تحديث قاعدة البيانات (الدراسة التفاعلية). لحد هداك الدروس الجديدة حمرا.
        </p>
      )}
    </div>
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

function ItemStatus({ state }: { state: ItemState | undefined }) {
  if (!state || state.state === "waiting") return null;
  if (state.state === "done") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-[#1d6b3a]">
        <Check size={16} aria-hidden="true" /> انصنع
      </span>
    );
  }
  if (state.state === "failed") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-[#8c1a31]">
        <X size={16} aria-hidden="true" /> ما زبط
      </span>
    );
  }
  return (
    <span
      role="status"
      className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-[var(--pp-accent-text)]"
    >
      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
      {state.state === "lesson" ? "كتابة الدرس…" : "كتابة التمارين…"}
    </span>
  );
}
