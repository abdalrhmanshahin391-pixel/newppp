import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Circle,
  Eye,
  FileUp,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import {
  CURRICULUM_WINDOW_PAGES,
  cursorLabelAr,
  nextWindow,
  percentOf,
  type LessonDraft,
  type Objective,
} from "@/lib/rita-curriculum";
import {
  adminConfirmBlankPage,
  adminCreateCurriculum,
  adminCurriculumOverview,
  adminGenerateLesson,
  adminGenerateLessonImage,
  adminImportCurriculumWindow,
  adminImportLesson,
  adminMoveLesson,
  adminReadCurriculumWindow,
  adminReorderLessons,
  adminRegenerateObjective,
  adminSaveCurriculumPages,
  adminSetCurriculumStatus,
  adminSetLessonStatus,
  adminTranscribeCurriculumPages,
  adminUpdateLesson,
  type CurriculumRow,
  type LessonRow,
  type WindowRow,
} from "@/lib/rita-curriculum.functions";
import { LessonImage } from "@/components/rita-lessons/LessonArt";
import { LessonForm } from "@/components/rita-lessons/LessonForm";

export const Route = createFileRoute("/admin/curricula")({
  head: () => ({
    meta: [{ title: "Rita curriculum — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminCurricula,
});

type Overview = Awaited<ReturnType<typeof adminCurriculumOverview>>;

const BUCKET = "rita-curricula";

/** Common server errors translated into Arabic guidance. */
const ERROR_HINTS: [RegExp, string][] = [
  [
    /OPENAI_API_KEY|server secrets/i,
    "مفتاح OpenAI غير مضبوط في أسرار الخادم — أضِف OPENAI_API_KEY من إعدادات المشروع ثم أعد المحاولة.",
  ],
  [/took too long/i, "استغرق رد الذكاء الاصطناعي وقتًا طويلًا — انتظر دقيقة وأعد المحاولة."],
  [
    /did not match the expected format/i,
    "رد الذكاء الاصطناعي لم يطابق الشكل المطلوب — أعد المحاولة، وإذا تكرر جرّب صياغة أبسط.",
  ],
  [/429|rate limit/i, "تجاوزت حد الاستخدام مؤقتًا — انتظر قليلًا ثم أعد المحاولة."],
  [/Forbidden: admin only/i, "هذا الإجراء يتطلب صلاحيات مشرف."],
  [/has not been read yet/i, "لا يمكن إنشاء الدرس قبل قراءة هذه الصفحات — اقرأ النافذة أولًا."],
  [
    /Could not find the function|does not exist/i,
    "هذه الميزة تحتاج تطبيق تحديث قاعدة البيانات (migration 20261015120000) في Lovable Cloud.",
  ],
];

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  // Keep the actionable page list from the server, not just the generic hint.
  const missingPages = message.match(/no text yet: ([0-9,\s]+)/i);
  if (missingPages) {
    return `الصفحات ${missingPages[1].trim()} بلا نص بعد — ستُقرأ تلقائيًا، أو أكّدها فارغة من قائمة الصفحات الناقصة.`;
  }
  for (const [pattern, hint] of ERROR_HINTS) {
    if (pattern.test(message)) return hint;
  }
  return message || "حدث خطأ";
}

/** A lesson row back in the shape the AI and the import box use. */
function lessonToDraft(lesson: LessonRow): LessonDraft {
  const plan = lesson.plan as LessonDraft["plan"] & { summary?: string };
  return {
    title: lesson.title,
    title_ar: lesson.title_ar,
    topic: lesson.topic,
    source_from_page: lesson.source_from_page,
    source_to_page: lesson.source_to_page,
    summary: plan.summary ?? "",
    objectives: lesson.objectives,
    plan: { phases: plan.phases ?? [], teacher_notes: plan.teacher_notes ?? "" },
    vocabulary: lesson.vocabulary,
    image_prompt: lesson.image_prompt ?? "",
  };
}

async function pdfFileFor(book: CurriculumRow, cache: Map<string, File>) {
  const cached = cache.get(book.id);
  if (cached) return cached;
  if (!book.pdf_path) throw new Error("لا يوجد ملف PDF محفوظ لهذا الكتاب.");
  const { data, error } = await supabase.storage.from(BUCKET).download(book.pdf_path);
  if (error || !data) throw new Error("تعذّر تنزيل ملف الكتاب.");
  const file = new File([data], `${book.id}.pdf`, { type: "application/pdf" });
  cache.set(book.id, file);
  return file;
}

function AdminCurricula() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const overviewFn = useServerFn(adminCurriculumOverview);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [pdfCache] = useState(() => new Map<string, File>());

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const next = await overviewFn();
      setOverview(next);
      setSelectedId((current) => current || next.curricula[0]?.id || "");
    } catch (error) {
      // A failed load must never leave a silent spinner: show the error and a retry.
      setOverview(null);
      setLoadError(errorText(error));
    }
  }, [overviewFn]);

  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin, refresh]);

  const selected = overview?.curricula.find((book) => book.id === selectedId) ?? null;

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <main
      dir="rtl"
      className="edith-premium min-h-screen bg-white pb-24 text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk), 'Noto Sans Arabic', sans-serif" }}
    >
      <header className="border-b border-[var(--pp-line)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[var(--pp-pink-text)]">لوحة الإدارة</p>
            <h2 className="text-[28px] font-bold leading-8">مناهج دروس ريتا</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/rita-lessons"
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[var(--pp-pink-text)]"
            >
              مسار الطالب
            </Link>
            <Link
              to="/admin"
              className="flex items-center gap-1 rounded-lg border border-[var(--pp-line)] px-4 py-2 text-sm font-bold"
            >
              الإدارة <ArrowLeft size={15} />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-5 pt-6">
        {loadError && (
          <div className="flex items-start justify-between gap-3 rounded-3xl border-2 border-[#FFD1D1] bg-[#FFF1F1] p-5">
            <div>
              <p className="font-bold text-[#C0392B]">فشل تحميل لوحة المناهج</p>
              <p className="mt-1 text-sm font-bold text-[#8A4A3A]">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="shrink-0 rounded-lg bg-[#C0392B] px-4 py-2 text-sm font-bold text-white"
            >
              أعد المحاولة
            </button>
          </div>
        )}
        {overview?.needsMigration && (
          <div className="flex items-start gap-3 rounded-3xl border-2 border-[#FFD98A] bg-[#FFF6D6] p-4 text-sm font-bold text-[#B07A00]">
            <AlertTriangle size={18} className="shrink-0" />
            <p>
              بعض ميزات هذه اللوحة تحتاج تحديث قاعدة البيانات: طبّق migration ‏20261015120000
              (‏rita_curriculum_gaps) في Lovable Cloud ثم حدّث الصفحة. حتى ذلك الحين تعمل اللوحة
              بالوضع القديم الأبطأ.
            </p>
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 pt-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <AddBookCard
            pdfCache={pdfCache}
            onCreated={async (id) => {
              await refresh();
              setSelectedId(id);
            }}
          />
          {!overview && !loadError && (
            <Loader2 className="mx-auto animate-spin text-[var(--pp-pink-text)]" />
          )}
          {overview?.curricula.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => setSelectedId(book.id)}
              className={`w-full rounded-3xl border-2 bg-white p-4 text-right transition ${
                book.id === selectedId ? "border-[var(--pp-ink)]" : "border-[var(--pp-line)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{book.title_ar || book.title}</span>
                <KindBadge kind={book.kind} />
              </div>
              <CursorBars book={book} />
              <p className="mt-2 text-xs font-bold text-[var(--pp-muted)]">{cursorLabelAr(book)}</p>
              <p className="mt-1 text-[11px] font-bold text-[var(--pp-muted)]/70">
                {book.status === "published"
                  ? "منشور للطلاب"
                  : book.status === "draft"
                    ? "مسودة"
                    : "مؤرشف"}
              </p>
            </button>
          ))}
        </aside>

        <section>
          {selected && overview ? (
            <BookDetail
              key={selected.id}
              book={selected}
              windows={overview.windows.filter((window) => window.curriculum_id === selected.id)}
              lessons={overview.lessons.filter((lesson) => lesson.curriculum_id === selected.id)}
              allLessons={overview.lessons}
              missingText={overview.missingText[selected.id] ?? []}
              needsMigration={overview.needsMigration}
              pdfCache={pdfCache}
              onChanged={refresh}
            />
          ) : (
            overview &&
            !loadError && (
              <p className="rounded-2xl border-2 border-dashed border-[var(--pp-line)] p-10 text-center font-bold text-[var(--pp-muted)]">
                ارفع كتاب القواعد وكتاب الكلمات للبدء.
              </p>
            )
          )}
        </section>
      </div>
    </main>
  );
}

function KindBadge({ kind }: { kind: "grammar" | "vocabulary" }) {
  return (
    <span
      className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold text-white ${
        kind === "vocabulary"
          ? "border border-[var(--pp-ink)] bg-[var(--pp-pink)] !text-[var(--pp-ink)]"
          : "bg-[var(--pp-ink)]"
      }`}
    >
      {kind === "vocabulary" ? "كلمات" : "قواعد"}
    </span>
  );
}

