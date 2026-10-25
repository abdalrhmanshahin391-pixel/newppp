import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  adminConfirmBlankPage,
  adminSaveCurriculumPages,
  type CurriculumRow,
} from "@/lib/rita-curriculum.functions";
import { errorText } from "./book-utils";
import type { PageProblem, useBookReader } from "./useBookReader";

/**
 * Pages the AI would not read. They are never skipped quietly: each one stays here, with the reason,
 * a picture of the page, and three ways out: try again, mark it blank, or type its text.
 */
export function UnreadablePages({
  book,
  problems,
  reader,
  onChanged,
}: {
  book: CurriculumRow;
  problems: PageProblem[];
  reader: ReturnType<typeof useBookReader>;
  onChanged: () => Promise<void>;
}) {
  const blankFn = useServerFn(adminConfirmBlankPage);
  const saveFn = useServerFn(adminSaveCurriculumPages);
  const [preview, setPreview] = useState<Record<number, string>>({});
  const [writing, setWriting] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  async function act(page: number, task: () => Promise<void>, done: string) {
    setBusy(page);
    try {
      await task();
      reader.resolvePage(page);
      toast.success(done);
      await onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function show(page: number) {
    if (preview[page]) {
      setPreview((current) => {
        const next = { ...current };
        delete next[page];
        return next;
      });
      return;
    }
    try {
      const url = await reader.previewPage(page);
      setPreview((current) => ({ ...current, [page]: url }));
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  if (!problems.length) return null;
  return (
    <div className="space-y-3 rounded-xl border border-[#e0a2a2] bg-[#fbeeee] p-4">
      <div>
        <p className="text-[16px] font-semibold text-[#7a1f1f]">
          {problems.length} صفحة لسا ما انقرأت
        </p>
        <p className="mt-1 text-[14px] text-[#7a1f1f]">
          كمّلنا باقي الصفحات. الملخصات بتوقف عند الصفحات هاي لحد ما تقرر لكل وحدة شو نعمل.
        </p>
      </div>
      <ul className="space-y-3">
        {problems.map((problem) => (
          <li
            key={problem.page_no}
            className="space-y-2 rounded-lg border border-[#ecc6c6] bg-white p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[16px] font-semibold">ص{problem.page_no}</p>
              <p className="text-[14px] text-[var(--pp-muted)]">
                {problem.kind === "refused"
                  ? "الذكاء الاصطناعي رفض يقراها"
                  : "فشلت القراءة بعد محاولتين"}
              </p>
            </div>
            <p className="break-words text-[12.5px] text-[var(--pp-muted)]" dir="ltr">
              {problem.reason}
            </p>
            {preview[problem.page_no] && (
              <img
                src={preview[problem.page_no]}
                alt={`صفحة ${problem.page_no}`}
                className="max-h-72 rounded-md border border-[var(--pp-line)]"
              />
            )}
            {writing === problem.page_no ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  dir="ltr"
                  rows={6}
                  aria-label={`نص صفحة ${problem.page_no}`}
                  className="w-full rounded-md border border-[var(--pp-ink)] p-2 text-[15px]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === problem.page_no}
                    onClick={() => {
                      if (draft.trim().length < 20) {
                        toast.error("النص قصير كثير. إذا ما في كلام بالصفحة اضغط «فاضية».");
                        return;
                      }
                      void act(
                        problem.page_no,
                        async () => {
                          await saveFn({
                            data: {
                              curriculumId: book.id,
                              pages: [
                                {
                                  page_no: problem.page_no,
                                  text: draft.trim(),
                                  has_text_layer: false,
                                },
                              ],
                            },
                          });
                          setWriting(null);
                          setDraft("");
                        },
                        `انحفظ نص ص${problem.page_no}`,
                      );
                    }}
                    className="rita-btn rita-btn-primary rita-btn-sm"
                  >
                    احفظ النص
                  </button>
                  <button
                    type="button"
                    onClick={() => setWriting(null)}
                    className="rita-btn rita-btn-quiet rita-btn-sm"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reader.running || busy === problem.page_no}
                  onClick={() => void reader.retryPage(problem.page_no)}
                  className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
                >
                  {reader.running ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <RotateCcw size={14} aria-hidden="true" />
                  )}
                  أعد المحاولة
                </button>
                <button
                  type="button"
                  onClick={() => void show(problem.page_no)}
                  className="rita-btn rita-btn-quiet rita-btn-sm gap-1.5"
                >
                  <Eye size={14} aria-hidden="true" />
                  {preview[problem.page_no] ? "خبّي الصفحة" : "شوف الصفحة"}
                </button>
                <button
                  type="button"
                  disabled={busy === problem.page_no}
                  onClick={() =>
                    void act(
                      problem.page_no,
                      async () => {
                        await blankFn({ data: { curriculumId: book.id, pageNo: problem.page_no } });
                      },
                      `ص${problem.page_no} انعلّمت فارغة`,
                    )
                  }
                  className="rita-btn rita-btn-quiet rita-btn-sm"
                >
                  فاضية
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWriting(problem.page_no);
                    setDraft("");
                  }}
                  className="rita-btn rita-btn-quiet rita-btn-sm"
                >
                  اكتب النص
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
