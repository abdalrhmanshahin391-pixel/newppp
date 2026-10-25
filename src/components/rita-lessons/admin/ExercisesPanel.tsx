import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminGenerateExercises,
  adminLessonExercises,
  adminPublishExercises,
  adminRegenerateExercise,
  adminSaveExercises,
  type ExercisesView,
} from "@/lib/rita-curriculum.functions";
import {
  LessonItemSchema,
  contentProblems,
  type LessonContent,
  type LessonItem,
} from "@/lib/rita-lesson-content";

const TEMPLATE_LABEL: Record<LessonItem["template"], string> = {
  choice_fill: "اختيار بالفراغ",
  meaning_choice: "اختيار المعنى",
  word_order: "ترتيب كلمات",
  syllable_tiles: "تركيب كلمة",
};

const BANK_LABEL = { guided: "مثال مع مساعدة", practice: "تمارين", remediation: "مراجعة" } as const;

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function answerOf(item: LessonItem): string {
  if (item.template === "word_order") return item.answer.join(" ");
  if (item.template === "syllable_tiles") return item.answer.join(" · ");
  return item.answer;
}

/**
 * The lesson's exercises for the admin: generate them from the lesson's pages, read the second
 * review's warnings, preview the lesson as a learner, edit or replace a question, and publish.
 * Learners only ever get published exercises; until then they keep the spoken lesson.
 */