function CursorBars({ book }: { book: CurriculumRow }) {
  return (
    <div className="mt-3 space-y-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-[var(--pp-line)]">
        <div
          className="h-full rounded-full bg-[var(--pp-pink)]"
          style={{ width: `${percentOf(book.read_cursor, book.page_count)}%` }}
        />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--pp-line)]">
        <div
          className="h-full rounded-full bg-[var(--pp-ink)]"
          style={{ width: `${percentOf(book.taught_cursor, book.page_count)}%` }}
        />
      </div>
      <p className="flex justify-between text-[10px] font-bold text-[var(--pp-muted)]/70">
        <span>فاتح: مقروء</span>
        <span>غامق: مُدرَّس</span>
      </p>
    </div>
  );
}

/** The path to a published lesson: book AND lesson must both be published. */
function PublishChecklist({ book, lessons }: { book: CurriculumRow; lessons: LessonRow[] }) {
  const publishedLessons = lessons.filter((lesson) => lesson.status === "published").length;
  const items = [
    {
      done: book.read_cursor > 0,
      label: `قراءة الكتاب (${book.read_cursor}/${book.page_count} صفحة)`,
    },
    { done: lessons.length > 0, label: `إنشاء الدروس (${lessons.length})` },
    {
      done: lessons.length > 0 && publishedLessons > 0,
      label: `نشر الدروس (${publishedLessons}/${lessons.length})`,
    },
    { done: book.status === "published", label: "نشر الكتاب للطلاب" },
  ];
  return (
    <div className="mt-3 rounded-2xl bg-white p-3">
      <p className="text-xs font-bold text-[var(--pp-muted)]">قائمة تجهيز الكتاب للنشر</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-xs font-bold">
            {item.done ? (
              <CheckCircle2 size={14} className="text-[#2F8F55]" />
            ) : (
              <Circle size={14} className="text-[#C9A7FF]" />
            )}
            {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] font-bold text-[#B07A00]">
        الدرس لا يظهر للطالب إلا إذا كان الدرس والكتاب منشورين معًا.
      </p>
    </div>
  );
}

function AddBookCard({
  pdfCache,
  onCreated,
}: {
  pdfCache: Map<string, File>;
  onCreated: (id: string) => Promise<void>;
}) {
  const createFn = useServerFn(adminCreateCurriculum);
  const savePagesFn = useServerFn(adminSaveCurriculumPages);
  const [kind, setKind] = useState<"grammar" | "vocabulary">("grammar");
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState("");

  async function submit() {
    if (!file || !title.trim()) {
      toast.error("اختر ملف PDF واكتب اسم الكتاب.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      const proceed = window.confirm(
        `الملف كبير (${Math.round(file.size / 1024 / 1024)} ميغابايت) — استخراج النص في المتصفح ممكن ياخذ وقتًا طويلًا. تكمل؟`,
      );
      if (!proceed) return;
    }
    try {
      setProgress("قراءة الملف…");
      const { loadPdfForText, getPageText } = await import("@/lib/pdf-page-render");
      const doc = await loadPdfForText(file);
      const pageCount = Number(doc.numPages || 0);
      if (!pageCount) throw new Error("الملف لا يحتوي صفحات.");
      setProgress("رفع الملف…");
      const path = `books/${crypto.randomUUID()}.pdf`;
      const upload = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: "application/pdf" });
      if (upload.error) throw new Error(`رفع الملف فشل: ${upload.error.message}`);
      const book = await createFn({
        data: {
          kind,
          title: title.trim(),
          title_ar: titleAr.trim(),
          page_count: pageCount,
          pdf_path: path,
        },
      });
      pdfCache.set(book.id, file);
      let batch: { page_no: number; text: string; has_text_layer: boolean }[] = [];
      for (let page = 1; page <= pageCount; page += 1) {
        setProgress(`استخراج النص: صفحة ${page} من ${pageCount}`);
        const text = (await getPageText(doc, page)).slice(0, 20_000);
        batch.push({ page_no: page, text, has_text_layer: text.trim().length >= 20 });
        if (batch.length === 20 || page === pageCount) {
          await savePagesFn({ data: { curriculumId: book.id, pages: batch } });
          batch = [];
        }
      }
      toast.success("تمت إضافة الكتاب");
      setTitle("");
      setTitleAr("");
      setFile(null);
      await onCreated(book.id);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setProgress("");
    }
  }

  return (
    <div className="rounded-2xl bg-[var(--pp-grey)] p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <FileUp size={18} className="text-[var(--pp-pink-text)]" /> كتاب جديد
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["grammar", "vocabulary"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`rounded-xl py-2 text-sm font-bold ${kind === value ? "border-2 border-[var(--pp-ink)] bg-[var(--pp-pink)] text-[var(--pp-ink)]" : "bg-white text-[var(--pp-pink-text)]"}`}
          >
            {value === "grammar" ? "قواعد" : "كلمات"}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="عنوان الكتاب بالإنجليزية"
        dir="ltr"
        className="mt-2 w-full rounded-xl border border-[var(--pp-line)] px-3 py-2 text-sm"
      />
      <input
        value={titleAr}
        onChange={(event) => setTitleAr(event.target.value)}
        placeholder="اسم الكتاب بالعربية"
        className="mt-2 w-full rounded-xl border border-[var(--pp-line)] px-3 py-2 text-sm"
      />
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--pp-line)] py-3 text-sm font-bold text-[var(--pp-pink-text)]">
        <Upload size={16} />
        {file ? file.name : "اختر ملف PDF"}
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="button"
        disabled={Boolean(progress)}
        onClick={() => void submit()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--pp-ink)] py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {progress ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />}
        {progress || "رفع وقراءة الصفحات"}
      </button>
    </div>
  );
}

