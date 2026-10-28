import { Check, Loader2, Sparkles, Square } from "lucide-react";
import {
  ACTION_TEXT,
  STEP_TEXT,
  ROW_STATUS_TEXT,
  rowAction,
  type BookRow,
  type RowStatus,
  type RunState,
  type pipelineView,
} from "@/lib/study/lesson-maker";
import { pagesLabel } from "./book-utils";
import { BidiText } from "./BookBits";

export type ListRow = {
  row: BookRow;
  status: RowStatus;
  run?: RunState;
  pipeline: ReturnType<typeof pipelineView>;
  /** A short second line: pages, exercises, guide. */
  note: string;
};

/** The thin bar under the book's title: one segment per lesson. */
export function BookMeter({
  segments,
  label,
}: {
  segments: ("published" | "ready" | "working" | "left")[];
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {segments.length > 0 && (
        <span className="uz-meter" aria-hidden="true">
          {segments.map((segment, index) => (
            <i key={index} data-state={segment} />
          ))}
        </span>
      )}
      <span className="text-[13.5px] tabular-nums text-[var(--pp-muted)]">{label}</span>
    </div>
  );
}

/** The dark card at the top: the one button that makes (or publishes) everything left. */
export function BookHero({
  title,
  text,
  action,
  busy,
  onAction,
  onStop,
}: {
  title: string;
  text: string;
  action: string;
  busy: boolean;
  onAction: () => void;
  onStop?: () => void;
}) {
  return (
    <section className="uz-hero" aria-label={title}>
      <span className="uz-orb-mini" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-bold leading-snug">{title}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">{text}</p>
      </div>
      {busy && onStop ? (
        <button type="button" onClick={onStop} className="uz-btn uz-btn-glass">
          <Square size={12} fill="currentColor" aria-hidden="true" />
          وقّف بعد الدرس الحالي
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={onAction} className="uz-btn uz-btn-white">
          {busy ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={15} className="text-[var(--pp-accent)]" aria-hidden="true" />
          )}
          {action}
        </button>
      )}
    </section>
  );
}

/** Every lesson of the book, made or suggested, with one word for its state and one button. */
export function BookList({
  rows,
  busy,
  publishing,
  onAction,
  onOpen,
}: {
  rows: ListRow[];
  busy: boolean;
  publishing: string;
  onAction: (item: ListRow) => void;
  onOpen: (item: ListRow) => void;
}) {
  return (
    <section className="uz-list" aria-label="الدروس">
      <div className="uz-list-head">
        <span>الدروس</span>
        <span>الحالة</span>
      </div>
      <ul>
        {rows.map((item) => (
          <Row
            key={item.row.key}
            item={item}
            busy={busy}
            publishing={publishing === item.row.lessonId}
            onAction={() => onAction(item)}
            onOpen={() => onOpen(item)}
          />
        ))}
      </ul>
    </section>
  );
}

function Row({
  item,
  busy,
  publishing,
  onAction,
  onOpen,
}: {
  item: ListRow;
  busy: boolean;
  publishing: boolean;
  onAction: () => void;
  onOpen: () => void;
}) {
  const { row, status, run } = item;
  const action = rowAction(status);
  const showPipeline = status === "working" || status === "failed" || status === "queued";
  const failed = run?.state === "failed" ? run : null;
  const canOpen = Boolean(row.lessonId);
  const body = (
    <>
      <span className="uz-ix" aria-hidden="true">
        {row.no ? String(row.no).padStart(2, "0") : "·"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="uz-row-title">
          <BidiText text={row.title} />
        </span>
        {showPipeline ? (
          <Pipeline steps={item.pipeline} />
        ) : (
          <span className="uz-row-sub">{item.note || pagesLabel(row.from, row.to)}</span>
        )}
        {failed && (
          <span className="mt-1.5 block text-[13px] leading-relaxed text-[#a3471a]">
            وقف عند «{STEP_TEXT[failed.step].label}»: {failed.message} الشغل يلي قبله محفوظ.
            {failed.detail && (
              <span
                className="mt-0.5 block break-words text-[12px] text-[var(--pp-muted)]"
                dir="ltr"
              >
                {failed.detail}
              </span>
            )}
          </span>
        )}
      </span>
    </>
  );
  return (
    <li className="uz-row" data-status={status}>
      {canOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="uz-row-main"
          aria-label={`افتح ${row.title}`}
        >
          {body}
        </button>
      ) : (
        <div className="uz-row-main">{body}</div>
      )}
      <span className="uz-status" data-status={status}>
        <i aria-hidden="true" />
        {ROW_STATUS_TEXT[status]}
      </span>
      <span className="uz-row-action">
        {action && (
          <button
            type="button"
            disabled={(busy && action !== "open") || publishing}
            onClick={onAction}
            className={`uz-btn ${action === "publish" ? "uz-btn-accent" : action === "open" ? "uz-btn-quiet" : "uz-btn-soft"}`}
          >
            {publishing ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : action === "make" ? (
              <Sparkles size={13} className="text-[var(--pp-accent)]" aria-hidden="true" />
            ) : null}
            {ACTION_TEXT[action]}
          </button>
        )}
      </span>
    </li>
  );
}

function Pipeline({ steps }: { steps: ListRow["pipeline"] }) {
  const now = steps.find((step) => step.state === "now");
  return (
    <span className="uz-pipe" role="status">
      {steps.map((step, index) => (
        <span key={step.step} className="contents">
          {index > 0 && (
            <i className="uz-pipe-line" data-done={step.state === "done" || step.state === "now"} />
          )}
          <span className="uz-pipe-step" data-state={step.state}>
            <i aria-hidden="true">{step.state === "done" && <Check size={9} strokeWidth={3} />}</i>
            {step.state === "now" && now ? STEP_TEXT[step.step].doing : STEP_TEXT[step.step].label}
          </span>
        </span>
      ))}
    </span>
  );
}
