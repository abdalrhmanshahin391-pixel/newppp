import { useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import type { TopicSuggestion } from "@/lib/rita-slides";

type Pick = { topic: string; from: number; to: number };

/**
 * "Lesson N+1": three topics from the pages already read, one tap to write the
 * lesson. A small form below takes a topic of the admin's own when none fits.
 */
export function NextLessonPicker({
  nextNo,
  suggestions,
  readCursor,
  defaultFrom,
  busy,
  generatingKey,
  onGenerate,
}: {
  nextNo: number;
  suggestions: TopicSuggestion[];
  readCursor: number;
  defaultFrom: number;
  busy: boolean;
  /** `${topic}:${from}` of the lesson being written right now, or "custom". */
  generatingKey: string;
  onGenerate: (pick: Pick, key: string) => void;
}) {
  const [custom, setCustom] = useState({ topic: "", from: defaultFrom, to: defaultFrom });
  const [customOpen, setCustomOpen] = useState(suggestions.length === 0);

  return (
    <section
      aria-labelledby="next-lesson-title"
      className="rounded-[20px] border-2 border-[var(--pp-ink)] bg-white p-5"
    >
      <p className="text-sm font-semibold text-[var(--pp-muted)]">الدرس التالي</p>
      <h3 id="next-lesson-title" className="mt-1 text-xl font-bold">
        الدرس {nextNo}: اختر موضوعه
      </h3>
      <p className="mt-1 text-sm text-[var(--pp-muted)]">
        مواضيع من الصفحات التي قُرئت (حتى ص{readCursor}). اختر واحدًا وسنكتب الدرس كمسودة.
      </p>

      {suggestions.length > 0 ? (
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {suggestions.map((item) => {
            const key = `${item.topic}:${item.from_page}`;
            const working = generatingKey === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onGenerate({ topic: item.topic, from: item.from_page, to: item.to_page }, key)
                  }
                  className="flex h-full w-full flex-col gap-2 rounded-2xl border-2 border-[var(--pp-ink)] bg-white p-4 text-start transition-colors hover:bg-[var(--pp-accent-soft)] disabled:opacity-60"
                >
                  <span className="text-base font-bold leading-snug">
                    {item.title_ar || item.topic}
                  </span>
                  {item.title_ar && (
                    <span className="text-sm text-[var(--pp-muted)]" dir="ltr">
                      {item.topic}
                    </span>
                  )}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm font-semibold">
                    <span className="text-[var(--pp-muted)]">
                      ص{item.from_page}
                      {item.to_page !== item.from_page ? `–${item.to_page}` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[var(--pp-accent-text)]">
                      {working ? (
                        <>
                          <Loader2 size={15} className="animate-spin" /> يكتب الدرس…
                        </>
                      ) : (
                        <>
                          اكتب هذا الدرس <ArrowLeft size={15} />
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-[var(--pp-grey)] p-4 text-sm font-semibold text-[var(--pp-muted)]">
          لا توجد مواضيع جديدة مقترحة: كل ما قُرئ غُطّي بدروس. اقرأ نافذة جديدة من الكتاب أو اكتب
          موضوعًا بنفسك.
        </p>
      )}

      <div className="mt-4 border-t-2 border-[var(--pp-line)] pt-3">
        <button
          type="button"
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((open) => !open)}
          className="text-sm font-semibold text-[var(--pp-accent-text)] underline underline-offset-4"
        >
          {customOpen ? "إخفاء" : "موضوع آخر بكتابتي"}
        </button>
        {customOpen && (
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-semibold" htmlFor="next-lesson-topic">
              موضوع الدرس
            </label>
            <input
              id="next-lesson-topic"
              value={custom.topic}
              onChange={(event) =>
                setCustom((current) => ({ ...current, topic: event.target.value }))
              }
              placeholder="مثال: to be verbs"
              dir="ltr"
              className="w-full rounded-lg border-2 border-[var(--pp-ink)] bg-white px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <label htmlFor="next-lesson-from">من ص</label>
              <input
                id="next-lesson-from"
                type="number"
                min={1}
                max={readCursor}
                value={custom.from}
                onChange={(event) =>
                  setCustom((current) => ({ ...current, from: Number(event.target.value) }))
                }
                className="w-20 rounded-lg border-2 border-[var(--pp-ink)] bg-white px-2 py-1.5 text-center"
              />
              <label htmlFor="next-lesson-to">إلى ص</label>
              <input
                id="next-lesson-to"
                type="number"
                min={1}
                max={readCursor}
                value={custom.to}
                onChange={(event) =>
                  setCustom((current) => ({ ...current, to: Number(event.target.value) }))
                }
                className="w-20 rounded-lg border-2 border-[var(--pp-ink)] bg-white px-2 py-1.5 text-center"
              />
              <span className="text-xs font-medium text-[var(--pp-muted)]">
                (حتى ص{readCursor} مقروءة)
              </span>
            </div>
            <button
              type="button"
              disabled={busy || custom.topic.trim().length < 2}
              onClick={() =>
                onGenerate(
                  { topic: custom.topic.trim(), from: custom.from, to: custom.to },
                  "custom",
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] bg-[var(--pp-accent)] px-4 py-2 text-sm font-semibold text-[var(--pp-on-accent)] disabled:opacity-50"
            >
              {generatingKey === "custom" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              اكتب الدرس
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
