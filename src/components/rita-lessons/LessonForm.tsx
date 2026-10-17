import { useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  LESSON_PHASES,
  LessonDraftSchema,
  describeSchemaError,
  type LessonDraft,
  type Objective,
} from "@/lib/rita-curriculum";

/**
 * A multi-line editor that keeps raw text while typing and only parses the
 * lines on blur, so pressing Enter or typing a separator is never swallowed.
 */
function LinesInput({
  value,
  onCommit,
  placeholder,
  rows = 2,
}: {
  value: string[];
  onCommit: (lines: string[]) => void;
  placeholder: string;
  rows?: number;
}) {
  const [text, setText] = useState(value.join("\n"));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value.join("\n"));
  }, [value, focused]);
  return (
    <textarea
      value={text}
      placeholder={placeholder}
      rows={rows}
      dir="ltr"
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onCommit(
          text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        );
      }}
      onChange={(event) => setText(event.target.value)}
      className="w-full rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
    />
  );
}

/**
 * A structured lesson editor for admins: no raw JSON. Existing objectives keep
 * their ids so learners' earned progress survives an edit; the AI can rewrite
 * one objective's wording on request (the id still never changes).
 */
export function LessonForm({
  initial,
  busy,
  onCancel,
  onSave,
  onRegenerateObjective,
}: {
  initial: LessonDraft;
  busy: boolean;
  onCancel: () => void;
  onSave: (draft: LessonDraft) => void;
  onRegenerateObjective: (objective: Objective) => Promise<Objective | null>;
}) {
  const [form, setForm] = useState<LessonDraft>(() => structuredClone(initial));
  const [regenerating, setRegenerating] = useState(-1);

  const patch = (part: Partial<LessonDraft>) => setForm((current) => ({ ...current, ...part }));

  const newObjectiveId = () =>
    `objective-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;

  async function regenerate(index: number) {
    // Regeneration works on the objective as currently edited in the form,
    // never on a saved array index (local edits would target the wrong one).
    const current = form.objectives[index];
    if (!current) return;
    // The response is applied by stable id: if the objective was deleted or
    // moved while the AI was writing, nothing is overwritten or duplicated.
    const targetId = current.id;
    setRegenerating(index);
    try {
      const next = await onRegenerateObjective(current);
      if (next) {
        setForm((state) => {
          if (!state.objectives.some((objective) => objective.id === targetId)) {
            return state; // deleted while regenerating: drop the response
          }
          return {
            ...state,
            objectives: state.objectives.map((objective) =>
              objective.id === targetId ? next : objective,
            ),
          };
        });
        toast.success("أُعيدت صياغة الهدف — راجعها قبل الحفظ");
      }
    } finally {
      setRegenerating(-1);
    }
  }

  function save() {
    const parsed = LessonDraftSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(`النموذج غير مكتمل: ${describeSchemaError(parsed.error)}`);
      return;
    }
    onSave(parsed.data);
  }

  return (
    <div className="mt-3 space-y-4 rounded-2xl bg-[#ffffff] p-4" dir="rtl">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={form.title}
          onChange={(event) => patch({ title: event.target.value })}
          placeholder="عنوان الدرس (إنجليزي)"
          dir="ltr"
          className="rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
        />
        <input
          value={form.title_ar}
          onChange={(event) => patch({ title_ar: event.target.value })}
          placeholder="عنوان الدرس (عربي)"
          className="rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={form.topic}
          onChange={(event) => patch({ topic: event.target.value })}
          placeholder="الموضوع"
          dir="ltr"
          className="rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm font-bold">
          من ص
          <input
            type="number"
            min={1}
            value={form.source_from_page}
            onChange={(event) =>
              patch({ source_from_page: Math.max(1, Number(event.target.value) || 1) })
            }
            className="w-16 rounded-lg border-2 border-[#0b0b0f] px-2 py-1 text-center"
          />
          إلى ص
          <input
            type="number"
            min={form.source_from_page}
            value={form.source_to_page}
            onChange={(event) =>
              patch({
                source_to_page: Math.max(
                  form.source_from_page,
                  Number(event.target.value) || form.source_from_page,
                ),
              })
            }
            className="w-16 rounded-lg border-2 border-[#0b0b0f] px-2 py-1 text-center"
          />
        </label>
        <input
          value={form.image_prompt}
          onChange={(event) => patch({ image_prompt: event.target.value })}
          placeholder="وصف الصورة (اختياري)"
          dir="ltr"
          className="rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
        />
      </div>
      <textarea
        value={form.summary}
        onChange={(event) => patch({ summary: event.target.value })}
        placeholder="ملخص: شو بتعلّم ريتا في هذا الدرس؟"
        rows={2}
        className="w-full rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
      />

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">الأهداف</p>
          <button
            type="button"
            disabled={form.objectives.length >= 6}
            onClick={() =>
              setForm((current) => ({
                ...current,
                objectives: [
                  ...current.objectives,
                  {
                    id: newObjectiveId(),
                    text: "",
                    text_ar: "",
                    criteria: "",
                    check_prompts: [""],
                    weight: 1,
                  },
                ],
              }))
            }
            className="flex items-center gap-1 rounded-full bg-[#ffffff] px-3 py-1 text-xs font-bold text-[#4a82f3] disabled:opacity-50"
          >
            <Plus size={13} /> هدف جديد
          </button>
        </div>
        <p className="mt-1 text-[11px] font-bold text-[#c4c4d1]">
          كل هدف يحتفظ بمعرّفه — تقدّم الطلاب في الأهداف الموجودة ما بضيع مع التعديل.
        </p>
        <div className="mt-2 space-y-3">
          {form.objectives.map((objective, index) => (
            <div key={objective.id} className="rounded-xl border-2 border-[#0b0b0f] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#7ba5f5]">
                  هدف {index + 1} · {objective.id}
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={objective.weight}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        objectives: current.objectives.map((item, position) =>
                          position === index
                            ? { ...item, weight: Number(event.target.value) }
                            : item,
                        ),
                      }))
                    }
                    className="rounded-lg border-2 border-[#0b0b0f] px-2 py-1 text-xs font-bold"
                    aria-label="وزن الهدف"
                  >
                    {[1, 2, 3, 4, 5].map((weight) => (
                      <option key={weight} value={weight}>
                        وزن {weight}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void regenerate(index)}
                    disabled={busy || regenerating >= 0}
                    className="flex items-center gap-1 rounded-full border-2 border-[#0b0b0f] px-3 py-1 text-xs font-bold disabled:opacity-50"
                  >
                    {regenerating === index ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    إعادة صياغة
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        objectives: current.objectives.filter((_, position) => position !== index),
                      }))
                    }
                    className="rounded-full p-1 text-[#9a9aab] hover:bg-[#ffffff]"
                    aria-label="حذف الهدف"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  value={objective.text}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      objectives: current.objectives.map((item, position) =>
                        position === index ? { ...item, text: event.target.value } : item,
                      ),
                    }))
                  }
                  placeholder="الهدف (إنجليزي): Learner can …"
                  dir="ltr"
                  className="rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
                />
                <input
                  value={objective.text_ar}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      objectives: current.objectives.map((item, position) =>
                        position === index ? { ...item, text_ar: event.target.value } : item,
                      ),
                    }))
                  }
                  placeholder="الهدف (عربي)"
                  className="rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
                />
              </div>
              <input
                value={objective.criteria}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    objectives: current.objectives.map((item, position) =>
                      position === index ? { ...item, criteria: event.target.value } : item,
                    ),
                  }))
                }
                placeholder="معيار الإنجاز: شو بالضبط لازم يقول الطالب؟"
                dir="ltr"
                className="mt-2 w-full rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
              />
              <LinesInput
                value={objective.check_prompts}
                onCommit={(prompts) =>
                  setForm((current) => ({
                    ...current,
                    objectives: current.objectives.map((item, position) =>
                      position === index ? { ...item, check_prompts: prompts } : item,
                    ),
                  }))
                }
                placeholder="أسئلة الفحص — سؤال واحد في كل سطر (إنجليزي)"
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">خطة الدرس</p>
          <button
            type="button"
            disabled={form.plan.phases.length >= 6}
            onClick={() =>
              setForm((current) => ({
                ...current,
                plan: {
                  ...current.plan,
                  phases: [...current.plan.phases, { phase: "teach", minutes: 2, steps: [""] }],
                },
              }))
            }
            className="flex items-center gap-1 rounded-full bg-[#ffffff] px-3 py-1 text-xs font-bold text-[#4a82f3] disabled:opacity-50"
          >
            <Plus size={13} /> مرحلة
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {form.plan.phases.map((phase, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-[#0b0b0f] bg-white p-2"
            >
              <select
                value={phase.phase}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    plan: {
                      ...current.plan,
                      phases: current.plan.phases.map((item, position) =>
                        position === index
                          ? { ...item, phase: event.target.value as typeof item.phase }
                          : item,
                      ),
                    },
                  }))
                }
                className="rounded-lg border-2 border-[#0b0b0f] px-2 py-1 text-xs font-bold"
                aria-label="نوع المرحلة"
              >
                {LESSON_PHASES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={10}
                value={phase.minutes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    plan: {
                      ...current.plan,
                      phases: current.plan.phases.map((item, position) =>
                        position === index
                          ? {
                              ...item,
                              minutes: Math.min(10, Math.max(1, Number(event.target.value) || 1)),
                            }
                          : item,
                      ),
                    },
                  }))
                }
                className="w-14 rounded-lg border-2 border-[#0b0b0f] px-2 py-1 text-center text-xs"
                aria-label="دقائق"
              />
              <div className="min-w-[160px] flex-1">
                <LinesInput
                  value={phase.steps}
                  onCommit={(steps) =>
                    setForm((current) => ({
                      ...current,
                      plan: {
                        ...current.plan,
                        phases: current.plan.phases.map((item, position) =>
                          position === index ? { ...item, steps } : item,
                        ),
                      },
                    }))
                  }
                  placeholder="خطوات المرحلة — خطوة في كل سطر (إنجليزي)"
                  rows={2}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    plan: {
                      ...current.plan,
                      phases: current.plan.phases.filter((_, position) => position !== index),
                    },
                  }))
                }
                className="rounded-full p-1 text-[#9a9aab] hover:bg-[#ffffff]"
                aria-label="حذف المرحلة"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <textarea
          value={form.plan.teacher_notes}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              plan: { ...current.plan, teacher_notes: event.target.value },
            }))
          }
          placeholder="ملاحظات المعلم: أخطاء الناطقين بالعربية الشائعة وكيف نصححها"
          rows={2}
          className="mt-2 w-full rounded-xl border-2 border-[#0b0b0f] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">الكلمات</p>
          <button
            type="button"
            disabled={form.vocabulary.length >= 30}
            onClick={() =>
              setForm((current) => ({
                ...current,
                vocabulary: [...current.vocabulary, { word: "", meaning_ar: "", example: "" }],
              }))
            }
            className="flex items-center gap-1 rounded-full bg-[#ffffff] px-3 py-1 text-xs font-bold text-[#4a82f3] disabled:opacity-50"
          >
            <Plus size={13} /> كلمة
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {form.vocabulary.map((item, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <input
                value={item.word}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    vocabulary: current.vocabulary.map((entry, position) =>
                      position === index ? { ...entry, word: event.target.value } : entry,
                    ),
                  }))
                }
                placeholder="word"
                dir="ltr"
                className="w-28 rounded-lg border-2 border-[#0b0b0f] px-2 py-1 text-sm"
              />
              <input
                value={item.meaning_ar}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    vocabulary: current.vocabulary.map((entry, position) =>
                      position === index ? { ...entry, meaning_ar: event.target.value } : entry,
                    ),
                  }))
                }
                placeholder="المعنى"
                className="w-28 rounded-lg border-2 border-[#0b0b0f] px-2 py-1 text-sm"
              />
              <input
                value={item.example}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    vocabulary: current.vocabulary.map((entry, position) =>
                      position === index ? { ...entry, example: event.target.value } : entry,
                    ),
                  }))
                }
                placeholder="Example sentence."
                dir="ltr"
                className="min-w-[140px] flex-1 rounded-lg border-2 border-[#0b0b0f] px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    vocabulary: current.vocabulary.filter((_, position) => position !== index),
                  }))
                }
                className="rounded-full p-1 text-[#9a9aab] hover:bg-[#ffffff]"
                aria-label="حذف الكلمة"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-full bg-[#1a4ba8] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          حفظ الدرس
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm font-bold"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
