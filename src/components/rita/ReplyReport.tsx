import { useId, useRef, useState } from "react";
import { Check, Flag, Loader2 } from "lucide-react";
import { ISSUE_CATEGORIES, ISSUE_NOTE_LIMIT, type IssueCategory } from "@/lib/rita-issue-report";

type State = "closed" | "open" | "sending" | "error" | "sent";

/**
 * "Report a problem" under one of Rita's replies. Quiet until opened; then the seven reasons as a
 * radio group and an optional note, inline under the reply (no window over the conversation). The
 * parent saves the report with the turn record it kept for this reply, so the learner never has to
 * describe what happened or when.
 */
export function ReplyReport({
  onSubmit,
}: {
  onSubmit: (category: IssueCategory, note: string) => Promise<void>;
}) {
  const [state, setState] = useState<State>("closed");
  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [note, setNote] = useState("");
  const groupRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const noteId = useId();
  const busy = state === "sending";

  async function send() {
    if (!category || busy) return;
    setState("sending");
    try {
      await onSubmit(category, note);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !backward) return;
    event.preventDefault();
    const count = ISSUE_CATEGORIES.length;
    const next = ISSUE_CATEGORIES[(index + (forward ? 1 : count - 1)) % count];
    setCategory(next.id);
    window.requestAnimationFrame(() =>
      groupRef.current?.querySelector<HTMLElement>(`[data-value="${next.id}"]`)?.focus(),
    );
  }

  if (state === "sent") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-1 flex min-h-[44px] items-center gap-2 text-[14px] text-[var(--pp-muted)]"
      >
        <Check size={16} aria-hidden="true" />
        Thanks — saved with this reply&apos;s details.
      </p>
    );
  }

  if (state === "closed") {
    return (
      <button
        type="button"
        onClick={() => setState("open")}
        className="mt-1 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-[14px] font-semibold text-[var(--pp-muted)] transition-colors hover:text-[var(--pp-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pp-ink)]"
      >
        <Flag size={15} aria-hidden="true" />
        Report a problem with this reply
      </button>
    );
  }

  const firstFocusable = category ?? ISSUE_CATEGORIES[0].id;

  return (
    <div className="mt-2 max-w-md rounded-2xl bg-[var(--pp-grey)] p-4 text-start">
      <p id={labelId} className="text-[15px] font-semibold text-[var(--pp-ink)]">
        What went wrong with this reply?
      </p>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={labelId}
        className="rita-choice rita-choice-stack mt-3"
      >
        {ISSUE_CATEGORIES.map((option, index) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            data-value={option.id}
            aria-checked={category === option.id}
            tabIndex={firstFocusable === option.id ? 0 : -1}
            disabled={busy}
            onClick={() => setCategory(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label
        htmlFor={noteId}
        className="mt-3 block text-[14px] font-semibold text-[var(--pp-muted)]"
      >
        Anything to add? (optional)
      </label>
      <textarea
        id={noteId}
        dir="auto"
        value={note}
        maxLength={ISSUE_NOTE_LIMIT}
        rows={2}
        disabled={busy}
        onChange={(event) => setNote(event.target.value)}
        className="mt-1 w-full resize-none rounded-lg border border-[var(--pp-line)] bg-white px-3 py-2 text-[16px] leading-6 text-[var(--pp-ink)]"
      />
      {state === "error" && (
        <p role="alert" className="mt-2 text-[14px] font-semibold text-[var(--pp-accent-text)]">
          Could not save the report. Try again.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={send}
          disabled={!category || busy}
          aria-busy={busy}
          className="rita-btn rita-btn-primary rita-btn-sm gap-2 disabled:opacity-60"
        >
          {busy && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
          Send report
        </button>
        <button
          type="button"
          onClick={() => setState("closed")}
          disabled={busy}
          className="rita-btn rita-btn-sm disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