export function ExercisesPanel({ lessonId }: { lessonId: string }) {
  const loadFn = useServerFn(adminLessonExercises);
  const generateFn = useServerFn(adminGenerateExercises);
  const saveFn = useServerFn(adminSaveExercises);
  const regenerateFn = useServerFn(adminRegenerateExercise);
  const publishFn = useServerFn(adminPublishExercises);
  const [view, setView] = useState<ExercisesView | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setView(await loadFn({ data: { lessonId } }));
    } catch (cause) {
      setError(message(cause));
    }
  }, [lessonId, loadFn]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(label: string, task: () => Promise<ExercisesView>, done?: string) {
    setBusy(label);
    setError("");
    try {
      setView(await task());
      if (done) toast.success(done);
    } catch (cause) {
      setError(message(cause));
      toast.error(message(cause));
    } finally {
      setBusy("");
    }
  }

  function saveContent(content: LessonContent, done: string) {
    const problems = contentProblems(content);
    if (problems.length) {
      setError(problems.slice(0, 3).join(" "));
      return;
    }
    void act("save", () => saveFn({ data: { lessonId, content } }), done);
  }

  function replaceItem(itemId: string, next: LessonItem | null) {
    if (!view?.content) return;
    const content: LessonContent = {
      ...view.content,
      sections: view.content.sections.map((section) => ({
        ...section,
        guided: section.guided.flatMap((item) =>
          item.id === itemId ? (next ? [next] : []) : [item],
        ),
        practice: section.practice.flatMap((item) =>
          item.id === itemId ? (next ? [next] : []) : [item],
        ),
        remediation: section.remediation.flatMap((item) =>
          item.id === itemId ? (next ? [next] : []) : [item],
        ),
      })),
    };
    saveContent(content, next ? "تم حفظ السؤال" : "تم حذف السؤال");
  }

  if (!view) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--pp-muted)]">
        {error ? (
          error
        ) : (
          <>
            <Loader2 size={15} className="animate-spin" /> جاري التحميل…
          </>
        )}
      </p>
    );
  }
  if (!view.ready) {
    return (
      <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-sm font-semibold">
        التمارين بتحتاج تحديث قاعدة البيانات: طبّق migration ‏20261025100000_rita_lessons_v2 في
        Lovable Cloud ثم حدّث الصفحة.
      </p>
    );
  }

  const generating = busy === "generate";
  const content = view.content;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="me-auto text-lg font-bold">تمارين الدرس</h3>
        {view.status !== "none" && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              view.status === "published"
                ? "bg-[#e6f4ea] text-[#1d6b3a]"
                : "bg-[var(--pp-grey)] text-[var(--pp-muted)]"
            }`}
          >
            {view.status === "published" ? `منشورة · نسخة ${view.version}` : "مسودة"}
          </span>
        )}
        {content && (
          <Link
            to="/rita-live"
            search={{ lesson: lessonId, preview: true }}
            target="_blank"
            className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
          >
            <Eye size={15} /> معاينة كطالب
          </Link>
        )}
        {content && (
          <button
            type="button"
            className={`rita-btn rita-btn-sm gap-1.5 ${view.status === "published" ? "rita-btn-soft" : "rita-btn-primary"}`}
            disabled={Boolean(busy) || (view.status !== "published" && view.problems.length > 0)}
            onClick={() =>
              void act(
                "publish",
                () => publishFn({ data: { lessonId, publish: view.status !== "published" } }),
                view.status === "published" ? "رجعت التمارين لمسودة" : "نُشرت التمارين للطلاب",
              )
            }
          >
            {busy === "publish" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            {view.status === "published" ? "إرجاع لمسودة" : "نشر للطلاب"}
          </button>
        )}
      </div>

      <p className="text-sm text-[var(--pp-muted)]">
        الطلاب بيشوفوا التمارين بس بعد النشر. قبلها بضل عندهم الدرس الصوتي القديم. المحاولة اللي
        بلّشت قبل نشر نسخة جديدة بتكمل على نسختها.
      </p>

      <button
        type="button"
        className="rita-btn rita-btn-secondary gap-2"
        disabled={Boolean(busy)}
        onClick={() => {
          if (
            content &&
            !window.confirm("إعادة التوليد بتستبدل كل التمارين الحالية بمسودة جديدة. نكمل؟")
          ) {
            return;
          }
          void act("generate", () => generateFn({ data: { lessonId } }), "جهزت التمارين كمسودة");
        }}
      >
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {content ? "أعد توليد كل التمارين" : "اصنع التمارين من صفحات الدرس"}
      </button>
      {generating && (
        <p role="status" className="text-sm text-[var(--pp-muted)]">
          بنكتب التمارين من صفحات الكتاب ثم بنراجعها مرة ثانية. بياخد دقيقة أو دقيقتين.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#fbe9ed] p-3 text-sm font-semibold text-[#8c1a31]"
        >
          {error}
        </p>
      )}
      {view.problems.length > 0 && (
        <div className="rounded-xl border-2 border-[#b3213f] p-3 text-sm">
          <p className="font-bold text-[#8c1a31]">لازم تتصلح قبل النشر:</p>
          <ul className="mt-1 list-disc space-y-1 ps-5" dir="ltr">
            {view.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {view.warnings.length > 0 && (
        <div className="rounded-xl bg-[#fff6e5] p-3 text-sm">
          <p className="flex items-center gap-1.5 font-bold text-[#8a5200]">
            <AlertTriangle size={15} /> ملاحظات المراجعة الثانية (شوفها قبل النشر):
          </p>
          <ul className="mt-1 list-disc space-y-1 ps-5" dir="auto">
            {view.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {content?.sections.map((section, sectionIndex) => (
        <section
          key={section.id}
          className="space-y-3 rounded-2xl border border-[var(--pp-line)] p-4"
        >
          <div>
            <p className="text-xs font-semibold text-[var(--pp-muted)]">
              الجزء {sectionIndex + 1} من {content.sections.length} · ص
              {section.source_pages.join("، ")}
            </p>
            <h4 className="text-base font-bold">
              {section.title_ar}{" "}
              <span dir="ltr" className="text-[var(--pp-muted)]">
                {section.title}
              </span>
            </h4>
            <p className="mt-1 text-sm">{section.explain.rule_ar}</p>
            {section.explain.table.length > 0 && (
              <p className="mt-1 text-sm text-[var(--pp-muted)]" dir="ltr">
                {section.explain.table.map((row) => `${row.left} → ${row.right}`).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--pp-muted)]">
              بيكفي {section.mastery.min_correct} صح من {section.mastery.required} للنجاح
            </p>
          </div>
          {(["guided", "practice", "remediation"] as const).map((bank) =>
            section[bank].length ? (
              <div key={bank}>
                <p className="text-xs font-bold text-[var(--pp-muted)]">
                  {BANK_LABEL[bank]} ({section[bank].length})
                </p>
                <ul className="mt-1 divide-y divide-[var(--pp-line)]">
                  {section[bank].map((item) => (
                    <li key={item.id} className="py-2">
                      {editing?.id === item.id ? (
                        <ItemEditor
                          text={editing.text}
                          onChange={(text) => setEditing({ id: item.id, text })}
                          onCancel={() => setEditing(null)}
                          onSave={() => {
                            let parsed: unknown;
                            try {
                              parsed = JSON.parse(editing.text);
                            } catch {
                              setError("الـ JSON مش صحيح.");
                              return;
                            }
                            const result = LessonItemSchema.safeParse({
                              ...(parsed as object),
                              id: item.id,
                            });
                            if (!result.success) {
                              setError(result.error.issues.map((issue) => issue.message).join(" "));
                              return;
                            }
                            setEditing(null);
                            replaceItem(item.id, result.data);
                          }}
                          busy={Boolean(busy)}
                        />
                      ) : (
                        <ItemRow
                          item={item}
                          busy={Boolean(busy)}
                          regenerating={busy === `item:${item.id}`}
                          onEdit={() =>
                            setEditing({ id: item.id, text: JSON.stringify(item, null, 2) })
                          }
                          onRegenerate={() =>
                            void act(
                              `item:${item.id}`,
                              () => regenerateFn({ data: { lessonId, itemId: item.id } }),
                              "انكتب سؤال بديل",
                            )
                          }
                          onDelete={() => {
                            if (window.confirm("حذف هذا السؤال؟")) replaceItem(item.id, null);
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </section>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  busy,
  regenerating,
  onEdit,
  onRegenerate,
  onDelete,
}: {
  item: LessonItem;
  busy: boolean;
  regenerating: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  const options =
    item.template === "choice_fill" || item.template === "meaning_choice" ? item.options : [];
  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-xs text-[var(--pp-muted)]">
          {item.id} · {TEMPLATE_LABEL[item.template]} · {item.skill_tag}
        </p>
        <p className="font-semibold" dir="ltr">
          {item.template === "meaning_choice" || item.template === "syllable_tiles"
            ? item.word
            : item.prompt}
        </p>
        {options.length > 0 && (
          <p className="text-[var(--pp-muted)]" dir="auto">
            {options
              .map((option) => (option === answerOf(item) ? `✓ ${option}` : option))
              .join(" · ")}
          </p>
        )}
        {options.length === 0 && (
          <p className="text-[var(--pp-muted)]" dir="ltr">
            ✓ {answerOf(item)}
          </p>
        )}
        {item.explain_ar && <p className="text-xs text-[var(--pp-muted)]">{item.explain_ar}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          className="rita-btn rita-btn-quiet rita-btn-sm"
          disabled={busy}
          onClick={onEdit}
          aria-label="تعديل"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="rita-btn rita-btn-quiet rita-btn-sm gap-1"
          disabled={busy}
          onClick={onRegenerate}
          aria-label="سؤال بديل"
        >
          {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
        <button
          type="button"
          className="rita-btn rita-btn-quiet rita-btn-sm"
          disabled={busy}
          onClick={onDelete}
          aria-label="حذف"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ItemEditor({
  text,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  text: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-2">
      <textarea
        dir="ltr"
        value={text}
        onChange={(event) => onChange(event.target.value)}
        rows={12}
        className="w-full rounded-lg border-2 border-[var(--pp-ink)] p-2 font-mono text-[13px]"
        aria-label="السؤال (JSON)"
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="rita-btn rita-btn-primary rita-btn-sm"
          disabled={busy}
          onClick={onSave}
        >
          حفظ
        </button>
        <button type="button" className="rita-btn rita-btn-soft rita-btn-sm" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
