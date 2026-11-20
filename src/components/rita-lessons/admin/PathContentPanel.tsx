import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  Expand,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { CEFR, normalizeLevel } from "@/lib/rita-path-levels";
import { curriculumCoverage } from "@/lib/curriculum-coverage";
import { lessonReadiness, bookProgress, lessonPlan, type BookStep } from "@/lib/rita-book-flow";
import { adminPlacePathLesson } from "@/lib/rita-path-items.functions";
import { adminBookStudyState, type BookStudyState } from "@/lib/study/study.functions";
import { exerciseCount, type PathItem } from "@/lib/rita-path-layout";
import type { CurriculumRow } from "@/lib/rita-curriculum.functions";
import { PathStopSheet } from "../PathStopSheet";
import { BookWorkspace } from "./book/BookWorkspace";
import { BookPagePreview } from "./book/BookPagePreview";
import { NewBookDialog } from "./book/NewBookDialog";
import { LessonDrawer } from "./book/LessonDrawer";
import { LanguageCheck } from "./book/LanguageCheck";
import { useCurriculumAdminData } from "./book/useCurriculumAdminData";
import { errorText } from "./book/book-utils";
import { WorkspaceGuardContext, type WorkspaceGuard } from "./WorkspaceGuard";
import "./path-content.css";

export type ContentRequest = {
  lessonId?: string;
  item?: PathItem;
  insert?: { before?: string; after?: string };
  level?: string;
};

