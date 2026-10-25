import type React from "react";
import { Check } from "lucide-react";
import {
  BOOK_STEPS,
  READINESS_LABEL,
  STEP_LABEL,
  type BookStep,
  type LessonReadiness,
} from "@/lib/rita-book-flow";

export function KindBadge({ kind }: { kind: "grammar" | "vocabulary" }) {
  return (
    <span className="rounded-full border border-[var(--pp-line)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--pp-muted)]">
      {kind === "vocabulary" ? "كلمات" : "قواعد"}
    </span>
  );
}

/** Four small steps under a book: read, lessons, review, publish. */
export function StepDots({
  done,
  current,
}: {
  done: Record<BookStep, boolean>;
  current: BookStep;
}) {
  return (
    <ol className="rita-stepper" aria-label="مراحل الكتاب">
      {BOOK_STEPS.map((step) => (
        <li
          key={step}
          className="rita-step"
          data-done={done[step]}
          aria-current={step === current && !done[step] ? "step" : undefined}
        >
          <span className="inline-flex items-center gap-1">
            {done[step] && <Check size={13} aria-hidden="true" />}
            {STEP_LABEL[step]}
          </span>
        </li>
      ))}
    </ol>
  );
}

const READINESS_STYLE: Record<LessonReadiness, string> = {
  published: "bg-[var(--pp-ink)] text-white",
  ready: "bg-[#e6f4ea] text-[#1d6b3a]",
  warnings: "bg-[#fff6e5] text-[#8a5200]",
  problems: "bg-[#fbe9ed] text-[#8c1a31]",
  no_exercises: "bg-[var(--pp-grey)] text-[var(--pp-muted)]",
  archived: "bg-[var(--pp-grey)] text-[var(--pp-muted)]",
};

export function ReadinessChip({ state, count }: { state: LessonReadiness; count?: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${READINESS_STYLE[state]}`}
    >
      {READINESS_LABEL[state]}
      {count ? ` (${count})` : ""}
    </span>
  );
}

/** A failure that stays on screen until closed (a toast vanishes before it can be read). */
export function ErrorBox({
  hint,
  raw,
  onClose,
}: {
  hint: string;
  raw?: string;
  onClose?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#e0a2a2] bg-[#fbeeee] p-3 text-[15px] text-[#7a1f1f]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{hint}</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[13px] font-semibold underline"
          >
            إغلاق
          </button>
        )}
      </div>
      {raw && (
        <p className="mt-1 break-words text-[12.5px]" dir="ltr">
          {raw}
        </p>
      )}
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.round((Math.min(value, max) / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-2.5 overflow-hidden rounded-full bg-[var(--pp-grey)]"
    >
      <div
        className="h-full rounded-full bg-[var(--pp-accent)] transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// A run of Latin-script words with the punctuation that belongs to it ("Is he…?", "isn't / aren't").
const LATIN_RUN = /[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ0-9'’…?!.,/ -]*[A-Za-zÀ-ɏ0-9'’…?!.]|[A-Za-zÀ-ɏ]/g;

/**
 * An Arabic title with English inside it ("السؤال: Is he…? Are you…?"), kept in reading order:
 * each English run is isolated so its punctuation stays with it instead of jumping to the end.
 */
export function BidiText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LATIN_RUN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push(
      <bdi key={index} dir="ltr">
        {match[0]}
      </bdi>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
