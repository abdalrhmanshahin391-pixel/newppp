import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, GripVertical, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { publishPlan, type ExercisesState } from "@/lib/rita-book-flow";
import {
  adminPublishExercises,
  adminReorderLessons,
  adminSetCurriculumStatus,
  adminSetLessonStatus,
  type CurriculumRow,
  type LessonRow,
} from "@/lib/rita-curriculum.functions";
import { errorText } from "./book-utils";
import { BidiText, ErrorBox } from "./BookBits";

/**
 * Step 4: publish. One button publishes the book and every lesson that is ready (with its
 * exercises); lessons with problems are left out and named. Below it, the order of the learner path
 * across all published books.
 */
export function StepPublish({
  book,
  lessons,
  allLessons,
  exercises,
  onChanged,
}: {
  book: CurriculumRow;
  lessons: LessonRow[];
  allLessons: LessonRow[];
  exercises: Record<string, ExercisesState>;
  onChanged: () => Promise<void>;
}) {
  const lessonStatusFn = useServerFn(adminSetLessonStatus);
  const bookStatusFn = useServerFn(adminSetCurriculumStatus);
  const publishExercisesFn = useServerFn(adminPublishExercises);
  const reorderFn = useServerFn(adminReorderLessons);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const plan = useMemo(() => publishPlan(lessons, exercises), [exercises, lessons]);
  const byId = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson])), [lessons]);
  const live = lessons.filter((lesson) => lesson.status !== "archived");
  const published = live.filter((lesson) => lesson.status === "published").length;
  const path = useMemo(
    () =>
      allLessons
        .filter((lesson) => lesson.status === "published" && lesson.path_order != null)
        .sort((a, b) => Number(a.path_order) - Number(b.path_order)),
    [allLessons],
  );
  const nothingToDo = plan.publish.length === 0 && book.status === "published";

  async function publishAll() {
    setBusy("publish");
    setError("");
    let done = 0;
    try {
      for (const id of plan.publish) {
        const lesson = byId.get(id);
        if (!lesson) continue;
        if (plan.withExercises.includes(id) && exercises[id]?.status === "draft") {
          await publishExercisesFn({ data: { lessonId: id, publish: true } });
        }
        if (lesson.status !== "published") {
          await lessonStatusFn({ data: { lessonId: id, status: "published" } });
        }
        done += 1;
      }
      if (book.status !== "published") {
        await bookStatusFn({ data: { curriculumId: book.id, status: "published" } });
      }
      toast.success(done ? `انشر الكتاب و${done} من الدروس` : "انشر الكتاب");
    } catch (cause) {
      setError(`انشر ${done} من ${plan.publish.length} قبل ما يوقف: ${errorText(cause)}`);
    } finally {
      setBusy("");
      await onChanged();
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="step-publish-title">
      <div>
        <h2 id="step-publish-title" className="text-[22px] font-bold">
          النشر
        </h2>
        <p className="mt-1 text-[15px] text-[var(--pp-muted)]">
          الطالب بيشوف الدرس لما يكون الدرس والكتاب منشورين.
        </p>
      </div>

      <ul className="space-y-1.5 text-[16px]">
        <li>
          الكتاب: <strong>{book.status === "published" ? "منشور" : "مسودة"}</strong>
        </li>
        <li>
          دروس منشورة: <strong>{published}</strong> من {live.length}
        </li>
        {plan.publish.length > 0 && (
          <li>
            جاهز للنشر: <strong>{plan.publish.length}</strong>
            {plan.spokenOnly.length > 0
              ? ` (منهم ${plan.spokenOnly.length} بدون تمارين، بينشروا كدرس صوتي)`
              : ""}
          </li>
        )}
      </ul>

      {plan.blocked.length > 0 && (
        <div className="rounded-xl bg-[#fbe9ed] p-3 text-[15px] text-[#8c1a31]">
          <p className="font-semibold">
            هدول ما رح ينشروا لأن فيهم مشكلة بالتمارين (صلّحها من المراجعة):
          </p>
          <ul className="mt-1 list-disc ps-5">
            {plan.blocked.map((id) => (
              <li key={id}>
                <BidiText text={byId.get(id)?.title_ar || byId.get(id)?.title || ""} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {nothingToDo ? (
        <p className="flex items-center gap-2 text-[16px] font-semibold text-[#1d6b3a]">
          <CheckCircle2 size={18} aria-hidden="true" /> كل اشي منشور.
        </p>
      ) : (
        <button
          type="button"
          disabled={Boolean(busy) || live.length === 0}
          onClick={() => void publishAll()}
          className="rita-btn rita-btn-primary gap-2"
        >
          {busy === "publish" ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Send size={16} aria-hidden="true" />
          )}
          {plan.publish.length
            ? `انشر الكتاب والدروس الجاهزة (${plan.publish.length})`
            : "انشر الكتاب"}
        </button>
      )}
      {error && <ErrorBox hint={error} onClose={() => setError("")} />}

      {book.status === "published" && (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => {
            if (!window.confirm("إلغاء نشر الكتاب؟ كل دروسه بتختفي عن الطلاب.")) return;
            setBusy("unpublish");
            void bookStatusFn({ data: { curriculumId: book.id, status: "draft" } })
              .then(() => toast.success("رجع الكتاب مسودة"))
              .catch((cause) => toast.error(errorText(cause)))
              .finally(() => {
                setBusy("");
                void onChanged();
              });
          }}
          className="rita-btn rita-btn-quiet rita-btn-sm"
        >
          إلغاء نشر الكتاب
        </button>
      )}

      {path.length > 1 && (
        <PathOrder
          lessons={path}
          disabled={Boolean(busy)}
          onReorder={async (lessonIds) => {
            setBusy("reorder");
            try {
              await reorderFn({ data: { lessonIds } });
              toast.success("انحفظ ترتيب المسار");
            } catch (cause) {
              toast.error(errorText(cause));
              throw cause;
            } finally {
              setBusy("");
              await onChanged();
            }
          }}
        />
      )}
    </section>
  );
}

/** Drag (or arrow keys) to order the learner path: published lessons of every book. */
function PathOrder({
  lessons,
  disabled,
  onReorder,
}: {
  lessons: LessonRow[];
  disabled: boolean;
  onReorder: (lessonIds: string[]) => Promise<void>;
}) {
  const toItems = (rows: LessonRow[]) =>
    rows.map((lesson) => ({ id: lesson.id, title: lesson.title_ar || lesson.title }));
  const [items, setItems] = useState(() => toItems(lessons));
  useEffect(() => setItems(toItems(lessons)), [lessons]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
    void onReorder(next.map((item) => item.id)).catch(() => setItems(previous));
  }

  return (
    <details className="rounded-xl border border-[var(--pp-line)] p-3">
      <summary className="cursor-pointer text-[15px] font-semibold">
        ترتيب مسار الطلاب ({items.length} درس من كل الكتب)
      </summary>
      <p className="mt-2 text-[14px] text-[var(--pp-muted)]">
        اسحب الدرس لمكانه، أو استخدم المسافة والأسهم.
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
              <PathRow key={item.id} id={item.id} title={item.title} index={index} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </details>
  );
}

function PathRow({ id, title, index }: { id: string; title: string; index: number }) {
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
      className="flex min-h-[48px] cursor-grab touch-none items-center gap-3 rounded-xl border border-[var(--pp-line)] bg-white px-3 text-[15px] font-semibold"
    >
      <GripVertical size={16} className="text-[var(--pp-muted)]" aria-hidden="true" />
      <span className="w-6 text-[13px] tabular-nums text-[var(--pp-accent-text)]">{index + 1}</span>
      <BidiText text={title} />
    </li>
  );
}
