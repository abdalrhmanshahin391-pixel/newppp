import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useLanguageRegistry } from "@/hooks/useLearningLanguage";
import { adminCreateCurriculum, adminSaveCurriculumPages } from "@/lib/rita-curriculum.functions";
import { BUCKET, errorText } from "./book-utils";

const field =
  "w-full rounded-lg border border-[var(--pp-line)] bg-white px-3 py-2.5 text-[16px] text-[var(--pp-ink)]";

/**
 * A new book in one small window: its name, language, kind and PDF. The text of every page is
 * taken from the PDF here in the browser and saved; scanned pages are read in the book's first
 * step.
 */
export function NewBookDialog({
  open,
  onOpenChange,
  pdfCache,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfCache: Map<string, File>;
  onCreated: (id: string) => Promise<void>;
}) {
  const createFn = useServerFn(adminCreateCurriculum);
  const savePagesFn = useServerFn(adminSaveCurriculumPages);
  const registry = useLanguageRegistry();
  const [kind, setKind] = useState<"grammar" | "vocabulary">("grammar");
  const [language, setLanguage] = useState("en");
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const busy = Boolean(progress);

  async function submit() {
    setError("");
    if (!file || !title.trim()) {
      setError("اختار ملف PDF واكتب اسم الكتاب.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      const proceed = window.confirm(
        `الملف كبير (${Math.round(file.size / 1024 / 1024)} ميغابايت)، واستخراج النص ممكن ياخد وقت. نكمل؟`,
      );
      if (!proceed) return;
    }
    try {
      setProgress("قراءة الملف…");
      const { loadPdfForText, getPageText } = await import("@/lib/pdf-page-render");
      const doc = await loadPdfForText(file);
      const pageCount = Number(doc.numPages || 0);
      if (!pageCount) throw new Error("الملف ما فيه صفحات.");
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
          target_language: language,
          page_count: pageCount,
          pdf_path: path,
        },
      });
      pdfCache.set(book.id, file);
      let batch: { page_no: number; text: string; has_text_layer: boolean }[] = [];
      for (let page = 1; page <= pageCount; page += 1) {
        setProgress(`أخذ النص من الصفحات: ${page} من ${pageCount}`);
        const text = (await getPageText(doc, page)).slice(0, 20_000);
        batch.push({ page_no: page, text, has_text_layer: text.trim().length >= 20 });
        if (batch.length === 20 || page === pageCount) {
          await savePagesFn({ data: { curriculumId: book.id, pages: batch } });
          batch = [];
        }
      }
      toast.success("انضاف الكتاب");
      setTitle("");
      setTitleAr("");
      setFile(null);
      onOpenChange(false);
      await onCreated(book.id);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setProgress("");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="rita-ex-overlay edith-premium" />
        <Dialog.Content
          className="rita-ex-window edith-premium"
          dir="rtl"
          aria-describedby={undefined}
        >
          <header className="rita-ex-header flex items-center justify-between gap-3">
            <Dialog.Title className="text-[20px] font-bold">كتاب جديد</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rita-btn rita-btn-quiet rita-btn-sm"
                disabled={busy}
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </header>
          <div className="rita-ex-body space-y-4">
            <div>
              <p className="mb-2 text-[15px] font-semibold">نوع الكتاب</p>
              <div role="radiogroup" aria-label="نوع الكتاب" className="rita-choice">
                {(["grammar", "vocabulary"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={kind === value}
                    onClick={() => setKind(value)}
                  >
                    {value === "grammar" ? "قواعد" : "كلمات"}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-[15px] font-semibold">
              لغة الكتاب
              <span className="block text-[13px] font-normal text-[var(--pp-muted)]">
                الدروس بتظهر لمتعلّمي هاللغة بس
              </span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rita-select mt-1"
              >
                {registry.all.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name_ar} · {item.name_native}
                    {item.enabled ? "" : " (معطّلة)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[15px] font-semibold">
              اسم الكتاب بالإنجليزي
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                dir="ltr"
                className={`${field} mt-1`}
              />
            </label>
            <label className="block text-[15px] font-semibold">
              اسم الكتاب بالعربي{" "}
              <span className="font-normal text-[var(--pp-muted)]">(اختياري)</span>
              <input
                value={titleAr}
                onChange={(event) => setTitleAr(event.target.value)}
                className={`${field} mt-1`}
              />
            </label>
            <label className="flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--pp-line)] px-3 text-[15px] font-semibold text-[var(--pp-accent-text)]">
              <Upload size={17} aria-hidden="true" />
              <span className="truncate">{file ? file.name : "اختار ملف PDF"}</span>
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[#fbe9ed] p-3 text-[15px] font-semibold text-[#8c1a31]"
              >
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="rita-btn rita-btn-primary w-full gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {progress || "أضف الكتاب"}
            </button>
            {busy && (
              <p role="status" className="text-center text-[14px] text-[var(--pp-muted)]">
                خلّي الصفحة مفتوحة لحد ما يخلص.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
