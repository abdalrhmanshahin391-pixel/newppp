import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useLanguageRegistry } from "@/hooks/useLearningLanguage";
import { CURRICULUM_WINDOW_PAGES, nextWindow, type LessonDraft } from "@/lib/rita-curriculum";
import {
  adminImportCurriculumWindow,
  adminImportLesson,
  adminSetCurriculumLanguage,
  type CurriculumRow,
  type WindowRow,
} from "@/lib/rita-curriculum.functions";
import { errorText } from "./book-utils";
import type { useBookReader } from "./useBookReader";

const field = "w-full rounded-lg border border-[var(--pp-line)] p-3 font-mono text-[13px]";

/**
 * Everything the four steps do not need day to day: the book's language, the reading summaries,
 * reading one chosen range, and importing a summary or lessons as JSON. Folded away by default.
 */
export function AdvancedTools({
  book,
  windows,
  reader,
  onChanged,
}: {
  book: CurriculumRow;
  windows: WindowRow[];
  reader: ReturnType<typeof useBookReader>;
  onChanged: () => Promise<void>;
}) {
  const languages = useLanguageRegistry();
  const languageFn = useServerFn(adminSetCurriculumLanguage);
  const importWindowFn = useServerFn(adminImportCurriculumWindow);
  const importLessonFn = useServerFn(adminImportLesson);
  const next = nextWindow(book);
  const [range, setRange] = useState({ from: next?.from ?? 1, to: next?.to ?? 1 });
  const [summaryJson, setSummaryJson] = useState("");
  const [lessonJson, setLessonJson] = useState("");
  const [busy, setBusy] = useState("");

  async function run(label: string, task: () => Promise<unknown>, done: string) {
    setBusy(label);
    try {
      await task();
      toast.success(done);
      await onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy("");
    }
  }

  return (
    <details className="rounded-xl border border-dashed border-[var(--pp-line)] p-3">
      <summary className="cursor-pointer text-[15px] font-semibold text-[var(--pp-muted)]">
        أدوات متقدمة
      </summary>
      <div className="mt-4 space-y-6 text-[15px]">
        <label className="flex flex-wrap items-center gap-2 font-semibold">
          لغة الكتاب
          <select
            value={book.target_language}
            disabled={Boolean(busy)}
            onChange={(event) =>
              void run(
                "language",
                () => languageFn({ data: { curriculumId: book.id, language: event.target.value } }),
                "تغيّرت لغة الكتاب",
              )
            }
            className="rita-select !w-auto"
          >
            {languages.all.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name_ar} · {item.name_native}
                {item.enabled ? "" : " (معطّلة)"}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <p className="font-semibold">قراءة نطاق صفحات معيّن</p>
          <div className="flex flex-wrap items-center gap-2">
            من ص
            <PageBox
              value={range.from}
              onChange={(from) => setRange((current) => ({ ...current, from }))}
            />
            إلى ص
            <PageBox
              value={range.to}
              onChange={(to) => setRange((current) => ({ ...current, to }))}
            />
            <button
              type="button"
              disabled={
                reader.running ||
                range.to < range.from ||
                range.to - range.from >= CURRICULUM_WINDOW_PAGES
              }
              onClick={() => void reader.readOneWindow(range.from, range.to)}
              className="rita-btn rita-btn-soft rita-btn-sm"
            >
              اقرأ هالصفحات
            </button>
          </div>
          <p className="text-[13px] text-[var(--pp-muted)]">
            لحد {CURRICULUM_WINDOW_PAGES} صفحات بالمرة.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">ملخصات القراءة ({windows.length})</p>
          {windows.length === 0 ? (
            <p className="text-[var(--pp-muted)]">لسا ما في ملخصات.</p>
          ) : (
            <ul className="space-y-2">
              {windows.map((window) => (
                <li key={window.id}>
                  <details className="rounded-lg bg-[var(--pp-grey)] p-2.5">
                    <summary className="cursor-pointer font-semibold">
                      الصفحات {window.from_page}–{window.to_page} · {window.summary.topics.length}{" "}
                      مواضيع
                    </summary>
                    <p className="mt-2">{window.summary.overview_ar || window.summary.overview}</p>
                    <ul className="mt-2 list-disc space-y-1 ps-5">
                      {window.summary.topics.map((topic, index) => (
                        <li key={index}>
                          {topic.title_ar || topic.title} (ص{topic.from_page}
                          {topic.to_page !== topic.from_page ? `–${topic.to_page}` : ""})
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="font-semibold">استيراد ملخص JSON</p>
          <textarea
            value={summaryJson}
            onChange={(event) => setSummaryJson(event.target.value)}
            dir="ltr"
            rows={5}
            aria-label="ملخص JSON"
            placeholder='{"from_page": 1, "to_page": 10, "summary": {"overview": "...", "topics": [...]}}'
            className={field}
          />
          <button
            type="button"
            disabled={!summaryJson.trim() || Boolean(busy)}
            onClick={() =>
              void run(
                "summary",
                async () => {
                  const parsed = JSON.parse(summaryJson) as Record<string, unknown>;
                  const wrapped = parsed.summary && typeof parsed.summary === "object";
                  const from =
                    wrapped && typeof parsed.from_page === "number" ? parsed.from_page : range.from;
                  const to =
                    wrapped && typeof parsed.to_page === "number" ? parsed.to_page : range.to;
                  await importWindowFn({
                    data: {
                      curriculumId: book.id,
                      from,
                      to,
                      summary: wrapped ? parsed.summary : parsed,
                    },
                  });
                  setSummaryJson("");
                },
                "انحفظ الملخص",
              )
            }
            className="rita-btn rita-btn-soft rita-btn-sm"
          >
            حفظ الملخص
          </button>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">استيراد دروس JSON</p>
          <textarea
            value={lessonJson}
            onChange={(event) => setLessonJson(event.target.value)}
            dir="ltr"
            rows={5}
            aria-label="دروس JSON"
            placeholder='[{"title": "...", "objectives": [...], "plan": {...}}]'
            className={field}
          />
          <button
            type="button"
            disabled={!lessonJson.trim() || Boolean(busy)}
            onClick={() =>
              void run(
                "lessons",
                async () => {
                  const parsed = JSON.parse(lessonJson) as unknown;
                  const items = (Array.isArray(parsed) ? parsed : [parsed]) as Record<
                    string,
                    unknown
                  >[];
                  for (const item of items) {
                    const wrapped = item.lesson && typeof item.lesson === "object";
                    const { image_url, ...rest } = item;
                    await importLessonFn({
                      data: {
                        curriculumId: book.id,
                        lesson: (wrapped ? item.lesson : rest) as LessonDraft,
                        image_url: typeof image_url === "string" ? image_url : null,
                      },
                    });
                  }
                  setLessonJson("");
                },
                "انستوردت الدروس",
              )
            }
            className="rita-btn rita-btn-soft rita-btn-sm"
          >
            استيراد
          </button>
        </div>
      </div>
    </details>
  );
}

function PageBox({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      type="number"
      min={1}
      value={value}
      onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
      className="w-20 rounded-lg border border-[var(--pp-line)] px-2 py-1.5 text-center text-[16px]"
    />
  );
}
