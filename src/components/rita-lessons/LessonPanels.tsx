import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Star,
  Video,
  X,
} from "lucide-react";
import { KIND_LABEL_AR, formatBytes, type ResourceKind } from "@/lib/rita-resources";
import type { ObjectiveState } from "@/lib/rita-curriculum";
import type { LessonSession } from "@/lib/rita-curriculum.functions";
import { LessonImage, LessonStars } from "./LessonArt";

/** The lesson's goals, ticked off as the learner shows each one. */
export function LessonObjectivesPanel({
  session,
  objectives,
  score,
  checking,
  justMet,
}: {
  session: LessonSession;
  objectives: ObjectiveState;
  score: number;
  checking: boolean;
  justMet: string[];
}) {
  const goals = session.lesson.objectives;
  const met = goals.filter((goal) => objectives[goal.id]?.met).length;
  return (
    <section dir="rtl" className="rounded-2xl bg-[var(--pp-grey)] p-4">
      <div className="flex items-center gap-3">
        <LessonImage
          src={session.lesson.image_url}
          alt=""
          className="h-14 w-14 shrink-0 border-2 border-white shadow"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--pp-accent-text)]">درس اليوم</p>
          <h2 className="truncate text-lg font-bold">
            {session.lesson.title || session.lesson.title_ar}
          </h2>
          <p className="truncate text-xs font-semibold text-[var(--pp-muted)]" dir="ltr">
            {session.lesson.title}
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[var(--pp-ink)]">
            {met}/{goals.length}
          </p>
          <p className="text-[10px] font-bold text-[var(--pp-muted)]">أهداف</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--pp-line)]">
        <div
          className="h-full rounded-full bg-[var(--pp-accent)] transition-all duration-500"
          style={{ width: `${goals.length ? (met / goals.length) * 100 : 0}%` }}
        />
      </div>
      <ul className="mt-3 space-y-2">
        {goals.map((goal) => {
          const done = objectives[goal.id]?.met === true;
          const fresh = justMet.includes(goal.id);
          return (
            <li
              key={goal.id}
              className={`flex items-start gap-2 rounded-2xl px-3 py-2 text-sm transition-colors ${
                done ? "bg-[var(--pp-accent-soft)]" : "bg-white"
              } ${fresh ? "ring-2 ring-[var(--pp-ink)]" : ""}`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                  done ? "bg-[var(--pp-ink)] text-white" : "border-2 border-[#cfcfdb]"
                }`}
              >
                {done && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{goal.text_ar || goal.text}</span>
                {goal.text_ar && (
                  <span className="block text-xs text-[var(--pp-muted)]" dir="ltr">
                    {goal.text}
                  </span>
                )}
                {done && objectives[goal.id]?.evidence && (
                  <span
                    className="mt-0.5 block text-xs italic text-[var(--pp-accent-text)]"
                    dir="ltr"
                  >
                    “{objectives[goal.id].evidence}”
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[var(--pp-muted)]">
        {checking && <Loader2 size={12} className="animate-spin" />}
        {checking ? "ريتا تراجع إجابتك…" : `النتيجة حتى الآن: ${score}%`}
      </p>
    </section>
  );
}

/**
 * Shown when every objective is met: score, stars and the way forward. It can be closed (the cross,
 * Esc, a tap outside, or "review the conversation") so the learner can read the whole call again;
 * LessonResultChip brings it back.
 */
export function LessonResultCard({
  score,
  stars,
  nextLessonId,
  onRetry,
  onClose,
}: {
  score: number;
  stars: number;
  nextLessonId: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const praise =
    stars === 3 ? "ممتاز!" : stars === 2 ? "عمل رائع!" : stars === 1 ? "أحسنت!" : "أكملت الدرس!";
  const closeRef = useRef<HTMLButtonElement>(null);
  // The latest onClose without re-running the effect: the parent passes a new function each render,
  // and focus must move to the cross once, when the card opens.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div
      className="edith-premium fixed inset-0 z-50 grid place-items-center bg-[#121117]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-result-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        dir="rtl"
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute start-3 top-3 grid h-10 w-10 place-items-center rounded-full text-[var(--pp-muted)] transition-colors hover:bg-[var(--pp-grey)]"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <LessonStars stars={stars} size={44} />
        <h2 id="lesson-result-title" className="mt-3 text-3xl font-bold text-[var(--pp-ink)]">
          {praise}
        </h2>
        <p className="mt-1 font-bold text-[var(--pp-muted)]">حققت كل أهداف الدرس</p>
        <p className="mt-4 text-5xl font-bold text-[var(--pp-ink)]">{score}%</p>
        <div className="mt-6 space-y-2">
          {nextLessonId ? (
            <Link
              to="/rita-live"
              search={{ lesson: nextLessonId }}
              className="rita-btn rita-btn-primary !flex !w-full !self-stretch"
              onClick={onClose}
            >
              الدرس التالي
            </Link>
          ) : (
            <p className="rounded-2xl bg-[var(--pp-grey)] py-3 text-sm font-bold text-[var(--pp-accent-text)]">
              أنهيت كل الدروس المتاحة 🎉
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rita-btn rita-btn-secondary !flex !w-full !items-center !justify-center !gap-2 !self-stretch"
          >
            <MessageSquareText size={16} aria-hidden="true" /> راجع المحادثة
          </button>
          <Link
            to="/rita-lessons"
            className="rita-btn rita-btn-quiet !flex !w-full !self-stretch"
            onClick={onClose}
          >
            العودة إلى المسار
          </Link>
          <button
            type="button"
            onClick={onRetry}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-bold text-[var(--pp-muted)]"
          >
            <RotateCcw size={14} /> أعد الدرس لتحسين نتيجتك
          </button>
        </div>
      </section>
    </div>
  );
}

/** A small bar that reopens the result after it was closed to review the conversation. */
export function LessonResultChip({
  score,
  stars,
  onOpen,
}: {
  score: number;
  stars: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      dir="rtl"
      className="flex w-full items-center gap-2 rounded-2xl bg-[var(--pp-accent-soft)] px-4 py-3 text-start text-[15px] font-bold text-[var(--pp-accent-text)]"
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: Math.max(1, stars) }, (_, index) => (
          <Star key={index} size={15} fill="currentColor" />
        ))}
      </span>
      <span className="me-auto">أنهيت الدرس · {score}%</span>
      <span className="underline">عرض النتيجة</span>
    </button>
  );
}

const RESOURCE_ICON: Record<ResourceKind, typeof FileText> = {
  pdf: FileText,
  link: Link2,
  video: Video,
};

/** Study material the teacher attached to the lesson. Optional: the lesson never waits for it. */
export function LessonResourcesPanel({ session }: { session: LessonSession }) {
  const resources = session.resources ?? [];
  if (resources.length === 0) return null;
  return (
    <section
      dir="rtl"
      aria-labelledby="lesson-resources-heading"
      className="rounded-2xl bg-[var(--pp-grey)] p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="lesson-resources-heading" className="text-base font-bold">
          مراجع الدرس
        </h2>
        <p className="text-xs font-semibold text-[var(--pp-muted)]">
          اختيارية — تفتح في صفحة جديدة
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {resources.map((resource) => {
          const Icon = RESOURCE_ICON[resource.kind];
          const meta =
            resource.kind === "pdf" && resource.size
              ? `${KIND_LABEL_AR.pdf} · ${formatBytes(resource.size)}`
              : `${KIND_LABEL_AR[resource.kind]}${resource.host ? ` · ${resource.host}` : ""}`;
          return (
            <li key={resource.id}>
              <a
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[56px] items-center gap-3 rounded-2xl border-2 border-[var(--pp-ink)] bg-white px-3 py-2.5 text-[var(--pp-ink)] hover:bg-[var(--pp-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pp-ink)]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-[var(--pp-ink)] bg-white">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block [overflow-wrap:anywhere] text-[15px] font-bold leading-snug">
                    {resource.title}
                  </span>
                  {resource.note && (
                    <span className="mt-0.5 block [overflow-wrap:anywhere] text-[13px] text-[var(--pp-muted)]">
                      {resource.note}
                    </span>
                  )}
                  <span
                    className="mt-0.5 block text-xs font-semibold text-[var(--pp-muted)]"
                    dir="auto"
                  >
                    {meta}
                  </span>
                </span>
                <ExternalLink size={16} aria-hidden="true" className="shrink-0" />
                <span className="sr-only">(يفتح في تبويب جديد)</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