function BookDetail({
  book,
  windows,
  lessons,
  allLessons,
  missingText,
  needsMigration,
  pdfCache,
  onChanged,
}: {
  book: CurriculumRow;
  windows: WindowRow[];
  lessons: LessonRow[];
  allLessons: LessonRow[];
  missingText: number[];
  needsMigration: boolean;
  pdfCache: Map<string, File>;
  onChanged: () => Promise<void>;
}) {
  const statusFn = useServerFn(adminSetCurriculumStatus);
  const readFn = useServerFn(adminReadCurriculumWindow);
  const transcribeFn = useServerFn(adminTranscribeCurriculumPages);
  const importWindowFn = useServerFn(adminImportCurriculumWindow);
  const blankFn = useServerFn(adminConfirmBlankPage);
  const savePagesFn = useServerFn(adminSaveCurriculumPages);
  const reorderFn = useServerFn(adminReorderLessons);
  const [busy, setBusy] = useState("");
  const [openWindow, setOpenWindow] = useState<string | null>(
    windows[windows.length - 1]?.id ?? null,
  );
  const [importOpen, setImportOpen] = useState(false);
  const next = nextWindow(book);
  const [range, setRange] = useState({ from: next?.from ?? 1, to: next?.to ?? 1 });
  const [summaryJson, setSummaryJson] = useState("");
  const [readAll, setReadAll] = useState({ active: false, progress: "" });
  const cancelReadAll = useRef(false);

  // The async read-all loop needs the freshest book and gaps, not the render-time props.
  const bookRef = useRef(book);
  useEffect(() => {
    bookRef.current = book;
  }, [book]);
  const missingRef = useRef(missingText);
  useEffect(() => {
    missingRef.current = missingText;
  }, [missingText]);

  async function run(label: string, task: () => Promise<unknown>, done?: string) {
    setBusy(label);
    try {
      await task();
      if (done) toast.success(done);
      await onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy("");
    }
  }

  /** Reads one window: transcribes its missing pages first, then summarizes. */
  async function readWindow(from: number, to: number): Promise<number> {
    const bookNow = bookRef.current;
    const scanned = missingRef.current.filter((page) => page >= from && page <= to);
    if (scanned.length) {
      const { loadPdfForRender, renderPageToJpegBase64 } = await import("@/lib/pdf-page-render");
      const doc = await loadPdfForRender(await pdfFileFor(bookNow, pdfCache));
      for (let index = 0; index < scanned.length; index += 3) {
        const group = scanned.slice(index, index + 3);
        setBusy(`read:${group.join(",")}`);
        const pages = [];
        for (const page of group) {
          pages.push({
            page_no: page,
            jpegBase64: await renderPageToJpegBase64(doc, page, {
              targetWidth: 1200,
              quality: 0.72,
            }),
          });
        }
        await transcribeFn({ data: { curriculumId: bookNow.id, pages } });
      }
    }
    setBusy("read");
    const result = await readFn({ data: { curriculumId: bookNow.id, from, to } });
    return result.readCursor;
  }

  async function readNext() {
    if (!next) return;
    await run(
      "read",
      () => readWindow(next.from, next.to),
      `تمت قراءة الصفحات ${next.from}–${next.to}`,
    );
  }

  /**
   * Reads every remaining window in order. This is a sequential in-tab queue —
   * not a background job: keep the tab open, and you can stop at any window.
   */
  async function readAllWindows() {
    setReadAll({ active: true, progress: "بدء القراءة…" });
    cancelReadAll.current = false;
    let windowsRead = 0;
    try {
      let cursor = bookRef.current.read_cursor;
      const total = bookRef.current.page_count;
      while (!cancelReadAll.current) {
        const window = nextWindow({ page_count: total, read_cursor: cursor });
        if (!window) break;
        windowsRead += 1;
        setReadAll({
          active: true,
          progress: `قراءة الصفحات ${window.from}–${window.to} من ${total}…`,
        });
        const advanced = await readWindow(window.from, window.to);
        if (advanced <= cursor) break; // safety: the cursor did not move
        cursor = advanced;
      }
      if (cancelReadAll.current) toast.info("أوقفت القراءة المتتابعة عند آخر نافذة مكتملة");
      else if (windowsRead) toast.success(`قُرئت ${windowsRead} نافذة — تم تحديث الكتاب`);
      else toast.info("الكتاب مقروء كاملًا");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setReadAll({ active: false, progress: "" });
      setBusy("");
      await onChanged();
    }
  }

  /** Re-extracts text for pages whose extraction was interrupted. */
  async function resumeExtraction() {
    await run(
      "extract",
      async () => {
        const { loadPdfForText, getPageText } = await import("@/lib/pdf-page-render");
        const bookNow = bookRef.current;
        const doc = await loadPdfForText(await pdfFileFor(bookNow, pdfCache));
        const pages = missingRef.current.filter((page) => page <= bookNow.page_count);
        let batch: { page_no: number; text: string; has_text_layer: boolean }[] = [];
        for (const page of pages) {
          setBusy(`extract:${page}`);
          const text = (await getPageText(doc, page)).slice(0, 20_000);
          batch.push({ page_no: page, text, has_text_layer: text.trim().length >= 20 });
          if (batch.length === 20) {
            await savePagesFn({ data: { curriculumId: bookNow.id, pages: batch } });
            batch = [];
          }
        }
        if (batch.length) {
          await savePagesFn({ data: { curriculumId: bookNow.id, pages: batch } });
        }
      },
      "تم استكمال استخراج النص — الصفحات الممسوحة ستُقرأ عند الوصول إليها",
    );
  }

  async function importSummary() {
    await run(
      "import",
      async () => {
        const parsed = JSON.parse(summaryJson) as Record<string, unknown>;
        // Accepts the summary itself or { from_page, to_page, summary } (the sample files).
        const wrapped = parsed.summary && typeof parsed.summary === "object";
        const from =
          wrapped && typeof parsed.from_page === "number" ? parsed.from_page : range.from;
        const to = wrapped && typeof parsed.to_page === "number" ? parsed.to_page : range.to;
        await importWindowFn({
          data: { curriculumId: book.id, from, to, summary: wrapped ? parsed.summary : parsed },
        });
        setSummaryJson("");
        setImportOpen(false);
      },
      "تم حفظ الملخص",
    );
  }

  const publishedPath = useMemo(
    () =>
      allLessons
        .filter((lesson) => lesson.status === "published" && lesson.path_order != null)
        .sort((a, b) => Number(a.path_order) - Number(b.path_order)),
    [allLessons],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[var(--pp-grey)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{book.title_ar || book.title}</h2>
              <KindBadge kind={book.kind} />
            </div>
            <p className="text-sm font-semibold text-[var(--pp-muted)]" dir="ltr">
              {book.title} · {book.page_count} pages
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                void run(
                  "status",
                  () =>
                    statusFn({
                      data: {
                        curriculumId: book.id,
                        status: book.status === "published" ? "draft" : "published",
                      },
                    }),
                  book.status === "published" ? "أصبح الكتاب مسودة" : "نُشر الكتاب للطلاب",
                )
              }
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                book.status === "published"
                  ? "bg-[var(--pp-pink-soft)] text-[var(--pp-pink-text)]"
                  : "border-2 border-[var(--pp-ink)] bg-[var(--pp-pink)] text-[var(--pp-ink)]"
              }`}
            >
              {book.status === "published" ? "منشور ✓" : "نشر الكتاب"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("أرشفة هذا الكتاب؟ ستختفي دروسه من مسار الطلاب.")) {
                  void run(
                    "status",
                    () => statusFn({ data: { curriculumId: book.id, status: "archived" } }),
                    "تمت الأرشفة",
                  );
                }
              }}
              className="rounded-lg border border-[var(--pp-line)] px-4 py-2 text-sm font-bold text-[var(--pp-muted)]"
            >
              أرشفة
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="الصفحات المقروءة" value={`${book.read_cursor} / ${book.page_count}`} />
          <Stat label="الصفحات المُدرَّسة" value={`${book.taught_cursor} / ${book.page_count}`} />
          <Stat
            label="الدروس"
            value={`${lessons.filter((lesson) => lesson.status === "published").length} منشور · ${lessons.length} الكل`}
          />
        </div>
        <PublishChecklist book={book} lessons={lessons} />
        <PageStrip book={book} missingText={missingText} />
        {missingText.length > 0 && (
          <div className="mt-3 rounded-2xl border border-[#FFD98A] bg-[#FFF6D6]/60 p-3">
            <p className="text-xs font-bold text-[#B07A00]">
              {missingText.length} صفحة ناقصة (بلا نص أو غير محفوظة بعد).{" "}
              {needsMigration && "(تعليم الصفحة الفارغة يحتاج تطبيق الـ migration)"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {missingText.slice(0, 40).map((page) => (
                <button
                  key={page}
                  type="button"
                  title="تعليم هذه الصفحة كصفحة فارغة (غلاف أو فاصل)"
                  onClick={() =>
                    void run(
                      `blank:${page}`,
                      () => blankFn({ data: { curriculumId: book.id, pageNo: page } }),
                      `تم تعليم ص${page} كصفحة فارغة`,
                    )
                  }
                  className="rounded-lg border border-[#FFD98A] bg-white px-2 py-1 text-[11px] font-bold text-[#B07A00]"
                >
                  ص{page} فارغة؟
                </button>
              ))}
              {missingText.length > 40 && (
                <span className="text-[11px] font-bold text-[#B07A00]">
                  و{missingText.length - 40} أخرى
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void resumeExtraction()}
              className="mt-3 rounded-lg bg-[var(--pp-ink)] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy.startsWith("extract") ? <Loader2 size={13} className="animate-spin" /> : null}
              استكمال استخراج النص من الملف المحفوظ
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-[var(--pp-grey)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">
            ملخصات القراءة ({CURRICULUM_WINDOW_PAGES} صفحات في كل مرة)
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImportOpen((value) => !value)}
              className="rounded-lg border border-[var(--pp-line)] px-4 py-2 text-sm font-bold"
            >
              استيراد ملخص JSON
            </button>
            <button
              type="button"
              disabled={!next || Boolean(busy) || readAll.active}
              onClick={() => void readNext()}
              className="flex items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] bg-[var(--pp-pink)] px-4 py-2 text-sm font-bold text-[var(--pp-ink)] disabled:opacity-50"
            >
              {busy.startsWith("read") ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              {next ? `اقرأ الصفحات ${next.from}–${next.to}` : "قُرئ الكتاب كاملاً"}
            </button>
            {next && !readAll.active && (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void readAllWindows()}
                className="rounded-lg border-2 border-[var(--pp-ink)] px-4 py-2 text-sm font-bold text-[var(--pp-pink-text)] disabled:opacity-50"
              >
                اقرأ الكتاب كاملاً
              </button>
            )}
            {readAll.active && (
              <button
                type="button"
                onClick={() => {
                  cancelReadAll.current = true;
                }}
                className="flex items-center gap-1 rounded-lg bg-[#C0392B] px-4 py-2 text-sm font-bold text-white"
              >
                <X size={15} /> إيقاف القراءة
              </button>
            )}
          </div>
        </div>
        {readAll.active && (
          <p className="mt-2 flex items-center gap-2 text-xs font-bold text-[var(--pp-pink-text)]">
            <Loader2 size={13} className="animate-spin" />
            {readAll.progress} (قراءة متتابعة — أبقِ الصفحة مفتوحة)
          </p>
        )}
        {busy.startsWith("read:") && (
          <p className="mt-2 text-xs font-bold text-[var(--pp-pink-text)]">
            قراءة الصفحات الممسوحة {busy.slice(5)}…
          </p>
        )}
        {importOpen && (
          <div className="mt-4 space-y-2 rounded-2xl bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              من ص
              <NumberBox
                value={range.from}
                onChange={(from) => setRange((current) => ({ ...current, from }))}
              />
              إلى ص
              <NumberBox
                value={range.to}
                onChange={(to) => setRange((current) => ({ ...current, to }))}
              />
            </div>
            <textarea
              value={summaryJson}
              onChange={(event) => setSummaryJson(event.target.value)}
              dir="ltr"
              rows={8}
              placeholder='{"overview": "...", "topics": [...]}'
              className="w-full rounded-xl border border-[var(--pp-line)] p-3 font-mono text-xs"
            />
            <button
              type="button"
              disabled={!summaryJson.trim() || Boolean(busy)}
              onClick={() => void importSummary()}
              className="rounded-lg bg-[var(--pp-ink)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              حفظ الملخص
            </button>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {windows.length === 0 && (
            <p className="text-sm font-bold text-[var(--pp-muted)]/70">لم تُقرأ أي صفحات بعد.</p>
          )}
          {windows.map((window) => (
            <div key={window.id} className="rounded-2xl border border-[var(--pp-line)]">
              <button
                type="button"
                onClick={() =>
                  setOpenWindow((current) => (current === window.id ? null : window.id))
                }
                className="flex w-full items-center justify-between px-4 py-3 text-right"
              >
                <span className="font-bold">
                  الصفحات {window.from_page}–{window.to_page}
                </span>
                <span className="text-xs font-bold text-[var(--pp-muted)]">
                  {window.summary.topics.length} مواضيع ·{" "}
                  {window.source === "ai" ? "ذكاء اصطناعي" : "يدوي"}
                </span>
              </button>
              {openWindow === window.id && <WindowSummaryView window={window} />}
            </div>
          ))}
        </div>
      </div>

      <LessonsCard
        book={book}
        windows={windows}
        lessons={lessons}
        allLessons={allLessons}
        onChanged={onChanged}
      />

      {publishedPath.length > 1 && (
        <PathOrderCard
          lessons={publishedPath}
          disabled={Boolean(busy)}
          onReorder={async (lessonIds) => {
            setBusy("reorder");
            try {
              await reorderFn({ data: { lessonIds } });
              toast.success("تم تحديث ترتيب المسار");
            } catch (error) {
              toast.error(errorText(error));
              // Rethrow so the card can restore the previous on-screen order.
              throw error;
            } finally {
              setBusy("");
              await onChanged();
            }
          }}
        />
      )}
    </div>
  );
}

/** Drag-and-drop ordering of the learner path (published lessons, all books). */
function PathOrderCard({
  lessons,
  disabled,
  onReorder,
}: {
  lessons: LessonRow[];
  disabled: boolean;
  onReorder: (lessonIds: string[]) => Promise<void>;
}) {
  const [items, setItems] = useState(() =>
    lessons.map((lesson) => ({ id: lesson.id, title: lesson.title_ar || lesson.title })),
  );
  useEffect(() => {
    setItems(lessons.map((lesson) => ({ id: lesson.id, title: lesson.title_ar || lesson.title })));
  }, [lessons]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd(event: DragEndEvent) {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    const previous = items;
    setItems(next);
    void onReorder(next.map((item) => item.id)).catch(() => {
      // The server rejected the change: put the old order back on screen.
      setItems(previous);
    });
  }

  return (
    <div className="rounded-2xl bg-[var(--pp-grey)] p-5">
      <h3 className="text-lg font-bold">ترتيب مسار الطلاب</h3>
      <p className="mt-1 text-xs font-bold text-[var(--pp-muted)]">
        اسحب لإعادة الترتيب (أو استخدم أسهم التقديم والتأخير في بطاقة كل درس). الترتيب هنا عبر كل
        الكتب المنشورة.
      </p>
      <DndContext
        sensors={disabled ? [] : sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className={`mt-3 space-y-2 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
            {items.map((item, index) => (
              <SortablePathRow key={item.id} id={item.id} title={item.title} index={index} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortablePathRow({ id, title, index }: { id: string; title: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
      {...attributes}
      {...listeners}
      className="flex cursor-grab touch-none items-center gap-3 rounded-2xl border border-[var(--pp-line)] bg-white px-4 py-2 text-sm font-bold"
    >
      <GripVertical size={15} className="text-[var(--pp-muted)]/70" />
      <span className="text-xs font-bold text-[var(--pp-pink-text)]">{index + 1}</span>
      {title}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-xs font-bold text-[var(--pp-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

/** One square per page: grey unread, light read, dark taught, amber missing. */
function PageStrip({ book, missingText }: { book: CurriculumRow; missingText: number[] }) {
  const missing = new Set(missingText);
  const pages = Array.from({ length: Math.min(book.page_count, 400) }, (_, index) => index + 1);
  return (
    <div className="mt-4 flex flex-wrap gap-1" dir="ltr">
      {pages.map((page) => {
        const colour =
          page <= book.taught_cursor
            ? "bg-[var(--pp-ink)]"
            : page <= book.read_cursor
              ? "bg-[var(--pp-pink)]"
              : missing.has(page)
                ? "bg-[#FFD98A]"
                : "bg-[var(--pp-line)]";
        return <span key={page} title={`ص${page}`} className={`h-3 w-3 rounded-[3px] ${colour}`} />;
      })}
    </div>
  );
}

function NumberBox({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      type="number"
      min={1}
      value={value}
      onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
      className="w-20 rounded-lg border border-[var(--pp-line)] px-2 py-1 text-center"
    />
  );
}

function WindowSummaryView({ window }: { window: WindowRow }) {
  const { summary } = window;
  return (
    <div className="space-y-3 border-t border-[var(--pp-line)] px-4 py-3 text-sm">
      <p className="font-semibold">{summary.overview_ar || summary.overview}</p>
      {summary.topics.map((topic, index) => (
        <div key={index} className="rounded-xl bg-white p-3">
          <p className="font-bold">
            {topic.title_ar || topic.title}{" "}
            <span className="text-xs font-bold text-[var(--pp-muted)]">
              (ص{topic.from_page}
              {topic.to_page !== topic.from_page ? `–${topic.to_page}` : ""})
            </span>
          </p>
          {topic.key_points.length > 0 && (
            <ul className="mt-1 list-disc pr-5 text-[13px]" dir="ltr">
              {topic.key_points.map((point, pointIndex) => (
                <li key={pointIndex} className="text-left">
                  {point}
                </li>
              ))}
            </ul>
          )}
          {topic.vocabulary.length > 0 && (
            <p className="mt-1 text-xs text-[var(--pp-muted)]">
              {topic.vocabulary.map((item) => `${item.word} = ${item.meaning_ar}`).join(" · ")}
            </p>
          )}
        </div>
      ))}
      {summary.suggested_lessons.length > 0 && (
        <p className="text-xs font-bold text-[var(--pp-pink-text)]">
          دروس مقترحة:{" "}
          {summary.suggested_lessons.map((item) => item.title_ar || item.topic).join(" · ")}
        </p>
      )}
      {summary.continues_next_window && (
        <p className="text-xs font-bold text-[var(--pp-pink-text)]">
          الموضوع الأخير يكمل في الصفحات التالية.
        </p>
      )}
    </div>
  );
}

function LessonsCard({
  book,
  windows,
  lessons,
  allLessons,
  onChanged,
}: {
  book: CurriculumRow;
  windows: WindowRow[];
  lessons: LessonRow[];
  allLessons: LessonRow[];
  onChanged: () => Promise<void>;
}) {
  const generateFn = useServerFn(adminGenerateLesson);
  const importFn = useServerFn(adminImportLesson);
  const updateFn = useServerFn(adminUpdateLesson);
  const statusFn = useServerFn(adminSetLessonStatus);
  const curriculumStatusFn = useServerFn(adminSetCurriculumStatus);
  const imageFn = useServerFn(adminGenerateLessonImage);
  const moveFn = useServerFn(adminMoveLesson);
  const regenerateFn = useServerFn(adminRegenerateObjective);
  const [busy, setBusy] = useState("");
  const firstUntaught = Math.min(book.taught_cursor + 1, Math.max(1, book.read_cursor));
  const [form, setForm] = useState({ topic: "", from: firstUntaught, to: firstUntaught });
  const [mode, setMode] = useState<"ai" | "json">("ai");
  const [lessonJson, setLessonJson] = useState("");
  const [editing, setEditing] = useState<{ id: string; draft: LessonDraft } | null>(null);
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [publishAsk, setPublishAsk] = useState<LessonRow | null>(null);

  const suggestions = useMemo(
    () =>
      windows
        .flatMap((window) => window.summary.suggested_lessons)
        .filter(
          (item) =>
            !lessons.some((lesson) => lesson.topic.toLowerCase() === item.topic.toLowerCase()),
        ),
    [lessons, windows],
  );
  const published = allLessons
    .filter((lesson) => lesson.status === "published" && lesson.path_order != null)
    .sort((a, b) => Number(a.path_order) - Number(b.path_order));

  async function run(label: string, task: () => Promise<unknown>, done?: string) {
    setBusy(label);
    try {
      await task();
      if (done) toast.success(done);
      await onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy("");
    }
  }

  function publishLesson(lesson: LessonRow) {
    return run(
      `status:${lesson.id}`,
      () =>
        statusFn({
          data: {
            lessonId: lesson.id,
            status: lesson.status === "published" ? "draft" : "published",
          },
        }),
      lesson.status === "published" ? "أُعيد الدرس إلى المسودة" : "نُشر الدرس",
    );
  }

  /** Publish a lesson while its book is still a draft: offer both at once. */
  function askPublish(lesson: LessonRow) {
    if (book.status === "draft" && lesson.status !== "published") {
      setPublishAsk(lesson);
      return;
    }
    void publishLesson(lesson);
  }

  function toggleDraft(lessonId: string) {
    setSelectedDrafts((current) => {
      const next = new Set(current);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  }

  async function publishSelected() {
    // Only currently-draft lessons of this book are eligible; stale selections
    // (archived or already published) are filtered out, not published blindly.
    const ids = lessons
      .filter((lesson) => lesson.status === "draft" && selectedDrafts.has(lesson.id))
      .map((lesson) => lesson.id);
    if (!ids.length) {
      setSelectedDrafts(new Set());
      toast.info("لا مسودات محددة للنشر بعد الآن.");
      return;
    }
    const confirmed = window.confirm(
      `ستنشر ${ids.length} درسًا مختارًا. تأكدت من مراجعة كل واحد منها؟`,
    );
    if (!confirmed) return;
    setBusy("bulk");
    let published = 0;
    try {
      for (const lessonId of ids) {
        await statusFn({ data: { lessonId, status: "published" } });
        published += 1;
      }
      if (book.status === "draft") {
        const alsoBook = window.confirm(
          "الكتاب ما زال مسودة — الدروس لن تظهر للطلاب بدونه. تنشر الكتاب معها الآن؟",
        );
        if (alsoBook) {
          await curriculumStatusFn({ data: { curriculumId: book.id, status: "published" } });
        }
      }
      setSelectedDrafts(new Set());
      toast.success(`نُشرت ${published} دروس`);
    } catch (error) {
      toast.error(
        `نُشر ${published} من ${ids.length} قبل التوقف — عالِج الخطأ ثم أكمل الباقي: ${errorText(error)}`,
      );
    } finally {
      setBusy("");
      // Refresh even after partial failure so the list matches the server.
      await onChanged();
    }
  }

  type LessonImport = { lesson: LessonDraft; image_url: string | null };

  /** Accepts one lesson, { lesson, image_url }, or a list of either (the sample files). */
  function parseLessonJson(text: string): LessonImport[] {
    const parsed = JSON.parse(text) as unknown;
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items.map((item) => parseLessonItem(item as Record<string, unknown>));
  }

  function parseLessonItem(parsed: Record<string, unknown>): LessonImport {
    if (parsed.lesson && typeof parsed.lesson === "object") {
      return {
        lesson: parsed.lesson as LessonDraft,
        image_url: typeof parsed.image_url === "string" ? parsed.image_url : null,
      };
    }
    const { image_url, ...lesson } = parsed;
    return {
      lesson: lesson as unknown as LessonDraft,
      image_url: typeof image_url === "string" ? image_url : null,
    };
  }

  return (
    <div className="rounded-2xl bg-[var(--pp-grey)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">الدروس</h3>
        {selectedDrafts.size > 0 && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void publishSelected()}
            className="rounded-lg bg-[#2F8F55] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            انشر المحدد ({selectedDrafts.size})
          </button>
        )}
      </div>
      {book.read_cursor === 0 ? (
        <p className="mt-2 text-sm font-bold text-[var(--pp-muted)]/70">
          اقرأ أول {CURRICULUM_WINDOW_PAGES} صفحات قبل إنشاء الدروس.
        </p>
      ) : (
        <div className="mt-3 rounded-2xl bg-white p-4">
          <div className="flex gap-2">
            {(["ai", "json"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === value ? "bg-[var(--pp-ink)] text-white" : "bg-white"}`}
              >
                {value === "ai" ? "إنشاء بالذكاء الاصطناعي" : "استيراد JSON"}
              </button>
            ))}
          </div>
          {mode === "ai" ? (
            <div className="mt-3 space-y-2">
              <input
                value={form.topic}
                onChange={(event) =>
                  setForm((current) => ({ ...current, topic: event.target.value }))
                }
                placeholder="موضوع الدرس، مثال: to be verbs"
                className="w-full rounded-xl border border-[var(--pp-line)] px-3 py-2 text-sm"
              />
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 8).map((item) => (
                    <button
                      key={`${item.topic}-${item.from_page}`}
                      type="button"
                      onClick={() =>
                        setForm({ topic: item.topic, from: item.from_page, to: item.to_page })
                      }
                      className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-[var(--pp-pink-text)]"
                    >
                      {item.title_ar || item.topic} · ص{item.from_page}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                من ص
                <NumberBox
                  value={form.from}
                  onChange={(from) => setForm((current) => ({ ...current, from }))}
                />
                إلى ص
                <NumberBox
                  value={form.to}
                  onChange={(to) => setForm((current) => ({ ...current, to }))}
                />
                <span className="text-xs text-[var(--pp-muted)]">
                  (حتى ص{book.read_cursor} مقروءة)
                </span>
              </div>
              <button
                type="button"
                disabled={form.topic.trim().length < 2 || Boolean(busy)}
                onClick={() =>
                  void run(
                    "generate",
                    () =>
                      generateFn({
                        data: {
                          curriculumId: book.id,
                          topic: form.topic.trim(),
                          from: form.from,
                          to: form.to,
                        },
                      }),
                    "أُنشئ الدرس كمسودة — راجعه ثم انشره",
                  )
                }
                className="flex items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] bg-[var(--pp-pink)] px-4 py-2 text-sm font-bold text-[var(--pp-ink)] disabled:opacity-50"
              >
                {busy === "generate" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                أنشئ الدرس
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={lessonJson}
                onChange={(event) => setLessonJson(event.target.value)}
                dir="ltr"
                rows={8}
                placeholder='{"title": "...", "objectives": [...], "plan": {...}}'
                className="w-full rounded-xl border border-[var(--pp-line)] p-3 font-mono text-xs"
              />
              <button
                type="button"
                disabled={!lessonJson.trim() || Boolean(busy)}
                onClick={() =>
                  void run(
                    "import",
                    async () => {
                      const items = parseLessonJson(lessonJson);
                      // In order, so lesson numbers follow the file.
                      for (const item of items) {
                        await importFn({ data: { curriculumId: book.id, ...item } });
                      }
                      setLessonJson("");
                    },
                    "تم استيراد الدرس",
                  )
                }
                className="rounded-lg bg-[var(--pp-ink)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                استيراد الدرس
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {lessons.map((lesson) => {
          const pathIndex = published.findIndex((item) => item.id === lesson.id);
          return (
            <div key={lesson.id} className="rounded-2xl border border-[var(--pp-line)] p-4">
              <div className="flex items-start gap-3">
                <LessonImage src={lesson.image_url} alt="" className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[var(--pp-muted)]">
                    درس {lesson.lesson_no} · ص{lesson.source_from_page}
                    {lesson.source_to_page !== lesson.source_from_page
                      ? `–${lesson.source_to_page}`
                      : ""}{" "}
                    · {lesson.objectives.length} أهداف · v{lesson.version}
                    {pathIndex >= 0 ? ` · الترتيب في المسار ${pathIndex + 1}` : ""}
                  </p>
                  <p className="font-bold">{lesson.title_ar || lesson.title}</p>
                  <p className="text-sm text-[var(--pp-muted)]" dir="ltr">
                    {lesson.title}
                  </p>
                  <ul className="mt-1 list-disc pr-5 text-xs text-[var(--pp-muted)]">
                    {lesson.objectives.map((objective) => (
                      <li key={objective.id}>{objective.text_ar || objective.text}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      lesson.status === "published"
                        ? "bg-[var(--pp-pink-soft)] text-[var(--pp-pink-text)]"
                        : "bg-white text-[var(--pp-muted)]"
                    }`}
                  >
                    {lesson.status === "published" ? "منشور" : "مسودة"}
                  </span>
                  {lesson.status === "draft" && (
                    <label className="flex items-center gap-1 text-[11px] font-bold text-[var(--pp-muted)]">
                      <input
                        type="checkbox"
                        checked={selectedDrafts.has(lesson.id)}
                        onChange={() => toggleDraft(lesson.id)}
                      />
                      تحديد للنشر
                    </label>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => askPublish(lesson)}
                  className="rounded-lg border-2 border-[var(--pp-ink)] bg-[var(--pp-pink)] px-3 py-1.5 text-[var(--pp-ink)] disabled:opacity-50"
                >
                  {lesson.status === "published" ? "إلغاء النشر" : "نشر"}
                </button>
                <Link
                  to="/rita-live"
                  search={{ lesson: lesson.id, preview: true }}
                  className="flex items-center gap-1 rounded-lg border border-[var(--pp-line)] px-3 py-1.5"
                >
                  <Eye size={13} /> معاينة كطالب
                </Link>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run(
                      `image:${lesson.id}`,
                      () => imageFn({ data: { lessonId: lesson.id } }),
                      "تم إنشاء الصورة",
                    )
                  }
                  className="flex items-center gap-1 rounded-lg border border-[var(--pp-line)] px-3 py-1.5 disabled:opacity-50"
                >
                  {busy === `image:${lesson.id}` ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ImagePlus size={13} />
                  )}
                  {lesson.image_url ? "صورة جديدة" : "إنشاء صورة"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      id: lesson.id,
                      draft: lessonToDraft(lesson),
                    })
                  }
                  className="rounded-lg border border-[var(--pp-line)] px-3 py-1.5"
                >
                  تعديل
                </button>
                {pathIndex >= 0 && (
                  <>
                    <button
                      type="button"
                      aria-label="تقديم في المسار"
                      disabled={Boolean(busy) || pathIndex === 0}
                      onClick={() =>
                        void run(`move:${lesson.id}`, () =>
                          moveFn({ data: { lessonId: lesson.id, direction: "up" } }),
                        )
                      }
                      className="rounded-lg border border-[var(--pp-line)] px-2 py-1.5 disabled:opacity-40"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="تأخير في المسار"
                      disabled={Boolean(busy) || pathIndex === published.length - 1}
                      onClick={() =>
                        void run(`move:${lesson.id}`, () =>
                          moveFn({ data: { lessonId: lesson.id, direction: "down" } }),
                        )
                      }
                      className="rounded-lg border border-[var(--pp-line)] px-2 py-1.5 disabled:opacity-40"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    if (window.confirm("أرشفة هذا الدرس؟")) {
                      void run(
                        `status:${lesson.id}`,
                        () => statusFn({ data: { lessonId: lesson.id, status: "archived" } }),
                        "تمت الأرشفة",
                      );
                    }
                  }}
                  className="rounded-lg px-3 py-1.5 text-[var(--pp-muted)]"
                >
                  أرشفة
                </button>
              </div>
              {editing?.id === lesson.id && (
                <LessonForm
                  initial={editing.draft}
                  busy={Boolean(busy)}
                  onCancel={() => setEditing(null)}
                  onSave={(draft) => {
                    setEditing({ id: lesson.id, draft });
                    void run(
                      `edit:${lesson.id}`,
                      async () => {
                        await updateFn({ data: { lessonId: lesson.id, lesson: draft } });
                        setEditing(null);
                      },
                      "تم حفظ التعديل",
                    );
                  }}
                  onRegenerateObjective={async (objective) => {
                    try {
                      const result = await regenerateFn({
                        data: { lessonId: lesson.id, objective },
                      });
                      return result.objective as Objective;
                    } catch (error) {
                      toast.error(errorText(error));
                      return null;
                    }
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {publishAsk && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          onClick={() => setPublishAsk(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-bold">نشر «{publishAsk.title_ar || publishAsk.title}»</p>
            <p className="mt-2 text-sm font-semibold text-[var(--pp-muted)]">
              هذا الدرس لن يظهر للطلاب إلا إذا كان الكتاب منشورًا أيضًا — والكتاب حاليًا مسودة. شو
              تحب نسوي؟
            </p>
            <div className="mt-4 flex flex-col gap-2 text-sm font-bold">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  const lesson = publishAsk;
                  setPublishAsk(null);
                  void run(
                    "status",
                    async () => {
                      await curriculumStatusFn({
                        data: { curriculumId: book.id, status: "published" },
                      });
                      await statusFn({
                        data: { lessonId: lesson.id, status: "published" },
                      });
                    },
                    "نُشر الدرس والكتاب — ظهر للطلاب",
                  );
                }}
                className="rounded-lg bg-[#2F8F55] px-4 py-2.5 text-white disabled:opacity-50"
              >
                انشر الدرس والكتاب معًا (يظهر للطلاب)
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  const lesson = publishAsk;
                  setPublishAsk(null);
                  void run(
                    `status:${lesson.id}`,
                    () =>
                      statusFn({
                        data: { lessonId: lesson.id, status: "published" },
                      }),
                    "نُشر الدرس — وسيبقى مخفيًا للطلاب حتى ينشر الكتاب",
                  );
                }}
                className="rounded-lg border-2 border-[var(--pp-ink)] bg-[var(--pp-pink)] px-4 py-2.5 text-[var(--pp-ink)] disabled:opacity-50"
              >
                انشر الدرس فقط (يبقى مخفيًا حتى نشر الكتاب)
              </button>
              <button
                type="button"
                onClick={() => setPublishAsk(null)}
                className="rounded-lg px-4 py-2 text-[var(--pp-muted)]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