export default function PathContentPanel({
  request,
  language,
  items,
  onClose,
  onPractice,
  onReload,
}: {
  request: ContentRequest;
  language: string | null;
  items: PathItem[];
  onClose: () => void;
  onPractice?: (item: PathItem) => void;
  onReload: () => Promise<void>;
}) {
  const { isAdmin } = useAuth();
  const exerciseStop =
    request.item?.kind === "exercises"
      ? (items.find((item) => item.id === request.item?.id) ?? request.item)
      : undefined;
  const data = useCurriculumAdminData(isAdmin && !exerciseStop);
  const saveLayout = useServerFn(adminPlacePathLesson);
  const studyFn = useServerFn(adminBookStudyState);
  const [bookId, setBookId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [step, setStep] = useState<BookStep>("read");
  const [level, setLevel] = useState(request.level ?? "all");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"books" | "book" | "pages" | "new" | "stop">(
    request.item ? "stop" : "books",
  );
  const [stop, setStop] = useState(request.item);
  const [insert, setInsert] = useState(request.insert);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1100,
  );
  const [dirty, setDirty] = useState(false);
  const [working, setWorking] = useState(false);
  const tasks = useRef(new Set<string>());
  const [pdfCache] = useState(() => new Map<string, File>());
  const [study, setStudy] = useState<BookStudyState>({ ready: false });
  const current = useRef({ dirty, working });
  current.current = { dirty, working };
  const task = useCallback((id: string, running: boolean) => {
    if (running) tasks.current.add(id);
    else tasks.current.delete(id);
    current.current.working = tasks.current.size > 0;
    setWorking(tasks.current.size > 0);
  }, []);
  const leave = useCallback((action: () => void) => {
    if (current.current.working) {
      toast.info("في عملية شغالة. انتظرها أو أوقفها من زر الإيقاف أولاً.");
      return;
    }
    if (current.current.dirty && !window.confirm("في تعديلات لسا ما انحفظت. تتركها وتكمل؟")) return;
    current.current.dirty = false;
    setDirty(false);
    action();
  }, []);
  const saved = useCallback(() => {
    current.current.dirty = false;
    setDirty(false);
  }, []);
  const markDirty = useCallback(() => {
    current.current.dirty = true;
    setDirty(true);
  }, []);
  const guard: WorkspaceGuard = useMemo(
    () => ({ dirty, task, leave, saved, markDirty }),
    [dirty, task, leave, saved, markDirty],
  );
  const blocker = useBlocker({
    shouldBlockFn: () => isAdmin && (current.current.dirty || current.current.working),
    enableBeforeUnload: dirty || working,
    withResolver: true,
  });
  useEffect(() => {
    if (blocker.status !== "blocked") return;
    if (!current.current.working && window.confirm("في تعديلات لسا ما انحفظت. تغادر الصفحة؟"))
      blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1099px)");
    const change = () => setCompact(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const overview = data.overview;
  const books = useMemo(
    () => overview?.curricula.filter((b) => !language || b.target_language === language) ?? [],
    [overview, language],
  );
  const book = books.find((b) => b.id === bookId);
  const bookLessons = useMemo(
    () => overview?.lessons.filter((l) => l.curriculum_id === bookId) ?? [],
    [overview, bookId],
  );
  const lesson = bookLessons.find((l) => l.id === lessonId) ?? null;
  const coverage = useMemo(
    () => curriculumCoverage(book?.page_count ?? 0, bookLessons),
    [book?.page_count, bookLessons],
  );
  const refresh = data.refresh;
  const changed = useCallback(async () => {
    setDirty(false);
    await Promise.all([refresh(), onReload()]);
  }, [refresh, onReload]);
  useEffect(() => {
    if (!isAdmin || !bookId) return;
    let active = true;
    setStudy({ ready: false });
    void studyFn({ data: { curriculumId: bookId } })
      .then((s) => {
        if (active) setStudy(s);
      })
      .catch((e) => {
        if (active) toast.error(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [bookId, isAdmin, studyFn, overview]);
  const handled = useRef<ContentRequest | null>(null);
  useEffect(() => {
    if (!overview || handled.current === request) return;
    handled.current = request;
    leave(() => {
      if (request.lessonId) {
        const row = overview.lessons.find((l) => l.id === request.lessonId);
        if (!row || !books.some((b) => b.id === row.curriculum_id)) {
          toast.error("الدرس مش متاح بهاللغة.");
          return;
        }
        setBookId(row.curriculum_id);
        setLessonId(row.id);
        setMode("book");
        setStep("review");
        setPage(row.source_from_page);
      } else if (request.item) {
        setStop(request.item);
        setMode("stop");
      } else {
        setLessonId("");
        setBookId("");
        setMode("books");
        setLevel(request.level ?? "all");
        setInsert(request.insert);
      }
    });
  }, [request, overview, books, leave]);
  const choose = (b: CurriculumRow, next: BookStep) =>
    leave(() => {
      setBookId(b.id);
      setLessonId("");
      setMode("book");
      setStep(next);
      setPage(Math.max(1, Math.min(b.read_cursor + 1, b.page_count)));
    });
  const chooseLesson = (id: string) =>
    leave(() => {
      setLessonId(id);
      setMode("book");
      const row = bookLessons.find((l) => l.id === id);
      setPage(row?.source_from_page ?? 1);
    });
  async function placeLesson() {
    if (!lesson || !insert) return;
    task("place", true);
    try {
      await saveLayout({
        data: {
          lessonId: lesson.id,
          language: book!.target_language,
          level: request.level,
          ...insert,
        },
      });
      setInsert(undefined);
      await changed();
      toast.success(
        lesson.status === "published" && book?.status === "published"
          ? "انحفظ مكان الدرس"
          : "انحفظ مكان المسودة. بتظهر للطلاب بعد نشر الدرس والكتاب.",
      );
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      task("place", false);
    }
  }
  if (!isAdmin) return null;
  const shown = books.filter(
    (b) =>
      (level === "all" || normalizeLevel(b.level) === level) &&
      `${b.title} ${b.title_ar ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <WorkspaceGuardContext.Provider value={guard}>
      <Dialog.Root
        open
        modal={compact || !!exerciseStop}
        onOpenChange={(open) => {
          if (!open) leave(onClose);
        }}
      >
        <Dialog.Portal>
          {(compact || exerciseStop) && <Dialog.Overlay className="pc-overlay" />}
          <Dialog.Content
            className="pc-panel edith-premium"
            data-expanded={expanded || undefined}
            data-exercise={exerciseStop ? true : undefined}
            dir="rtl"
            aria-describedby="pc-description"
            onEscapeKeyDown={(event) => {
              event.preventDefault();
              leave(onClose);
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onInputCapture={(event) => {
              const el = event.target as HTMLElement;
              if (
                el.matches("input, textarea, select") &&
                !el.closest("[data-workspace-transient]")
              )
                setDirty(true);
            }}
          >
            <header className="pc-header">
              <div>
                <Dialog.Title>
                  {exerciseStop ? "محتوى محطة التمارين" : "إدارة المحتوى"}
                </Dialog.Title>
                <p id="pc-description">
                  للأدمن فقط · {language?.toUpperCase() ?? "كل اللغات"}
                  {book ? ` · ${book.level}` : ""}
                </p>
              </div>
              {exerciseStop && exerciseCount(exerciseStop) > 0 && onPractice && (
                <button
                  type="button"
                  className="rita-btn rita-btn-primary"
                  onClick={() => leave(() => onPractice(exerciseStop))}
                >
                  ابدأ التدريب
                </button>
              )}
              <button
                className="rita-btn rita-btn-icon pc-expand"
                aria-label={expanded ? "تصغير اللوحة" : "توسيع اللوحة"}
                aria-pressed={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                <Expand size={17} />
              </button>
              <button
                className="rita-btn rita-btn-icon"
                aria-label="إغلاق إدارة المحتوى"
                onClick={() => leave(onClose)}
              >
                <X size={19} />
              </button>
            </header>
            {(dirty || working) && (
              <div className="pc-notice" role="status">
                {working
                  ? "عملية شغالة… انتظرها أو استخدم زر الإيقاف المتاح."
                  : "عندك تعديلات غير محفوظة."}
              </div>
            )}
            {insert && (
              <div className="pc-insert">
                <span>
                  إضافة درس في المكان المحدد · {request.level ?? "المستوى الحالي"}
                  <small>اختار كتابًا، أنشئ أو افتح درسًا، ثم ثبّت مكانه.</small>
                </span>
                <button
                  className="rita-btn rita-btn-quiet"
                  onClick={() => leave(() => setInsert(undefined))}
                >
                  إلغاء
                </button>
              </div>
            )}
            <div className="pc-body">
              {exerciseStop && (
                <PathStopSheet
                  key={exerciseStop.id}
                  embedded
                  admin
                  color="#d87718"
                  item={exerciseStop}
                  onClose={() => leave(onClose)}
                  onChanged={onReload}
                />
              )}
              {!exerciseStop && data.loadError && (
                <div className="pc-error" role="alert">
                  <p>{data.loadError}</p>
                  <button className="rita-btn rita-btn-soft" onClick={() => void data.refresh()}>
                    أعد التحميل
                  </button>
                </div>
              )}
              {!exerciseStop && !overview && !data.loadError && (
                <p className="pc-loading" role="status">
                  <Loader2 size={19} className="animate-spin" /> تحميل كتب المنهج…
                </p>
              )}
              {!exerciseStop && overview && !data.loadError && (
                <>
                  {overview.needsMigration && (
                    <p className="pc-notice">
                      بعض أدوات الصفحات تحتاج تحديث قاعدة البيانات. افتح تفاصيل الكتاب لمعرفة
                      المتاح.
                    </p>
                  )}
                  {mode !== "books" && (
                    <button
                      className="rita-btn rita-btn-quiet pc-back"
                      onClick={() =>
                        leave(() => {
                          setMode("books");
                          setBookId("");
                          setLessonId("");
                        })
                      }
                    >
                      <ArrowRight size={16} /> كتب المنهج
                    </button>
                  )}
                  {mode === "books" && (
                    <>
                      <div className="pc-title-row">
                        <div>
                          <h2>كتب المنهج</h2>
                          <p>
                            {books.length} كتاب ·{" "}
                            {
                              overview.lessons.filter((l) =>
                                books.some((b) => b.id === l.curriculum_id),
                              ).length
                            }{" "}
                            درس
                          </p>
                        </div>
                        <button
                          className="rita-btn rita-btn-primary"
                          onClick={() => leave(() => setMode("new"))}
                        >
                          <Plus size={16} /> كتاب جديد
                        </button>
                      </div>
                      <div className="pc-filters" data-workspace-transient>
                        <label className="pc-search">
                          <Search size={17} />
                          <input
                            aria-label="البحث في كتب المنهج"
                            placeholder="ابحث عن كتاب…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </label>
                        <select
                          aria-label="مستوى كتب المنهج"
                          value={level}
                          onChange={(e) => setLevel(e.target.value)}
                        >
                          <option value="all">كل المستويات</option>
                          {CEFR.map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                      {!shown.length && (
                        <div className="pc-empty">
                          <BookOpen size={28} />
                          <h3>{books.length ? "ما في كتب مطابقة" : "أضف أول كتاب للمنهج"}</h3>
                          <p>
                            {books.length
                              ? "غيّر البحث أو المستوى."
                              : "ارفع الكتاب، جهّز صفحاته، وابدأ بصناعة الدروس."}
                          </p>
                        </div>
                      )}
                      <ul className="pc-books">
                        {shown.map((b) => {
                          const own = overview.lessons.filter((l) => l.curriculum_id === b.id);
                          const progress = bookProgress({
                            book: b,
                            lessons: own,
                            missingPages: overview.missingText[b.id]?.length ?? 0,
                            exercises: data.exercises[b.id] ?? {},
                            openSuggestions: lessonPlan({
                              suggestions: overview.windows
                                .filter((w) => w.curriculum_id === b.id)
                                .flatMap((w) => w.summary.suggested_lessons),
                              lessons: own,
                              readCursor: b.read_cursor,
                            }).length,
                          });
                          return (
                            <li key={b.id}>
                              <button onClick={() => choose(b, progress.next.step)}>
                                <span className="pc-book-icon">
                                  <BookOpen size={24} />
                                </span>
                                <span className="pc-book-copy">
                                  <strong dir="auto">{b.title_ar || b.title}</strong>
                                  <small>
                                    {b.level} · {b.kind === "grammar" ? "قواعد" : "مفردات"} ·{" "}
                                    {b.status === "published" ? "منشور" : "مسودة"}
                                  </small>
                                  <span>
                                    {b.read_cursor} / {b.page_count} صفحة مقروءة ·{" "}
                                    {progress.publishedLessons} / {own.length} دروس منشورة
                                  </span>
                                  <progress
                                    value={b.read_cursor}
                                    max={Math.max(1, b.page_count)}
                                    aria-label={`تقدم قراءة ${b.title}`}
                                  />
                                </span>
                                <ChevronLeft size={18} />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <details className="pc-advanced">
                        <summary>فحص لغة الكتب</summary>
                        <LanguageCheck onChanged={() => void changed()} />
                      </details>
                    </>
                  )}
                  {mode === "new" && (
                    <NewBookDialog
                      initialLanguage={language ?? ""}
                      initialLevel={level === "all" ? "A1" : normalizeLevel(level)}
                      embedded
                      open
                      pdfCache={pdfCache}
                      onOpenChange={() => leave(() => setMode("books"))}
                      onCreated={async (id) => {
                        await changed();
                        setBookId(id);
                        setMode("book");
                        setStep("read");
                      }}
                    />
                  )}
                  {mode === "stop" && stop && (
                    <PathStopSheet
                      embedded
                      key={stop.id}
                      item={items.find((i) => i.id === stop.id) ?? stop}
                      admin
                      color="#2b6df0"
                      onClose={() =>
                        leave(() => {
                          setMode("books");
                          setStop(undefined);
                        })
                      }
                      onChanged={changed}
                    />
                  )}
                  {book && (mode === "book" || mode === "pages") && (
                    <>
                      <nav className="pc-book-nav" aria-label="عرض الكتاب">
                        <button
                          aria-current={mode === "book" ? "page" : undefined}
                          onClick={() => leave(() => setMode("book"))}
                        >
                          {lesson ? "تحرير الدرس" : "إعداد الكتاب"}
                        </button>
                        <button
                          aria-current={mode === "pages" ? "page" : undefined}
                          onClick={() => leave(() => setMode("pages"))}
                        >
                          الكتاب وتغطية الصفحات
                        </button>
                      </nav>
                      {mode === "pages" ? (
                        <>
                          <h2 dir="auto">{book.title_ar || book.title}</h2>
                          <p className="pc-muted">
                            معالجة الكتاب: {book.read_cursor} / {book.page_count} · تغطية الدروس:{" "}
                            {coverage.covered} صفحة · دروس منشورة تغطي {coverage.published} صفحة.
                          </p>
                          {book.page_count > 100 && (
                            <label className="pc-page-range" data-workspace-transient>
                              نطاق الصفحات{" "}
                              <select
                                value={Math.floor((page - 1) / 100)}
                                onChange={(event) => setPage(Number(event.target.value) * 100 + 1)}
                              >
                                {Array.from(
                                  { length: Math.ceil(book.page_count / 100) },
                                  (_, n) => (
                                    <option value={n} key={n}>
                                      {n * 100 + 1}–{Math.min(book.page_count, (n + 1) * 100)}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                          )}
                          <div className="pc-coverage" aria-label="تغطية صفحات الكتاب">
                            {coverage.coverage
                              .slice(
                                Math.floor((page - 1) / 100) * 100,
                                (Math.floor((page - 1) / 100) + 1) * 100,
                              )
                              .map((p, offset) => {
                                const i = Math.floor((page - 1) / 100) * 100 + offset;
                                return (
                                  <button
                                    key={i}
                                    data-covered={
                                      p.published ? "published" : p.lessons ? "draft" : "none"
                                    }
                                    aria-label={`صفحة ${i + 1}: ${p.lessons} دروس، ${p.published} منشور`}
                                    aria-pressed={page === i + 1}
                                    onClick={() => setPage(i + 1)}
                                  >
                                    {i + 1}
                                  </button>
                                );
                              })}
                          </div>
                          <p className="pc-muted">
                            الأزرق: درس منشور · الرمادي: مسودة · الفارغ: بدون درس.{" "}
                            {coverage.overlaps > 0 &&
                              `${coverage.overlaps} صفحات مشتركة بين أكثر من درس.`}
                          </p>
                          {coverage.gaps.length > 0 && (
                            <details className="pc-advanced">
                              <summary>
                                صفحات لم تدخل في دروس ({book.page_count - coverage.covered})
                              </summary>
                              <div className="pc-gap-list">
                                {coverage.gaps.map((g) => (
                                  <button
                                    className="rita-btn rita-btn-soft"
                                    key={g.from}
                                    onClick={() => setPage(g.from)}
                                  >
                                    ص {g.from}
                                    {g.to > g.from ? `–${g.to}` : ""}
                                  </button>
                                ))}
                              </div>
                            </details>
                          )}
                          <BookPagePreview
                            book={book}
                            cache={pdfCache}
                            page={page}
                            onPage={setPage}
                          />
                          <h3>دروس هذا الكتاب</h3>
                          <ul className="pc-lessons">
                            {bookLessons.map((l) => (
                              <li key={l.id}>
                                <button onClick={() => chooseLesson(l.id)}>
                                  <span dir="auto">{l.title_ar || l.title}</span>
                                  <small>
                                    ص {l.source_from_page}–{l.source_to_page} ·{" "}
                                    {l.status === "published" ? "منشور" : "مسودة"}
                                  </small>
                                  <ChevronLeft size={16} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : lesson ? (
                        <>
                          <button
                            className="rita-btn rita-btn-quiet"
                            onClick={() => leave(() => setLessonId(""))}
                          >
                            <ArrowRight size={16} /> كل دروس الكتاب
                          </button>
                          {insert && (
                            <button
                              className="rita-btn rita-btn-primary pc-place"
                              disabled={working}
                              onClick={() => void placeLesson()}
                            >
                              <Check size={16} /> ضع هذا الدرس في المكان المحدد
                            </button>
                          )}
                          <LessonDrawer
                            embedded
                            key={lesson.id}
                            lesson={lesson}
                            initialTab="plan"
                            readiness={lessonReadiness(
                              lesson,
                              data.exercises[book.id]?.[lesson.id],
                            )}
                            bookPublished={book.status === "published"}
                            studyLinked={study.ready && Boolean(study.linked[lesson.id])}
                            kind={study.ready ? study.experience[lesson.id] : "classic"}
                            slides={overview.slides}
                            slidesReady={overview.slidesReady}
                            slidesShared={overview.slidesShared}
                            sharedReady={overview.sharedReady}
                            resources={overview.resources}
                            resourcesReady={overview.resourcesReady}
                            onClose={() => leave(() => setLessonId(""))}
                            onChanged={changed}
                          />
                        </>
                      ) : (
                        <BookWorkspace
                          key={book.id}
                          book={book}
                          windows={overview.windows.filter((w) => w.curriculum_id === book.id)}
                          lessons={bookLessons}
                          allLessons={overview.lessons.filter((l) =>
                            books.some((b) => b.id === l.curriculum_id),
                          )}
                          missingText={overview.missingText[book.id] ?? []}
                          exercises={data.exercises[book.id] ?? {}}
                          exercisesReady={data.exercisesReady}
                          slides={overview.slides}
                          slidesReady={overview.slidesReady}
                          slidesShared={overview.slidesShared}
                          sharedReady={overview.sharedReady}
                          resources={overview.resources}
                          resourcesReady={overview.resourcesReady}
                          pdfCache={pdfCache}
                          step={step}
                          onStep={(next) => leave(() => setStep(next))}
                          onBack={() =>
                            leave(() => {
                              setBookId("");
                              setMode("books");
                            })
                          }
                          onOpenLesson={chooseLesson}
                          onChanged={changed}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </WorkspaceGuardContext.Provider>
  );
}
