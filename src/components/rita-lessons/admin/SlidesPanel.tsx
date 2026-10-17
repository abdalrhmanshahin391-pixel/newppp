import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import {
  MAX_SLIDES,
  SLIDE_KINDS,
  addSlide,
  deckProblem,
  moveSlide,
  removeSlide,
  type Slide,
  type SlideKind,
} from "@/lib/rita-slides";

export const SLIDE_KIND_LABEL: Record<SlideKind, string> = {
  title: "عنوان",
  point: "فكرة",
  example: "مثال",
  vocabulary: "مفردات",
  practice: "تمرين",
  recap: "خلاصة",
};

const field =
  "w-full rounded-lg border-2 border-[var(--pp-ink)] bg-white px-3 py-2 text-sm text-[var(--pp-ink)]";

/** Lines the admin typed become bullets: blanks dropped, one bullet per line. */
function linesToBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
}

/** "word | معنى | example" per line. */
function linesToVocabulary(text: string): Slide["vocabulary"] {
  return text
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter((parts) => parts[0])
    .slice(0, 8)
    .map((parts) => ({ word: parts[0], meaning_ar: parts[1] ?? "", example: parts[2] ?? "" }));
}

function vocabularyToLines(items: Slide["vocabulary"]) {
  return items.map((item) => [item.word, item.meaning_ar, item.example].join(" | ")).join("\n");
}

