import { useCallback, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Infinity as InfinityIcon } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { useDismiss } from "@/components/header/useDismiss";

type Line = { label: string; used: number; limit: number | null };
type Level = "ok" | "low" | "out";

const LOW_BELOW = 0.2;

function levelOf(limit: number | null, used: number): Level {
  if (limit === null) return "ok";
  const left = Math.max(0, limit - used);
  if (left === 0) return "out";
  return left / limit < LOW_BELOW ? "low" : "ok";
}

/**
 * "Credits" chip in the top bar: Rita's small orb and what the student has left this month,
 * straight from the plan the admin configured. The details open as a white card with an ink
 * border (the same card as the home page). `inline` shows the card in the flow (phone menu).
 */
export function CreditsMeter({
  open: controlled,
  onOpenChange,
  inline,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  inline?: boolean;
}) {
  const plan = usePlan();
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const setOpen = useCallback(
    (next: boolean) => (onOpenChange ? onOpenChange(next) : setOwn(next)),
    [onOpenChange],
  );
  const box = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useDismiss(open && !inline, () => setOpen(false), box);

  const data = plan.data;
  if (!data) return null;

  const p = data.plan as unknown as Record<string, number | null | undefined> | undefined;
  const grants = (data.grants ?? {}) as Record<string, number>;
  const cap = (column: string, kind: string) => {
    const base = p?.[column];
    if (base === null || base === undefined) return null;
    return Number(base) + Number(grants[kind] ?? 0);
  };

  const lines: Line[] = [
    {
      label: "Flashcards",
      used: data.usage.flashcards,
      limit: cap("max_flashcards", "flashcards"),
    },
    {
      label: "AI questions",
      used: data.usage.ai_questions,
      limit: cap("max_ai_questions", "ai_questions"),
    },
    {
      label: "PDF summaries",
      used: data.usage.summaries,
      limit: cap("max_summaries", "summaries"),
    },
    {
      label: "To-do tasks",
      used: data.usage.todo_tasks,
      limit: cap("max_todo_tasks", "todo_tasks"),
    },
    {
      label: "Calendar entries",
      used: data.usage.calendar_items,
      limit: cap("max_calendar_items", "calendar_items"),
    },
    { label: "Classrooms", used: data.usage.groups, limit: cap("max_groups", "groups") },
  ];

  const offer = data as { offer_name?: string | null; offer_expires_at?: string | null };
  const offerName = offer.offer_name;
  const offerEnds = offer.offer_expires_at;
  const daysLeft = offerEnds
    ? Math.max(0, Math.ceil((new Date(offerEnds).getTime() - Date.now()) / 86_400_000))
    : null;

  const metered = lines.filter((l) => l.limit !== null);
  const unlimitedAll = plan.isAdmin || metered.length === 0;
  // The chip shows the tool that is closest to running out.
  const tightest = unlimitedAll
    ? null
    : metered.reduce((a, b) =>
        (a.limit! - a.used) / Math.max(a.limit!, 1) <= (b.limit! - b.used) / Math.max(b.limit!, 1)
          ? a
          : b,
      );
  const level: Level = tightest ? levelOf(tightest.limit, tightest.used) : "ok";
  const short = !tightest
    ? "Unlimited"
    : level === "out"
      ? "Used up"
      : `${Math.max(0, tightest.limit! - tightest.used).toLocaleString()} left`;

  const card = (
    <div
      id={panelId}
      className={`rh-card rh-credits ${inline ? "rh-card-inline" : ""}`}
      aria-label="Your credits"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="rh-card-title">{plan.planName} plan</p>
        {unlimitedAll && <span className="rh-badge">All tools open</span>}
      </div>

      {offerName && (
        <div className="rh-offer">
          <p className="font-bold">{offerName} is active</p>
          {daysLeft !== null && (
            <p>
              {daysLeft} {daysLeft === 1 ? "day" : "days"} left on this offer
            </p>
          )}
        </div>
      )}

      {unlimitedAll ? (
        <p className="rh-note">
          Flashcards, AI questions, PDF summaries, tasks, calendar and classrooms have no limit on
          this account.
        </p>
      ) : (
        <ul className="rh-meters">
          {lines.map((l) => {
            const unlimited = l.limit === null;
            const limit = l.limit ?? 0;
            const left = Math.max(0, limit - l.used);
            const lvl = levelOf(l.limit, l.used);
            const pct =
              unlimited || limit === 0 ? 0 : Math.max(0, Math.min(100, (left / limit) * 100));
            return (
              <li key={l.label}>
                <div className="rh-meter-row">
                  <span>{l.label}</span>
                  {unlimited ? (
                    <span className="rh-meter-val">
                      <InfinityIcon size={14} aria-hidden="true" /> Unlimited
                    </span>
                  ) : (
                    <span className="rh-meter-val" data-level={lvl}>
                      {lvl === "out"
                        ? "Used up"
                        : `${left.toLocaleString()} of ${limit.toLocaleString()} left`}
                    </span>
                  )}
                </div>
                {!unlimited && (
                  <div
                    className="rh-track"
                    role="progressbar"
                    aria-label={l.label}
                    aria-valuemin={0}
                    aria-valuemax={limit}
                    aria-valuenow={Math.min(l.used, limit)}
                  >
                    <div className="rh-fill" data-level={lvl} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Link to="/pricing" onClick={() => setOpen(false)} className="rh-btn rh-wide">
        See plans
      </Link>
    </div>
  );

  if (inline) {
    return (
      <div ref={box}>
        <button
          type="button"
          data-rh-trigger
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
          className="rh-item"
        >
          <span className="rh-orb" data-level={level} aria-hidden="true" />
          Credits <span className="rh-item-dim">· {short}</span>
        </button>
        {open && card}
      </div>
    );
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        data-rh-trigger
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        data-open={open ? "true" : "false"}
        className="rh-credits-chip"
      >
        <span className="rh-orb" data-level={level} aria-hidden="true" />
        <span>Credits</span>
        <span className="rh-chip-val" data-level={level}>
          {short}
        </span>
      </button>
      {open && card}
    </div>
  );
}
