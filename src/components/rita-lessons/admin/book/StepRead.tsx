import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookOpen, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { adminConfirmBlankPage, type CurriculumRow } from "@/lib/rita-curriculum.functions";
import { errorText } from "./book-utils";
import { ErrorBox, ProgressBar } from "./BookBits";
import { UnreadablePages } from "./UnreadablePages";
import type { useBookReader } from "./useBookReader";

/**
 * Step 1: read the book. One button reads every page (scanned ones too) and writes the summaries
 * the lessons are made from. The page-by-page detail is folded away; problems appear only when
 * there are some, each with what to do about it.
 */
export function StepRead({
  book,
  missingText,
  reader,
  onNext,
  onChanged,
}: {
  book: CurriculumRow;
  missingText: number[];
  reader: ReturnType<typeof useBookReader>;
  onNext: () => void;
  onChanged: () => Promise<void>;
}) {
  const blankFn = useServerFn(adminConfirmBlankPage);
  const done = book.read_cursor >= book.page_count;
  const started = book.read_cursor > 0;
  const textReady = Math.max(0, book.page_count - missingText.length);
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
    <section className="space-y-5" aria-labelledby="step-read-title">
      <div>
        <h2 id="step-read-title" className="text-[22px] font-bold">
          قراءة الكتاب
        </h2>
        <p className="mt-1 text-[15px] text-[var(--pp-muted)]">
          بنقرأ كل صفحة (حتى الممسوحة) وبنكتب ملخص، ومنه بتنصنع الدروس.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[17px] font-semibold">
            {done ? "انقرأ الكتاب كامل" : `انقرأ ${book.read_cursor} من ${book.page_count} صفحة`}
          </p>
          <p className="text-[14px] tabular-nums text-[var(--pp-muted)]">
            {book.page_count ? Math.round((book.read_cursor / book.page_count) * 100) : 0}%
          </p>
        </div>
        <p className="text-[14px] text-[var(--pp-muted)]">
          نص جاهز لـ {textReady} من {book.page_count} صفحة
          {missingText.length > 0 ? ` · ${missingText.length} لسا بلا نص` : ""}
        </p>
        <ProgressBar value={book.read_cursor} max={book.page_count} label="الصفحات المقروءة" />
      </div>

      {reader.running ? (
        <div className="space-y-3">
          <p
            role="status"
            className="flex items-center gap-2 text-[16px] font-semibold text-[var(--pp-accent-text)]"
          >
            <Loader2 size={17} className="animate-spin" aria-hidden="true" />
            {reader.status || "بنقرأ…"}
          </p>
          <p className="text-[14px] text-[var(--pp-muted)]">
            خلّي هالصفحة مفتوحة والشاشة شغالة لحد ما يخلص. بتقدر توقف وتكمل بعدين من نفس المكان.
          </p>
          <button type="button" onClick={reader.stop} className="rita-btn rita-btn-soft gap-2">
            <Square size={14} fill="currentColor" aria-hidden="true" />
            إيقاف
          </button>
        </div>
      ) : done ? (
        <button type="button" onClick={onNext} className="rita-btn rita-btn-primary gap-2">
          الخطوة الجاية: الدروس
          <ArrowLeft size={17} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void reader.readWholeBook()}
          className="rita-btn rita-btn-primary gap-2"
        >
          <BookOpen size={17} aria-hidden="true" />
          {started ? "كمّل القراءة" : "اقرأ الكتاب كامل"}
        </button>
      )}

      {reader.error && (
        <ErrorBox hint={reader.error.hint} raw={reader.error.raw} onClose={reader.clearError} />
      )}

      <UnreadablePages
        book={book}
        problems={reader.problems}
        reader={reader}
        onChanged={onChanged}
      />

      {reader.textNote && !reader.running && (
        <p className="rounded-xl bg-[var(--pp-grey)] p-3 text-[14px]">
          ما قدرنا ناخد النص من {reader.textNote.count} صفحة داخل الملف على هالجهاز (
          <bdi dir="ltr">{reader.textNote.cause}</bdi>). بنقراها بالذكاء الاصطناعي بدالها.
        </p>
      )}

      {!reader.running && (blankPages.length > 0 || cutPages.length > 0) && (
        <div className="rounded-xl bg-[var(--pp-grey)] p-3 text-[15px]">
          <p className="font-semibold">صفحات انقرأت بملاحظة:</p>
          <ul className="mt-1 list-disc space-y-1 ps-5">
            {blankPages.length > 0 && (
              <li>
                {blankPages.map((item) => `ص${item.page_no}`).join("، ")}: الذكاء الاصطناعي قال ما
                فيها نص (غلاف أو صفحة فاضية)، فانعلّمت فارغة.
              </li>
            )}
            {cutPages.length > 0 && (
              <li>
                {cutPages.map((item) => `ص${item.page_no}`).join("، ")}: صفحة طويلة كثير وانقطع نصها
                بالآخر.
              </li>
            )}
          </ul>
        </div>
      )}

      {stuck.length > 0 && !reader.running && reader.problems.length === 0 && (
        <div className="rounded-xl bg-[#fff6e5] p-3 text-[15px] text-[#6b4100]">
          <p className="font-semibold">
            {stuck.length} صفحة لسا بلا نص. «كمّل القراءة» بيجرّبها مرة ثانية، وإذا كانت غلاف أو
            صفحة فاضية علّمها فارغة.
          </p>
        </div>
      )}

      <details className="rounded-xl border border-[var(--pp-line)] p-3">
        <summary className="cursor-pointer text-[15px] font-semibold">
          تفاصيل الصفحات
          {missingText.length > 0 && (
            <span className="text-[var(--pp-muted)]"> · {missingText.length} بلا نص</span>
          )}
        </summary>
        <div className="mt-3 flex flex-wrap gap-1" dir="ltr" aria-hidden="true">
          {Array.from({ length: Math.min(book.page_count, 400) }, (_, index) => index + 1).map(
            (page) => (
              <span
                key={page}
                title={`ص${page}`}
                className={`h-3 w-3 rounded-[3px] ${
                  missingText.includes(page)
                    ? "bg-[#f5b942]"
                    : page <= book.read_cursor
                      ? "bg-[var(--pp-accent)]"
                      : "bg-[var(--pp-line)]"
                }`}
              />
            ),
          )}
        </div>
        <p className="mt-2 text-[13px] text-[var(--pp-muted)]">
          أزرق: مقروءة · أصفر: بلا نص · رمادي: لسا
        </p>
        {missingText.length > 0 && (
          <div className="mt-3">
            <p className="text-[14px] font-semibold">غلاف أو صفحة فاضية؟ علّمها:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {missingText.slice(0, 60).map((page) => (
                <button
                  key={page}
                  type="button"
                  disabled={reader.running}
                  onClick={() => void markBlank(page)}
                  className="rounded-lg border border-[var(--pp-line)] px-2.5 py-1 text-[13px] font-semibold disabled:opacity-50"
                >
                  ص{page} فارغة
                </button>
              ))}
            </div>
          </div>
        )}
      </details>
    </section>
  );
}
