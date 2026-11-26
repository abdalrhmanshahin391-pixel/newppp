// The lesson factory, one book: read it, choose the lessons its pages give, make them. Laid out
// like the home page's features: the big cover and title, then three rows («01 / 02 / 03»), each
// with its words and one black pill on one side and the work in a white card on the other (sides
// swap row by row, stacked on phones), and a black card at the end when lessons wait for review.
// Reviewing and publishing a made lesson is the other page (/admin/publish). A lesson is made in full by one press (the lesson, its slides, the check and
// the link), so nothing here asks the admin to link a guide or choose a lesson kind.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { lessonPlan, lessonReadiness, type SlidesState } from "@/lib/rita-book-flow";
import {
  adminConfirmBlankPage,
  adminSetCurriculumStatus,
  adminSetLessonStatus,
  type CurriculumRow,
  type LessonRow,
  type WindowRow,
} from "@/lib/rita-curriculum.functions";
import { adminBookStudyState, type BookStudyState } from "@/lib/study/study.functions";
import { pipelineView, STEP_TEXT, type BookRow } from "@/lib/study/lesson-maker";
import type { TopicSuggestion } from "@/lib/rita-slides";
import { NextLessonPicker } from "@/components/rita-lessons/admin/NextLessonPicker";
import { LessonImage } from "@/components/rita-lessons/LessonArt";
import { errorText, pagesLabel, slidesOf } from "../book/book-utils";
import { BidiText, ErrorBox, MakerSteps } from "../book/BookBits";
import { UnreadablePages } from "../book/UnreadablePages";
import { AdvancedTools } from "../book/AdvancedTools";
import { GuidesPanel } from "../book/GuidesPanel";
import { useGuides } from "../book/useGuides";
import { useLessonMaker, type LessonMaker } from "../book/useLessonMaker";
import { useBookReader } from "../book/useBookReader";
import { WordsIn } from "../HomeBits";
import { Bar, BookCover, kindName } from "./FactoryBits";

const keyOf = (item: TopicSuggestion) => `${item.topic}:${item.from_page}-${item.to_page}`;