export function SlidePreview({ slide }: { slide: Slide }) {
  return (
    <div
      className="flex min-h-[16rem] flex-col gap-3 overflow-auto rounded-[20px] border-2 border-[var(--pp-ink)] bg-white p-6"
      aria-label={`معاينة: ${slide.heading || "سلايد بلا عنوان"}`}
    >
      <p className="text-sm font-semibold text-[var(--pp-muted)]">
        {SLIDE_KIND_LABEL[slide.kind]}
        {slide.source_page ? ` · ص${slide.source_page}` : ""}
      </p>
      <h4 className="font-display text-2xl font-bold leading-tight" dir="ltr">
        {slide.heading || "—"}
      </h4>
      {slide.heading_ar && (
        <p className="text-lg font-semibold text-[var(--pp-muted)]">{slide.heading_ar}</p>
      )}
      {slide.bullets.length > 0 && (
        <ul className="list-disc space-y-1 ps-6 text-base" dir="ltr">
          {slide.bullets.map((bullet, index) => (
            <li key={`${index}-${bullet}`}>{bullet}</li>
          ))}
        </ul>
      )}
      {slide.example && (
        <p className="rounded-xl bg-[var(--pp-grey)] px-4 py-3 text-base font-semibold" dir="ltr">
          {slide.example}
        </p>
      )}
      {slide.vocabulary.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {slide.vocabulary.map((item) => (
            <li
              key={item.word}
              className="rounded-xl border-2 border-[var(--pp-line)] px-3 py-2 text-sm"
            >
              <span className="font-bold" dir="ltr">
                {item.word}
              </span>
              {item.meaning_ar && (
                <span className="text-[var(--pp-muted)]"> — {item.meaning_ar}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The slide deck of one lesson: a strip of thumbnails, a live preview and a
 * small editor. A deck is generated from the lesson's own pages and can then be
 * changed by hand; nothing is saved until the admin presses save.
 */
export function SlidesPanel({
  from,
  to,
  ready,
  saved,
  busy,
  generating,
  onGenerate,
  onSave,
}: {
  from: number;
  to: number;
  /** false while the slides table has not been created yet */
  ready: boolean;
  saved: Slide[] | undefined;
  busy: boolean;
  generating: boolean;
  onGenerate: () => void;
  onSave: (slides: Slide[]) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Slide[]>(saved ?? []);
  const [index, setIndex] = useState(0);
  const [newKind, setNewKind] = useState<SlideKind>("point");
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved ?? []),
    [draft, saved],
  );
  const problem = useMemo(() => (draft.length ? deckProblem(draft) : null), [draft]);
  const current = draft[Math.min(index, Math.max(0, draft.length - 1))];
  const currentIndex = current ? draft.indexOf(current) : -1;

  function update(patch: Partial<Slide>) {
    if (!current) return;
    setDraft((slides) =>
      slides.map((slide) => (slide.id === current.id ? { ...slide, ...patch } : slide)),
    );
  }

  if (!ready) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-[var(--pp-line)] p-6 text-sm font-semibold text-[var(--pp-muted)]">
        السلايدات تحتاج تحديث قاعدة البيانات (migration 20261017120000) في Lovable Cloud. بقية
        الصفحة تعمل كالمعتاد.
      </p>
    );
  }

  if (generating) {
    return (
      <div role="status" className="rounded-2xl border-2 border-[var(--pp-line)] p-6">
        <p className="flex items-center gap-2 font-semibold">
          <Loader2 size={18} className="animate-spin" /> يكتب السلايدات من الصفحات {from}–{to}…
        </p>
        <div className="mt-4 flex gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((n) => (
            <span key={n} className="h-16 w-28 animate-pulse rounded-xl bg-[var(--pp-grey)]" />
          ))}
        </div>
      </div>
    );
  }

  if (draft.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[var(--pp-line)] p-8 text-center">
        <p className="text-lg font-bold">لا توجد سلايدات لهذا الدرس بعد</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--pp-muted)]">
          يقرأ الذكاء الاصطناعي صفحات الدرس (ص{from}–{to}) ويكتب 6–9 سلايدات: عنوان، أفكار، أمثلة،
          مفردات، تمرين وخلاصة. تراجعها وتعدّلها قبل الحفظ.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onGenerate}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] bg-[var(--pp-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--pp-on-accent)] disabled:opacity-50"
        >
          <Sparkles size={16} /> ولّد السلايدات
        </button>
        <p className="mt-3 text-xs text-[var(--pp-muted)]">أو أضف سلايدًا يدويًا:</p>
        <button
          type="button"
          onClick={() => {
            setDraft(addSlide([], "title"));
            setIndex(0);
          }}
          className="mt-1 text-sm font-semibold text-[var(--pp-accent-text)] underline underline-offset-4"
        >
          ابدأ من سلايد فارغ
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--pp-muted)]">
          {draft.length} من {MAX_SLIDES} سلايد · ص{from}–{to}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !dirty || Boolean(problem) || saving}
            onClick={async () => {
              setSaving(true);
              const ok = await onSave(draft);
              setSaving(false);
              if (!ok) return;
            }}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] bg-[var(--pp-accent)] px-4 py-2 text-sm font-semibold text-[var(--pp-on-accent)] disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            حفظ السلايدات
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setDraft(saved ?? []);
                setIndex(0);
              }}
              className="rounded-lg border-2 border-[var(--pp-ink)] bg-white px-4 py-2 text-sm font-semibold"
            >
              تراجع عن التعديلات
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "سيُستبدل هذا الدرس بسلايدات جديدة من الصفحات، وتضيع تعديلاتك عليها. متابعة؟",
                )
              ) {
                onGenerate();
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Sparkles size={15} /> أعد التوليد
          </button>
        </div>
      </div>
      {problem && (
        <p
          role="alert"
          className="rounded-xl border-2 border-[#b3213f] bg-[#fdecef] px-3 py-2 text-sm font-semibold text-[#b3213f]"
        >
          لا يمكن الحفظ بعد: {problem}
        </p>
      )}
      {dirty && !problem && (
        <p role="status" className="text-sm font-semibold text-[var(--pp-muted)]">
          لديك تعديلات غير محفوظة.
        </p>
      )}

      <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="السلايدات">
        {draft.map((slide, position) => (
          <li key={slide.id} className="shrink-0">
            <button
              type="button"
              aria-current={position === currentIndex ? "true" : undefined}
              onClick={() => setIndex(position)}
              className={`flex h-20 w-36 flex-col rounded-xl border-2 p-2 text-start transition-colors ${
                position === currentIndex
                  ? "border-[var(--pp-ink)] bg-[var(--pp-accent-soft)]"
                  : "border-[var(--pp-line)] bg-white hover:border-[var(--pp-ink)]"
              }`}
            >
              <span className="text-[11px] font-semibold text-[var(--pp-muted)]">
                {position + 1} · {SLIDE_KIND_LABEL[slide.kind]}
              </span>
              <span className="mt-1 line-clamp-2 text-xs font-bold leading-snug" dir="ltr">
                {slide.heading || "بلا عنوان"}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {current && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-3 rounded-2xl bg-[var(--pp-grey)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-semibold" htmlFor="slide-kind">
                النوع
              </label>
              <select
                id="slide-kind"
                value={current.kind}
                onChange={(event) => update({ kind: event.target.value as SlideKind })}
                className={`${field} w-auto`}
              >
                {SLIDE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {SLIDE_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
              <span className="ms-auto flex gap-1">
                <button
                  type="button"
                  aria-label="قدّم السلايد"
                  disabled={currentIndex === 0}
                  onClick={() => {
                    setDraft((slides) => moveSlide(slides, current.id, "up"));
                    setIndex(currentIndex - 1);
                  }}
                  className="rounded-lg border-2 border-[var(--pp-ink)] bg-white p-1.5 disabled:opacity-40"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label="أخّر السلايد"
                  disabled={currentIndex === draft.length - 1}
                  onClick={() => {
                    setDraft((slides) => moveSlide(slides, current.id, "down"));
                    setIndex(currentIndex + 1);
                  }}
                  className="rounded-lg border-2 border-[var(--pp-ink)] bg-white p-1.5 disabled:opacity-40"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label="احذف السلايد"
                  disabled={draft.length <= 1}
                  onClick={() => {
                    if (window.confirm("حذف هذا السلايد؟")) {
                      setDraft((slides) => removeSlide(slides, current.id));
                      setIndex(Math.max(0, currentIndex - 1));
                    }
                  }}
                  className="rounded-lg border-2 border-[var(--pp-ink)] bg-white p-1.5 text-[#b3213f] disabled:opacity-40"
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </div>

            <label className="block text-sm font-semibold" htmlFor="slide-heading">
              العنوان (English)
            </label>
            <input
              id="slide-heading"
              dir="ltr"
              value={current.heading}
              maxLength={120}
              onChange={(event) => update({ heading: event.target.value })}
              className={field}
            />
            <label className="block text-sm font-semibold" htmlFor="slide-heading-ar">
              العنوان بالعربي
            </label>
            <input
              id="slide-heading-ar"
              value={current.heading_ar}
              maxLength={120}
              onChange={(event) => update({ heading_ar: event.target.value })}
              className={field}
            />
            <label className="block text-sm font-semibold" htmlFor={`slide-bullets-${current.id}`}>
              النقاط (سطر لكل نقطة، حتى 6)
            </label>
            <textarea
              key={`bullets-${current.id}`}
              id={`slide-bullets-${current.id}`}
              dir="ltr"
              rows={4}
              defaultValue={current.bullets.join("\n")}
              onBlur={(event) => update({ bullets: linesToBullets(event.target.value) })}
              className={field}
            />
            <label className="block text-sm font-semibold" htmlFor="slide-example">
              مثال
            </label>
            <input
              id="slide-example"
              dir="ltr"
              value={current.example}
              maxLength={240}
              onChange={(event) => update({ example: event.target.value })}
              className={field}
            />
            <label className="block text-sm font-semibold" htmlFor={`slide-vocab-${current.id}`}>
              المفردات (word | المعنى | مثال، سطر لكل كلمة)
            </label>
            <textarea
              key={`vocab-${current.id}`}
              id={`slide-vocab-${current.id}`}
              dir="ltr"
              rows={3}
              defaultValue={vocabularyToLines(current.vocabulary)}
              onBlur={(event) => update({ vocabulary: linesToVocabulary(event.target.value) })}
              className={field}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-semibold" htmlFor="slide-page">
                صفحة المصدر
              </label>
              <input
                id="slide-page"
                type="number"
                min={from}
                max={to}
                value={current.source_page ?? ""}
                onChange={(event) =>
                  update({
                    source_page: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
                className={`${field} w-24`}
              />
            </div>
            <label className="block text-sm font-semibold" htmlFor="slide-note">
              ملاحظة المعلّم (ما يقوله بصوته)
            </label>
            <textarea
              id="slide-note"
              rows={2}
              value={current.speaker_note}
              maxLength={400}
              onChange={(event) => update({ speaker_note: event.target.value })}
              className={field}
            />
          </div>

          <div className="min-w-0 space-y-3">
            <SlidePreview slide={current} />
            {current.speaker_note && (
              <p className="rounded-xl bg-[var(--pp-grey)] px-4 py-3 text-sm text-[var(--pp-muted)]">
                <span className="font-semibold text-[var(--pp-ink)]">يقول: </span>
                {current.speaker_note}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-semibold" htmlFor="slide-new-kind">
                أضف سلايدًا
              </label>
              <select
                id="slide-new-kind"
                value={newKind}
                onChange={(event) => setNewKind(event.target.value as SlideKind)}
                className={`${field} w-auto`}
              >
                {SLIDE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {SLIDE_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={draft.length >= MAX_SLIDES}
                onClick={() => {
                  const next = addSlide(draft, newKind);
                  setDraft(next);
                  setIndex(next.findIndex((slide) => !draft.some((old) => old.id === slide.id)));
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[var(--pp-ink)] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
              >
                <Plus size={15} /> إضافة
              </button>
              {draft.length >= MAX_SLIDES && (
                <span className="text-xs text-[var(--pp-muted)]">وصلت للحد ({MAX_SLIDES}).</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
