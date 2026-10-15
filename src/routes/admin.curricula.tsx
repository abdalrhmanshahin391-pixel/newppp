import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  FileUp,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
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
} from "@/lib/rita-curriculum";
import {
  adminCreateCurriculum,
  adminCurriculumOverview,
  adminGenerateLesson,
  adminGenerateLessonImage,
  adminImportCurriculumWindow,
  adminImportLesson,
  adminMoveLesson,
  adminReadCurriculumWindow,
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

export const Route = createFileRoute("/admin/curricula")({
  head: () => ({
    meta: [{ title: "Rita curriculum — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminCurricula,
});

type Overview = Awaited<ReturnType<typeof adminCurriculumOverview>>;

const BUCKET = "rita-curricula";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "حدث خطأ";
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
  const [selectedId, setSelectedId] = useState("");
  const [pdfCache] = useState(() => new Map<string, File>());

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const refresh = useCallback(async () => {
    try {
      const next = await overviewFn();
      setOverview(next);
      setSelectedId((current) => current || next.curricula[0]?.id || "");
    } catch (error) {
      toast.error(errorText(error));
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
    <main dir="rtl" className="min-h-screen bg-[#FBFAFF] pb-24 text-[#1E2A4A]">
      <header className="border-b border-[#EEE8FB] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-extrabold text-[#9B5CF6]">لوحة الإدارة</p>
            <h1 className="text-2xl font-black">مناهج دروس ريتا</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/rita-lessons"
              className="rounded-full bg-[#F4EFFE] px-4 py-2 text-sm font-bold text-[#6D35D8]"
            >
              مسار الطالب
            </Link>
            <Link
              to="/admin"
              className="flex items-center gap-1 rounded-full border border-[#E6E1F5] px-4 py-2 text-sm font-bold"
            >
              الإدارة <ArrowLeft size={15} />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 pt-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <AddBookCard
            pdfCache={pdfCache}
            onCreated={async (id) => {
              await refresh();
              setSelectedId(id);
            }}
          />
          {!overview && <Loader2 className="mx-auto animate-spin text-[#9B5CF6]" />}
          {overview?.curricula.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => setSelectedId(book.id)}
              className={`w-full rounded-3xl border-2 bg-white p-4 text-right transition ${
                book.id === selectedId ? "border-[#9B5CF6]" : "border-[#EEE8FB]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-black">{book.title_ar || book.title}</span>
                <KindBadge kind={book.kind} />
              </div>
              <CursorBars book={book} />
              <p className="mt-2 text-xs font-bold text-[#6B6F86]">{cursorLabelAr(book)}</p>
              <p className="mt-1 text-[11px] font-bold text-[#A3A7BA]">
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
              pdfCache={pdfCache}
              onChanged={refresh}
            />
          ) : (
            overview && (
              <p className="rounded-3xl border-2 border-dashed border-[#E6E1F5] p-10 text-center font-bold text-[#8A8FA3]">
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
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-black text-white ${
        kind === "vocabulary" ? "bg-[#3BA7FF]" : "bg-[#FF6FA8]"
      }`}
    >
      {kind === "vocabulary" ? "كلمات" : "قواعد"}
    </span>
  );
}

function CursorBars({ book }: { book: CurriculumRow }) {
  return (
    <div className="mt-3 space-y-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-[#EEE8FB]">
        <div
          className="h-full rounded-full bg-[#C9A7FF]"
          style={{ width: `${percentOf(book.read_cursor, book.page_count)}%` }}
        />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#EEE8FB]">
        <div
          className="h-full rounded-full bg-[#7B3FE4]"
          style={{ width: `${percentOf(book.taught_cursor, book.page_count)}%` }}
        />
      </div>
      <p className="flex justify-between text-[10px] font-bold text-[#A3A7BA]">
        <span>فاتح: مقروء</span>
        <span>غامق: مُدرَّس</span>
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
    <div className="rounded-3xl border-2 border-[#EEE8FB] bg-white p-4">
      <h2 className="flex items-center gap-2 font-black">
        <FileUp size={18} className="text-[#9B5CF6]" /> كتاب جديد
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["grammar", "vocabulary"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`rounded-xl py-2 text-sm font-black ${kind === value ? "bg-[#9B5CF6] text-white" : "bg-[#F4EFFE] text-[#6D35D8]"}`}
          >
            {value === "grammar" ? "قواعد" : "كلمات"}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Book title (English)"
        dir="ltr"
        className="mt-2 w-full rounded-xl border border-[#E6E1F5] px-3 py-2 text-sm"
      />
      <input
        value={titleAr}
        onChange={(event) => setTitleAr(event.target.value)}
        placeholder="اسم الكتاب بالعربية"
        className="mt-2 w-full rounded-xl border border-[#E6E1F5] px-3 py-2 text-sm"
      />
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D9CFF5] py-3 text-sm font-bold text-[#6D35D8]">
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
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E2A4A] py-2.5 text-sm font-black text-white disabled:opacity-60"
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
  pdfCache,
  onChanged,
}: {
  book: CurriculumRow;
  windows: WindowRow[];
  lessons: LessonRow[];
  allLessons: LessonRow[];
  missingText: number[];
  pdfCache: Map<string, File>;
  onChanged: () => Promise<void>;
}) {
  const statusFn = useServerFn(adminSetCurriculumStatus);
  const readFn = useServerFn(adminReadCurriculumWindow);
  const transcribeFn = useServerFn(adminTranscribeCurriculumPages);
  const importWindowFn = useServerFn(adminImportCurriculumWindow);
  const [busy, setBusy] = useState("");
  const [openWindow, setOpenWindow] = useState<string | null>(
    windows[windows.length - 1]?.id ?? null,
  );
  const [importOpen, setImportOpen] = useState(false);
  const next = nextWindow(book);
  const [range, setRange] = useState({ from: next?.from ?? 1, to: next?.to ?? 1 });
  const [summaryJson, setSummaryJson] = useState("");

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

  async function readNext() {
    if (!next) return;
    await run(
      "read",
      async () => {
        // Scanned pages first: render them here and let the AI transcribe them.
        const scanned = missingText.filter((page) => page >= next.from && page <= next.to);
        if (scanned.length) {
          const { loadPdfForRender, renderPageToJpegBase64 } =
            await import("@/lib/pdf-page-render");
          const doc = await loadPdfForRender(await pdfFileFor(book, pdfCache));
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
            await transcribeFn({ data: { curriculumId: book.id, pages } });
          }
        }
        setBusy("read");
        await readFn({ data: { curriculumId: book.id, from: next.from, to: next.to } });
      },
      `تمت قراءة الصفحات ${next.from}–${next.to}`,
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border-2 border-[#EEE8FB] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{book.title_ar || book.title}</h2>
              <KindBadge kind={book.kind} />
            </div>
            <p className="text-sm font-semibold text-[#6B6F86]" dir="ltr">
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
              className={`rounded-full px-4 py-2 text-sm font-black ${
                book.status === "published"
                  ? "bg-[#EAF8EF] text-[#2F8F55]"
                  : "bg-[#9B5CF6] text-white"
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
              className="rounded-full border border-[#E6E1F5] px-4 py-2 text-sm font-bold text-[#8A8FA3]"
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
        <PageStrip book={book} missingText={missingText} />
        {missingText.length > 0 && (
          <p className="mt-2 text-xs font-bold text-[#E8A400]">
            {missingText.length} صفحة بلا نص (ممسوحة ضوئياً) — ستقرؤها الصور تلقائياً عند الوصول
            إليها.
          </p>
        )}
      </div>

      <div className="rounded-3xl border-2 border-[#EEE8FB] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black">
            ملخصات القراءة ({CURRICULUM_WINDOW_PAGES} صفحات في كل مرة)
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImportOpen((value) => !value)}
              className="rounded-full border border-[#E6E1F5] px-4 py-2 text-sm font-bold"
            >
              استيراد ملخص JSON
            </button>
            <button
              type="button"
              disabled={!next || Boolean(busy)}
              onClick={() => void readNext()}
              className="flex items-center gap-2 rounded-full bg-[#9B5CF6] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              {busy.startsWith("read") ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              {next ? `اقرأ الصفحات ${next.from}–${next.to}` : "قُرئ الكتاب كاملاً"}
            </button>
          </div>
        </div>
        {busy.startsWith("read:") && (
          <p className="mt-2 text-xs font-bold text-[#9B5CF6]">
            قراءة الصفحات الممسوحة {busy.slice(5)}…
          </p>
        )}
        {importOpen && (
          <div className="mt-4 space-y-2 rounded-2xl bg-[#FBFAFF] p-4">
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
              className="w-full rounded-xl border border-[#E6E1F5] p-3 font-mono text-xs"
            />
            <button
              type="button"
              disabled={!summaryJson.trim() || Boolean(busy)}
              onClick={() => void importSummary()}
              className="rounded-full bg-[#1E2A4A] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              حفظ الملخص
            </button>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {windows.length === 0 && (
            <p className="text-sm font-bold text-[#A3A7BA]">لم تُقرأ أي صفحات بعد.</p>
          )}
          {windows.map((window) => (
            <div key={window.id} className="rounded-2xl border border-[#EEE8FB]">
              <button
                type="button"
                onClick={() =>
                  setOpenWindow((current) => (current === window.id ? null : window.id))
                }
                className="flex w-full items-center justify-between px-4 py-3 text-right"
              >
                <span className="font-black">
                  الصفحات {window.from_page}–{window.to_page}
                </span>
                <span className="text-xs font-bold text-[#8A8FA3]">
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#FBFAFF] px-4 py-3">
      <p className="text-xs font-bold text-[#8A8FA3]">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

/** One square per page: grey unread, light read, dark taught, amber scanned. */
function PageStrip({ book, missingText }: { book: CurriculumRow; missingText: number[] }) {
  const missing = new Set(missingText);
  const pages = Array.from({ length: Math.min(book.page_count, 400) }, (_, index) => index + 1);
  return (
    <div className="mt-4 flex flex-wrap gap-1" dir="ltr">
      {pages.map((page) => {
        const colour =
          page <= book.taught_cursor
            ? "bg-[#7B3FE4]"
            : page <= book.read_cursor
              ? "bg-[#C9A7FF]"
              : missing.has(page)
                ? "bg-[#FFD98A]"
                : "bg-[#E6E1F5]";
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
      className="w-20 rounded-lg border border-[#E6E1F5] px-2 py-1 text-center"
    />
  );
}

function WindowSummaryView({ window }: { window: WindowRow }) {
  const { summary } = window;
  return (
    <div className="space-y-3 border-t border-[#EEE8FB] px-4 py-3 text-sm">
      <p className="font-semibold">{summary.overview_ar || summary.overview}</p>
      {summary.topics.map((topic, index) => (
        <div key={index} className="rounded-xl bg-[#FBFAFF] p-3">
          <p className="font-black">
            {topic.title_ar || topic.title}{" "}
            <span className="text-xs font-bold text-[#8A8FA3]">
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
            <p className="mt-1 text-xs text-[#6B6F86]">
              {topic.vocabulary.map((item) => `${item.word} = ${item.meaning_ar}`).join(" · ")}
            </p>
          )}
        </div>
      ))}
      {summary.suggested_lessons.length > 0 && (
        <p className="text-xs font-bold text-[#9B5CF6]">
          دروس مقترحة:{" "}
          {summary.suggested_lessons.map((item) => item.title_ar || item.topic).join(" · ")}
        </p>
      )}
      {summary.continues_next_window && (
        <p className="text-xs font-bold text-[#E8A400]">الموضوع الأخير يكمل في الصفحات التالية.</p>
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
  const imageFn = useServerFn(adminGenerateLessonImage);
  const moveFn = useServerFn(adminMoveLesson);
  const [busy, setBusy] = useState("");
  const firstUntaught = Math.min(book.taught_cursor + 1, Math.max(1, book.read_cursor));
  const [form, setForm] = useState({ topic: "", from: firstUntaught, to: firstUntaught });
  const [mode, setMode] = useState<"ai" | "json">("ai");
  const [lessonJson, setLessonJson] = useState("");
  const [editing, setEditing] = useState<{ id: string; json: string } | null>(null);

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
    <div className="rounded-3xl border-2 border-[#EEE8FB] bg-white p-5">
      <h3 className="text-lg font-black">الدروس</h3>
      {book.read_cursor === 0 ? (
        <p className="mt-2 text-sm font-bold text-[#A3A7BA]">
          اقرأ أول {CURRICULUM_WINDOW_PAGES} صفحات قبل إنشاء الدروس.
        </p>
      ) : (
        <div className="mt-3 rounded-2xl bg-[#FBFAFF] p-4">
          <div className="flex gap-2">
            {(["ai", "json"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-black ${mode === value ? "bg-[#1E2A4A] text-white" : "bg-white"}`}
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
                className="w-full rounded-xl border border-[#E6E1F5] px-3 py-2 text-sm"
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
                      className="rounded-full bg-[#F4EFFE] px-3 py-1 text-xs font-bold text-[#6D35D8]"
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
                <span className="text-xs text-[#8A8FA3]">(حتى ص{book.read_cursor} مقروءة)</span>
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
                className="flex items-center gap-2 rounded-full bg-[#9B5CF6] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
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
                className="w-full rounded-xl border border-[#E6E1F5] p-3 font-mono text-xs"
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
                className="rounded-full bg-[#1E2A4A] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
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
            <div key={lesson.id} className="rounded-2xl border border-[#EEE8FB] p-4">
              <div className="flex items-start gap-3">
                <LessonImage src={lesson.image_url} alt="" className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#8A8FA3]">
                    درس {lesson.lesson_no} · ص{lesson.source_from_page}
                    {lesson.source_to_page !== lesson.source_from_page
                      ? `–${lesson.source_to_page}`
                      : ""}{" "}
                    · {lesson.objectives.length} أهداف · v{lesson.version}
                    {pathIndex >= 0 ? ` · الترتيب في المسار ${pathIndex + 1}` : ""}
                  </p>
                  <p className="font-black">{lesson.title_ar || lesson.title}</p>
                  <p className="text-sm text-[#6B6F86]" dir="ltr">
                    {lesson.title}
                  </p>
                  <ul className="mt-1 list-disc pr-5 text-xs text-[#6B6F86]">
                    {lesson.objectives.map((objective) => (
                      <li key={objective.id}>{objective.text_ar || objective.text}</li>
                    ))}
                  </ul>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                    lesson.status === "published"
                      ? "bg-[#EAF8EF] text-[#2F8F55]"
                      : "bg-[#FFF6D6] text-[#B07A00]"
                  }`}
                >
                  {lesson.status === "published" ? "منشور" : "مسودة"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run(
                      `status:${lesson.id}`,
                      () =>
                        statusFn({
                          data: {
                            lessonId: lesson.id,
                            status: lesson.status === "published" ? "draft" : "published",
                          },
                        }),
                      lesson.status === "published" ? "أُعيد الدرس إلى المسودة" : "نُشر الدرس",
                    )
                  }
                  className="rounded-full bg-[#9B5CF6] px-3 py-1.5 text-white disabled:opacity-50"
                >
                  {lesson.status === "published" ? "إلغاء النشر" : "نشر"}
                </button>
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
                  className="flex items-center gap-1 rounded-full border border-[#E6E1F5] px-3 py-1.5 disabled:opacity-50"
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
                      json: JSON.stringify(lessonToDraft(lesson), null, 2),
                    })
                  }
                  className="rounded-full border border-[#E6E1F5] px-3 py-1.5"
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
                      className="rounded-full border border-[#E6E1F5] px-2 py-1.5 disabled:opacity-40"
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
                      className="rounded-full border border-[#E6E1F5] px-2 py-1.5 disabled:opacity-40"
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
                  className="rounded-full px-3 py-1.5 text-[#8A8FA3]"
                >
                  أرشفة
                </button>
              </div>
              {editing?.id === lesson.id && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={editing.json}
                    onChange={(event) => setEditing({ id: lesson.id, json: event.target.value })}
                    dir="ltr"
                    rows={14}
                    className="w-full rounded-xl border border-[#E6E1F5] p-3 font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run(
                          `edit:${lesson.id}`,
                          async () => {
                            await updateFn({
                              data: { lessonId: lesson.id, lesson: JSON.parse(editing.json) },
                            });
                            setEditing(null);
                          },
                          "تم حفظ التعديل",
                        )
                      }
                      className="rounded-full bg-[#1E2A4A] px-4 py-1.5 text-xs font-black text-white"
                    >
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-full px-4 py-1.5 text-xs font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