export function FactoryBook({
  book,
  windows,
  lessons,
  missingText,
  pdfCache,
  onBack,
  onChanged,
}: {
  book: CurriculumRow;
  windows: WindowRow[];
  lessons: LessonRow[];
  missingText: number[];
  pdfCache: Map<string, File>;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const studyFn = useServerFn(adminBookStudyState);
  const bookStatusFn = useServerFn(adminSetCurriculumStatus);
  // Whether the study tables exist, and each lesson's slides (linked or not, review points).
  const [study, setStudy] = useState<BookStudyState>({ ready: false });
  const loadStudy = useCallback(async () => {
    try {
      setStudy(await studyFn({ data: { curriculumId: book.id } }));
    } catch {
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
  const slideStates = useMemo(() => slidesOf(study), [study]);
  const maker = useLessonMaker({
    book,
    setup: { exercisesReady: false, studyReady: study.ready },
    onChanged: changed,
  });
  const busy = reader.running || maker.running;

  // Reading and making stop when the page closes: say so before it does.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  function leave(go: () => void) {
    if (busy && !window.confirm("في شغل شغّال (قراءة أو صناعة دروس). إذا طلعت بيوقف. نطلع؟"))
      return;
    if (reader.running) reader.stop();
    if (maker.running) maker.stop();
    go();
  }

  const live = useMemo(
    () =>
      lessons
        .filter((lesson) => lesson.status !== "archived")
        .sort((a, b) => a.lesson_no - b.lesson_no),
    [lessons],
  );
  const readinessOf = (lesson: LessonRow) => lessonReadiness(lesson, slideStates[lesson.id]);
  const waiting = live.filter((lesson) => {
    const state = readinessOf(lesson);
    return state === "ready" || state === "warnings";
  }).length;
  const published = live.filter((lesson) => readinessOf(lesson) === "published").length;

  return (
    <div>
      <button type="button" className="la-back" onClick={() => leave(onBack)}>
        <ArrowRight size={16} aria-hidden="true" /> كل الكتب
      </button>

      <header className="la-bookhero">
        <BookCover book={book} big />
        <div className="min-w-0 flex-1">
          <p className="la-eyebrow">
            {kindName(book.kind)} · {book.level} · {book.target_language.toUpperCase()}
          </p>
          <WordsIn as="h1" className="la-title" text={book.title_ar || book.title} />
          <div className="la-chips">
            {book.title_ar && (
              <span className="la-chip">
                <bdi dir="ltr">{book.title}</bdi>
              </span>
            )}
            <span className="la-chip">{book.page_count} صفحة</span>
            <span className="la-chip">{live.length} درس</span>
            {published > 0 && <span className="la-chip is-ink">{published} منشور</span>}
            <span className={book.status === "published" ? "la-chip is-ink" : "la-chip"}>
              الكتاب {book.status === "published" ? "منشور" : "مسودة"}
            </span>
          </div>
        </div>
        <Menu.Root dir="rtl">
          <Menu.Trigger asChild>
            <button
              type="button"
              className="la-btn is-quiet is-sm la-bookhero-menu"
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
                  void bookStatusFn({ data: { curriculumId: book.id, status: "archived" } })
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
      </header>

      <div className="la-features">
        <ReadCard book={book} missingText={missingText} reader={reader} onChanged={onChanged} />
        <MakeCard
          book={book}
          windows={windows}
          lessons={lessons}
          studyReady={study.ready}
          maker={maker}
          readerRunning={reader.running}
        />
        <MadeCard
          book={book}
          lessons={live}
          study={study}
          slideStates={slideStates}
          maker={maker}
          onChanged={changed}
        />
      </div>

      {waiting > 0 ? (
        <section className="la-black" aria-label="بانتظار المراجعة">
          <div>
            <p className="la-black-eyebrow">الخطوة الجاية</p>
            <h2 className="la-black-title">
              {waiting === 1 ? "درس واحد جاهز للمراجعة." : `${waiting} دروس جاهزين للمراجعة.`}
            </h2>
            <p className="la-black-text">شوفهم زي الطالب وانشرهم للكل من صفحة المراجعة والنشر.</p>
          </div>
          <Link to="/admin/publish" search={{ book: book.id }} className="la-btn is-white">
            المراجعة والنشر <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        </section>
      ) : live.length > 0 && published === live.length ? (
        <section className="la-black" aria-label="كل الدروس منشورة">
          <div>
            <p className="la-black-eyebrow">خلصنا</p>
            <h2 className="la-black-title">كل دروس هالكتاب منشورة.</h2>
            <p className="la-black-text">الطلاب بيشوفوها بالمسار بمستوى {book.level}.</p>
          </div>
          <Link to="/rita-lessons" className="la-btn is-white">
            شوف المسار <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <details className="la-more">
        <summary>أدوات متقدمة</summary>
        <AdvancedTools book={book} windows={windows} reader={reader} onChanged={onChanged} />
      </details>
    </div>
  );
}

/** Card 1: read the book. One button reads every page (scanned ones too). */
function ReadCard({
  book,
  missingText,
  reader,
  onChanged,
}: {
  book: CurriculumRow;
  missingText: number[];
  reader: ReturnType<typeof useBookReader>;
  onChanged: () => Promise<void>;
}) {
  const blankFn = useServerFn(adminConfirmBlankPage);
  const done = book.page_count > 0 && book.read_cursor >= book.page_count;
  const read = Math.min(book.read_cursor, book.page_count);
  const share = book.page_count ? Math.round((read / book.page_count) * 100) : 0;
  const missing = new Set(missingText);
  const blankPages = reader.remarks.filter((item) => item.kind === "blank");
  const cutPages = reader.remarks.filter((item) => item.kind === "cut");
  const stuck = missingText.filter((page) => page <= book.read_cursor || done);

  async function markBlank(page: number) {
    try {
      await blankFn({ data: { curriculumId: book.id, pageNo: page } });
      toast.success(`ص${page} انعلّمت فارغة`);
      await onChanged();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <section className="la-feature" aria-labelledby="la-read-title">
      <div className="la-feature-copy">
        <p className="la-feature-no">{done ? "01 · خلصت ✓" : "01"}</p>
        <h2 id="la-read-title" className="la-feature-title">
          اقرأ الكتاب
        </h2>
        <p className="la-feature-text">
          بنقرأ كل صفحة (حتى الممسوحة) وبنكتب ملخص، ومنه بتطلع الدروس.
        </p>
        <span className="la-feature-big">
          {share}%<small>مقروء</small>
        </span>
        {reader.running ? (
          <div className="la-actions">
            <p role="status" className="la-status m-0">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              {reader.status || "عم نقرأ…"}
            </p>
            <button type="button" onClick={reader.stop} className="la-btn is-sm">
              <Square size={13} fill="currentColor" aria-hidden="true" /> وقّف
            </button>
          </div>
        ) : !done ? (
          <div className="la-actions">
            <button
              type="button"
              onClick={() => void reader.readWholeBook()}
              className="la-btn is-ink"
            >
              <BookOpen size={17} aria-hidden="true" />
              {book.read_cursor > 0 ? "كمّل القراءة" : "اقرأ الكتاب"}
            </button>
            <span className="la-hint">خلّي الصفحة مفتوحة لحد ما يخلص. بتقدر توقف وتكمل بعدين.</span>
          </div>
        ) : null}
      </div>

      <div className="la-work">
        <p className="la-work-lead">
          {done ? "انقرأ الكتاب كامل ✓" : `قرينا ${read} من ${book.page_count} صفحة`}
        </p>
        <p className="la-work-sub">
          نص جاهز لـ {Math.max(0, book.page_count - missingText.length)} من {book.page_count} صفحة
          {missingText.length > 0 ? ` · ${missingText.length} لسا بلا نص` : ""}
        </p>
        <Bar value={read} max={book.page_count} />

        {book.page_count > 0 && (
          <>
            <div className="la-pagemap" dir="ltr" aria-hidden="true">
              {Array.from({ length: Math.min(book.page_count, 400) }, (_, index) => index + 1).map(
                (page) => (
                  <span
                    key={page}
                    title={`ص${page}`}
                    data-state={
                      missing.has(page) && page <= book.read_cursor
                        ? "missing"
                        : page <= book.read_cursor
                          ? "read"
                          : "todo"
                    }
                  />
                ),
              )}
            </div>
            <p className="la-legend">
              <span>
                <i style={{ background: "var(--la-ink)" }} />
                مقروءة
              </span>
              <span>
                <i className="is-missing" />
                بلا نص
              </span>
              <span>
                <i style={{ background: "var(--la-line)" }} />
                لسا
              </span>
            </p>
          </>
        )}

        {reader.error && (
          <div className="mt-3">
            <ErrorBox hint={reader.error.hint} raw={reader.error.raw} onClose={reader.clearError} />
          </div>
        )}
        <div className="mt-3">
          <UnreadablePages
            book={book}
            problems={reader.problems}
            reader={reader}
            onChanged={onChanged}
          />
        </div>
        {reader.textNote && !reader.running && (
          <p className="la-note mt-3">
            ما قدرنا ناخد النص من {reader.textNote.count} صفحة داخل الملف على هالجهاز (
            <bdi dir="ltr">{reader.textNote.cause}</bdi>). بنقراها بالذكاء الاصطناعي بدالها.
          </p>
        )}
        {!reader.running && (blankPages.length > 0 || cutPages.length > 0) && (
          <div className="la-note mt-3">
            {blankPages.length > 0 && (
              <p className="m-0">
                {blankPages.map((item) => `ص${item.page_no}`).join("، ")}: ما فيها نص (غلاف أو صفحة
                فاضية)، فانعلّمت فارغة.
              </p>
            )}
            {cutPages.length > 0 && (
              <p className="m-0">
                {cutPages.map((item) => `ص${item.page_no}`).join("، ")}: صفحة طويلة كثير وانقطع نصها
                بالآخر.
              </p>
            )}
          </div>
        )}
        {stuck.length > 0 && !reader.running && reader.problems.length === 0 && (
          <details className="la-note is-look mt-3">
            <summary className="cursor-pointer font-bold">
              {stuck.length} صفحة لسا بلا نص. «كمّل القراءة» بيجرّبها مرة ثانية، أو علّمها فارغة
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stuck.slice(0, 60).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => void markBlank(page)}
                  className="la-btn is-sm"
                >
                  ص{page} فارغة
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

/** Card 2: the lessons the pages read so far give. Tick the ones wanted, then make them. */
function MakeCard({
  book,
  windows,
  lessons,
  studyReady,
  maker,
  readerRunning,
}: {
  book: CurriculumRow;
  windows: WindowRow[];
  lessons: LessonRow[];
  studyReady: boolean;
  maker: LessonMaker;
  readerRunning: boolean;
}) {
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
  const [sent, setSent] = useState<Record<string, string>>({});
  const guides = useGuides(book.id);
  const working = maker.running || guides.running;
  const chosen = plan.filter((item) => !unchecked.has(keyOf(item)));
  const nextNo = lessons.reduce((max, lesson) => Math.max(max, lesson.lesson_no), 0) + 1;
  const setup = { exercisesReady: false, studyReady };

  const rowOf = (item: TopicSuggestion): BookRow => ({
    key: keyOf(item),
    lessonId: null,
    title: item.title_ar || item.topic,
    titleEn: item.topic,
    topic: (topics[keyOf(item)] ?? item.topic).trim() || item.topic,
    from: item.from_page,
    to: item.to_page,
  });

  async function make(rows: BookRow[]) {
    if (!studyReady || !rows.length) return;
    setSent((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((row) => [row.key, row.title])),
    }));
    await maker.make(rows.map((row) => ({ row, facts: { exists: false } })));
  }

  // Lessons that were made but stopped at a later step: they now wait in card 3.
  const inPlan = new Set(plan.map(keyOf));
  const stopped = Object.keys(sent).filter(
    (key) => maker.runs[key]?.state === "failed" && !inPlan.has(key),
  ).length;

  return (
    <section className="la-feature is-flip" aria-labelledby="la-make-title">
      <div className="la-feature-copy">
        <p className="la-feature-no">02</p>
        <h2 id="la-make-title" className="la-feature-title">
          اختار الدروس، واصنعها
        </h2>
        <p className="la-feature-text">
          اقترحناها من الصفحات اللي انقرت. شيل الصح عن اللي ما بدك إياه، وبعدين اصنعها. كل درس
          بينصنع كامل لحاله.
        </p>
        <span className="la-feature-big">
          {plan.length}
          <small>{plan.length === 1 ? "درس مقترح" : "دروس مقترحة"}</small>
        </span>
      </div>

      <div className="la-work">
        {!studyReady && (
          <p className="la-note is-look mb-3">
            صناعة الدروس بدها جداول الدراسة التفاعلية بقاعدة البيانات. طبّقها وارجع.
          </p>
        )}

        {book.read_cursor === 0 ? (
          <p className="la-note">اقرأ الكتاب أول، وبتطلع الدروس المقترحة هون.</p>
        ) : plan.length === 0 && !maker.running ? (
          <p className="la-note">
            {lessons.some((lesson) => lesson.status !== "archived")
              ? "كل الدروس المقترحة من الصفحات المقروءة انصنعت."
              : "ما في دروس مقترحة من الصفحات المقروءة لهلأ."}
            {book.read_cursor < book.page_count ? " كمّل قراءة الكتاب لتطلع دروس جديدة." : ""}
          </p>
        ) : (
          <>
            {plan.length > 1 && !working && (
              <div className="mb-2 flex gap-1">
                <button
                  type="button"
                  className="la-btn is-quiet is-sm"
                  onClick={() => setUnchecked(new Set())}
                >
                  اختار الكل
                </button>
                <button
                  type="button"
                  className="la-btn is-quiet is-sm"
                  onClick={() => setUnchecked(new Set(plan.map(keyOf)))}
                >
                  شيل الكل
                </button>
              </div>
            )}
            <ul className="la-list">
              {plan.map((item) => {
                const key = keyOf(item);
                const run = maker.runs[key];
                const checked = !unchecked.has(key);
                return (
                  <li key={key} className="la-row" data-on={checked}>
                    <input
                      type="checkbox"
                      className="la-check"
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
                    <div className="la-row-main">
                      <p className="la-row-title">
                        <BidiText text={item.title_ar || item.topic} />
                      </p>
                      <div className="la-row-sub flex flex-wrap items-center gap-x-2">
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
                            className="w-full max-w-[22rem] rounded-lg border border-[var(--la-ink)] px-2 py-1 text-[15px] text-[var(--la-ink)]"
                          />
                        ) : (
                          <>
                            <bdi dir="ltr">{topics[key] ?? item.topic}</bdi>
                            <button
                              type="button"
                              disabled={working}
                              onClick={() => setEditing(key)}
                              aria-label="تعديل موضوع الدرس"
                              className="la-btn is-quiet is-sm !min-h-7 !px-1.5"
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                      {run && (
                        <span className="mt-1.5 block">
                          <MakerSteps steps={pipelineView({ exists: false }, setup, run)} />
                        </span>
                      )}
                      {run?.state === "failed" && (
                        <p className="la-row-fail">
                          وقف عند «{STEP_TEXT[run.step].label}»: {run.message}
                        </p>
                      )}
                    </div>
                    <span className="la-chip">{pagesLabel(item.from_page, item.to_page)}</span>
                  </li>
                );
              })}
            </ul>

            <div className="la-sticky">
              {maker.running ? (
                <>
                  <p role="status">
                    <Loader2 size={14} className="me-1 inline animate-spin" aria-hidden="true" />
                    عم نصنع الدروس، كل درس بياخد كم دقيقة. خلّي الصفحة مفتوحة.
                  </p>
                  <button type="button" onClick={maker.stop} className="la-btn is-sm">
                    <Square size={13} fill="currentColor" aria-hidden="true" /> وقّف بعد الدرس
                    الحالي
                  </button>
                </>
              ) : (
                <>
                  <p>
                    اخترت {chosen.length} من {plan.length} · كل درس بينصنع كامل لحاله
                  </p>
                  <button
                    type="button"
                    disabled={!chosen.length || working || readerRunning || !studyReady}
                    onClick={() => void make(chosen.map(rowOf))}
                    className="la-btn is-ink"
                  >
                    <Sparkles size={17} aria-hidden="true" />
                    اصنع الدروس ({chosen.length})
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {stopped > 0 && !maker.running && (
          <p className="la-note is-look mt-3">
            {stopped === 1 ? "درس واحد" : `${stopped} دروس`} انصنعوا بس ما كملوا. كمّلهم من «الدروس
            اللي انصنعت» تحت، والشغل اللي قبل الوقفة محفوظ.
          </p>
        )}

        <details className="la-more">
          <summary>خيارات إضافية</summary>
          <div className="space-y-4">
            <div>
              <p className="la-section-title">درس بموضوع وصفحات من عندك</p>
              <NextLessonPicker
                nextNo={nextNo}
                suggestions={[]}
                readCursor={book.read_cursor}
                defaultFrom={Math.min(book.taught_cursor + 1, Math.max(1, book.read_cursor))}
                busy={working || !studyReady}
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
            <div>
              <p className="la-section-title">ملفات PDF بس (للطباعة، بدون درس)</p>
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
                className="la-btn is-sm"
              >
                <FileText size={15} aria-hidden="true" />
                اصنع PDF للمختارة ({chosen.length})
              </button>
              <div className="mt-3">
                <GuidesPanel guides={guides} />
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

/**
 * Card 3: the book's lessons that exist. Each says where it is: being made, ready for review,
 * published, or stopped half way («كمّل» carries on from where it stopped).
 */
function MadeCard({
  book,
  lessons,
  study,
  slideStates,
  maker,
  onChanged,
}: {
  book: CurriculumRow;
  lessons: LessonRow[];
  study: BookStudyState;
  slideStates: Record<string, SlidesState>;
  maker: LessonMaker;
  onChanged: () => Promise<void>;
}) {
  const statusFn = useServerFn(adminSetLessonStatus);
  const [archiving, setArchiving] = useState(false);
  const setup = { exercisesReady: false, studyReady: study.ready };
  const linkedOf = (id: string) => Boolean(slideStates[id]?.linked);
  const unfinished = study.ready ? lessons.filter((lesson) => !linkedOf(lesson.id)) : [];
  /** Old talk-only lessons (made before books had slides). */
  const talkOnly = study.ready
    ? lessons.filter((lesson) => study.experience[lesson.id] !== "study" && !linkedOf(lesson.id))
    : [];
  const counts = { ready: 0, published: 0 };
  for (const lesson of lessons) {
    const state = lessonReadiness(lesson, slideStates[lesson.id]);
    if (state === "published") counts.published += 1;
    if (state === "ready" || state === "warnings") counts.ready += 1;
  }

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

  async function archiveTalkOnly() {
    const rows = talkOnly;
    if (!rows.length) return;
    const live = rows.filter((lesson) => lesson.status === "published").length;
    if (
      !window.confirm(
        `أرشفة ${rows.length} درس محادثة قديم؟${live ? ` منهم ${live} منشور، وبيختفوا عن الطلاب.` : ""}`,
      )
    )
      return;
    setArchiving(true);
    let done = 0;
    try {
      for (const lesson of rows) {
        await statusFn({ data: { lessonId: lesson.id, status: "archived" } });
        done += 1;
      }
      toast.success(`انأرشف ${done} درس محادثة قديم`);
    } catch (error) {
      toast.error(`انأرشف ${done} من ${rows.length}: ${errorText(error)}`);
    } finally {
      setArchiving(false);
      await onChanged();
    }
  }

  return (
    <section className="la-feature" aria-labelledby="la-made-title">
      <div className="la-feature-copy">
        <p className="la-feature-no">03</p>
        <h2 id="la-made-title" className="la-feature-title">
          الدروس اللي انصنعت
        </h2>
        <p className="la-feature-text">
          {lessons.length
            ? `${counts.ready} جاهز للمراجعة · ${counts.published} منشور. شوف أي درس كطالب، أو افتحه لتراجعه وتنشره.`
            : "لسا ما انصنع ولا درس من هالكتاب. اختار دروس فوق واصنعها."}
        </p>
        <span className="la-feature-big">
          {lessons.length}
          <small>{lessons.length === 1 ? "درس" : "دروس"}</small>
        </span>
        {maker.running && (
          <div className="la-actions">
            <button type="button" onClick={maker.stop} className="la-btn is-sm">
              <Square size={13} fill="currentColor" aria-hidden="true" /> وقّف بعد الدرس الحالي
            </button>
          </div>
        )}
      </div>

      <div className="la-work">
        {!lessons.length && <p className="la-note">الدروس اللي بتصنعها بتطلع هون.</p>}
        {unfinished.length > 0 && !maker.running && (
          <div className="la-note is-look mb-3 flex flex-wrap items-center gap-3">
            <span className="me-auto">
              {unfinished.length === 1 ? "درس واحد" : `${unfinished.length} دروس`} ما كملوا لسا، وما
              بيطلعوا بصفحة النشر لحد ما يكملوا.
            </span>
            <button
              type="button"
              className="la-btn is-sm is-ink"
              onClick={() => finish(unfinished)}
            >
              <Sparkles size={14} aria-hidden="true" /> كمّلهم كلهم ({unfinished.length})
            </button>
          </div>
        )}
        {talkOnly.length > 0 && !maker.running && (
          <div className="la-note mb-3 flex flex-wrap items-center gap-3">
            <span className="me-auto">
              {talkOnly.length} درس محادثة قديم (يوزرا بس، بدون شرائح). «كمّل» بيحوّله لدرس شرائح،
              أو أرشفهم.
            </span>
            <button
              type="button"
              className="la-btn is-sm"
              disabled={archiving}
              onClick={() => void archiveTalkOnly()}
            >
              <Archive size={14} aria-hidden="true" /> أرشفهم ({talkOnly.length})
            </button>
          </div>
        )}

        {lessons.length > 0 && (
          <ul className="la-list">
            {lessons.map((lesson) => {
              const state = lessonReadiness(lesson, slideStates[lesson.id]);
              const run = maker.runs[lesson.id];
              const linked = linkedOf(lesson.id);
              const notes = slideStates[lesson.id]?.notes ?? 0;
              return (
                <li key={lesson.id} className="la-row">
                  <LessonImage src={lesson.image_url} alt="" className="la-thumb !rounded-[12px]" />
                  <div className="la-row-main">
                    <p className="la-row-title">
                      <BidiText text={lesson.title_ar || lesson.title} />
                    </p>
                    <p className="la-row-sub">
                      {pagesLabel(lesson.source_from_page, lesson.source_to_page)}
                      {lesson.title_ar && (
                        <>
                          {" · "}
                          <bdi dir="ltr">{lesson.title}</bdi>
                        </>
                      )}
                    </p>
                    {run && run.state !== "failed" && (
                      <span className="mt-1.5 block">
                        <MakerSteps
                          steps={pipelineView(
                            { exists: true, status: lesson.status, linked },
                            setup,
                            run,
                          )}
                        />
                      </span>
                    )}
                    {run?.state === "failed" && (
                      <p className="la-row-fail">
                        وقف عند «{STEP_TEXT[run.step].label}»: {run.message}
                      </p>
                    )}
                  </div>
                  <div className="la-row-side">
                    {run && run.state !== "failed" ? (
                      <span className="la-status">
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        {run.state === "queued" ? "بالدور" : "عم ينصنع"}
                      </span>
                    ) : state === "published" ? (
                      <span className="la-chip is-ink">
                        <Check size={13} aria-hidden="true" /> منشور
                      </span>
                    ) : state === "ready" ? (
                      <span className="la-chip is-line">جاهز للمراجعة</span>
                    ) : state === "warnings" ? (
                      <span className="la-chip is-look">جاهز · {notes} ملاحظات</span>
                    ) : (
                      <span className="la-chip is-look">ما كمل</span>
                    )}
                    {(run?.state === "failed" || (state === "no_slides" && !run)) && (
                      <button
                        type="button"
                        className="la-btn is-sm"
                        disabled={maker.running || !study.ready}
                        onClick={() => finish([lesson])}
                      >
                        <RotateCcw size={14} aria-hidden="true" /> كمّل
                      </button>
                    )}
                    {linked && (
                      <Link
                        to="/rita-study"
                        search={{ lesson: lesson.id, preview: true }}
                        className="la-btn is-sm"
                      >
                        <Eye size={14} aria-hidden="true" /> شوفه كطالب
                      </Link>
                    )}
                    {(state === "ready" || state === "warnings" || state === "published") &&
                      !run && (
                        <Link
                          to="/admin/publish"
                          search={{ lesson: lesson.id }}
                          className="la-btn is-sm is-ink"
                        >
                          {state === "published" ? "افتحه" : "راجع وانشر"}
                        </Link>
                      )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {book.status !== "published" && counts.published > 0 && (
          <p className="la-note is-look mt-3">
            الكتاب لسا مسودة، فالطلاب ما بيشوفوا دروسه. أول ما تنشر درس من صفحة النشر بينشر الكتاب
            معه.
          </p>
        )}
      </div>
    </section>
  );
}
