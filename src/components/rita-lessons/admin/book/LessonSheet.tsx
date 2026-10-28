import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  FileText,
  ListChecks,
  Loader2,
  Paperclip,
  Play,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import type { LessonRow } from "@/lib/rita-curriculum.functions";
import type { RowStatus } from "@/lib/study/lesson-maker";
import { pagesLabel } from "./book-utils";
import { BidiText } from "./BookBits";

export type SheetTab = "plan" | "exercises" | "study" | "resources";

export type SheetFacts = {
  exercises: "none" | "draft" | "published";
  exerciseProblems: number;
  linked: boolean;
};

/**
 * One lesson, simply: what the learner gets, "try it as a learner" and "publish". Everything that
 * edits the lesson is one level deeper, under «تعديل», and opens the full editor at that part.
 */
export function LessonSheet({
  lesson,
  status,
  facts,
  busy,
  publishing,
  onClose,
  onPublish,
  onUnpublish,
  onFinish,
  onEdit,
}: {
  lesson: LessonRow | null;
  status: RowStatus;
  facts: SheetFacts;
  busy: boolean;
  publishing: boolean;
  onClose: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onFinish: () => void;
  onEdit: (tab: SheetTab) => void;
}) {
  const published = status === "published";
  const unfinished = status === "incomplete" || status === "failed" || status === "new";
  const working = status === "working" || status === "queued";
  return (
    <Dialog.Root open={lesson !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="uz-scrim edith-premium" />
        <Dialog.Content className="uz-sheet edith-premium" dir="rtl" aria-describedby={undefined}>
          {lesson && (
            <>
              <Dialog.Close asChild>
                <button type="button" className="uz-icon-btn uz-sheet-close" aria-label="إغلاق">
                  <X size={16} />
                </button>
              </Dialog.Close>
              <p className="text-[12.5px] font-semibold tabular-nums text-[var(--pp-muted)]">
                الدرس {String(lesson.lesson_no).padStart(2, "0")} ·{" "}
                {pagesLabel(lesson.source_from_page, lesson.source_to_page)}
              </p>
              <Dialog.Title className="uz-sheet-title">
                <BidiText text={lesson.title_ar || lesson.title} />
              </Dialog.Title>
              {lesson.title_ar && (
                <p className="truncate text-[14px] text-[var(--pp-muted)]">
                  <bdi dir="ltr">{lesson.title}</bdi>
                </p>
              )}

              <div className="uz-stage" aria-hidden="true">
                <div className="uz-page uz-page-back">
                  <b>Practice</b>
                  <i />
                  <i style={{ width: "70%" }} />
                  <i />
                </div>
                <div className="uz-page">
                  <b dir="ltr">{lesson.title}</b>
                  <i />
                  <i style={{ width: "76%" }} />
                  <span className="uz-page-table">
                    <i />
                    <i />
                    <i />
                  </span>
                  <i />
                  <i style={{ width: "64%" }} />
                </div>
              </div>

              <ul className="uz-checks" aria-label="شو جاهز">
                <CheckItem ok label="الشرح" />
                <CheckItem
                  ok={facts.exercises !== "none" && facts.exerciseProblems === 0}
                  label={
                    facts.exercises === "none"
                      ? "بدون تمارين"
                      : facts.exerciseProblems
                        ? "التمارين فيها مشكلة"
                        : "التمارين"
                  }
                />
                <CheckItem ok={facts.linked} label={facts.linked ? "الدليل مفحوص" : "بدون دليل"} />
              </ul>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {working ? (
                  <p role="status" className="uz-btn uz-btn-soft uz-btn-lg flex-1 cursor-default">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    بينعمل هلأ…
                  </p>
                ) : unfinished ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onFinish}
                    className="uz-btn uz-btn-accent uz-btn-lg flex-1"
                  >
                    <Sparkles size={16} aria-hidden="true" />
                    كمّل الدرس
                  </button>
                ) : published ? (
                  <p className="uz-btn uz-btn-lg flex-1 cursor-default bg-[#e6f5ec] text-[#16794a]">
                    <Check size={16} aria-hidden="true" />
                    منشور للطلاب
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={onPublish}
                    className="uz-btn uz-btn-accent uz-btn-lg flex-1"
                  >
                    {publishing && (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    )}
                    انشر للطلاب
                  </button>
                )}
                <Link
                  to={facts.linked ? "/rita-study" : "/rita-live"}
                  search={{ lesson: lesson.id, preview: true }}
                  target="_blank"
                  className="uz-btn uz-btn-soft uz-btn-lg"
                >
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  جرّب كطالب
                </Link>
              </div>
              {!facts.linked && !working && (
                <p className="mt-2 text-[13px] text-[var(--pp-muted)]">
                  بدون دليل بيفتح الدرس للطلاب بالشكل القديم. «كمّل الدرس» بيعمل الدليل ويربطه.
                </p>
              )}

              <div className="mt-7">
                <p className="mb-1 text-[12.5px] font-semibold text-[var(--pp-muted)]">تعديل</p>
                <EditRow
                  icon={<Target size={15} />}
                  label="الأهداف والشرح"
                  onClick={() => onEdit("plan")}
                />
                <EditRow
                  icon={<ListChecks size={15} />}
                  label="التمارين"
                  value={
                    facts.exercises === "none"
                      ? "ما في"
                      : facts.exercises === "published"
                        ? "منشورة"
                        : "مسودة"
                  }
                  onClick={() => onEdit("exercises")}
                />
                <EditRow
                  icon={<FileText size={15} />}
                  label="دليل PDF"
                  value={facts.linked ? "مربوط" : "ما في"}
                  onClick={() => onEdit("study")}
                />
                <EditRow
                  icon={<Paperclip size={15} />}
                  label="مراجع وسلايدات"
                  value="اختياري"
                  onClick={() => onEdit("resources")}
                />
              </div>

              {published && (
                <button
                  type="button"
                  disabled={busy || publishing}
                  onClick={onUnpublish}
                  className="mt-4 text-[13.5px] font-semibold text-[var(--pp-muted)] underline-offset-4 hover:text-[var(--pp-ink)] hover:underline"
                >
                  إلغاء نشر الدرس
                </button>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li data-ok={ok}>
      {ok ? (
        <Check size={14} strokeWidth={2.6} aria-hidden="true" />
      ) : (
        <X size={14} aria-hidden="true" />
      )}
      {label}
    </li>
  );
}

function EditRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="uz-edit-row">
      <span className="uz-edit-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1 text-start">{label}</span>
      {value && <span className="text-[12.5px] font-normal text-[var(--pp-muted)]">{value}</span>}
      <ChevronLeft size={15} className="text-[var(--pp-muted)]" aria-hidden="true" />
    </button>
  );
}
