import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gauge, Infinity as InfinityIcon } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";

type Line = { label: string; used: number; limit: number | null; tint: string };

/**
 * "Credits" pill in the top bar: what the student has left this month on each
 * metered tool, straight from the plan the admin configured.
 */
export function CreditsMeter({ compact, dark }: { compact?: boolean; dark?: boolean }) {
  const plan = usePlan();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const data = plan.data;
  if (!data) return null;

  const p = data.plan as Record<string, any> | undefined;
  const grants = (data.grants ?? {}) as Record<string, number>;
  const cap = (column: string, kind: string) => {
    const base = p?.[column];
    if (base === null || base === undefined) return null;
    return Number(base) + Number(grants[kind] ?? 0);
  };

  const lines: Line[] = [
    { label: "Flashcards", used: data.usage.flashcards, limit: cap("max_flashcards", "flashcards"), tint: "#4c9a2a" },
    { label: "AI questions", used: data.usage.ai_questions, limit: cap("max_ai_questions", "ai_questions"), tint: "#6aa9d8" },
    { label: "PDF summaries", used: data.usage.summaries, limit: cap("max_summaries", "summaries"), tint: "#f0a95c" },
    { label: "To-do tasks", used: data.usage.todo_tasks, limit: cap("max_todo_tasks", "todo_tasks"), tint: "#b58cd8" },
    { label: "Calendar entries", used: data.usage.calendar_items, limit: cap("max_calendar_items", "calendar_items"), tint: "#7fc4b4" },
    { label: "Classrooms", used: data.usage.groups, limit: cap("max_groups", "groups"), tint: "#e0806a" },
  ];

  const offerName = (data as any).offer_name as string | null | undefined;
  const offerEnds = (data as any).offer_expires_at as string | null | undefined;
  const daysLeft = offerEnds
    ? Math.max(0, Math.ceil((new Date(offerEnds).getTime() - Date.now()) / 86_400_000))
    : null;

  const first = lines.find((l) => l.limit !== null);
  const short =
    plan.isAdmin || !first
      ? "Unlimited"
      : `${Math.max(0, (first.limit ?? 0) - first.used).toLocaleString()} left`;

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-open={open ? "true" : "false"}
        className={
          dark
            ? `rita-ghost font-semibold text-white/90 ${compact ? "text-[13px]" : "text-[14px]"}`
            : `inline-flex items-center gap-2 rounded-full border border-black/10 bg-white font-extrabold text-[#3c372f] transition-colors hover:bg-black/[0.03] ${
                compact ? "px-3 py-1.5 text-[12.5px]" : "px-3.5 py-2 text-[13.5px]"
              }`
        }
      >
        <Gauge size={15} className="rita-accent" />
        Credits
        <span className={dark ? "text-white/60" : "text-[#a29a8d]"}>· {short}</span>
      </button>

      {open && (
        <div className="rita-panel absolute right-0 z-50 mt-2 w-[19rem] rounded-2xl border border-black/[0.07] p-4 shadow-[0_30px_60px_-40px_rgba(35,32,29,0.9)]">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
            Right now
          </p>
          <p className="mt-1 text-[16px] font-black">{plan.planName} plan</p>


          {offerName && (
            <div className="mt-2 rounded-xl bg-[#fdeceb] px-3 py-2">
              <p className="text-[12.5px] font-black text-[#b3261e]">{offerName} is active</p>
              {daysLeft !== null && (
                <p className="text-[11.5px] font-bold text-[#b3261e]/75">
                  {daysLeft} {daysLeft === 1 ? "day" : "days"} left on this offer
                </p>
              )}
            </div>
          )}


          <div className="mt-3 space-y-3">
            {lines.map((l) => {
              const unlimited = plan.isAdmin || l.limit === null;
              const limit = l.limit ?? 0;
              const left = Math.max(0, limit - l.used);
              const pct = unlimited ? 0 : Math.min(100, limit === 0 ? 100 : (l.used / limit) * 100);
              return (
                <div key={l.label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13.5px] font-extrabold text-[#3c372f]">{l.label}</span>
                    {unlimited ? (
                      <span className="rita-accent inline-flex items-center gap-1 text-[12.5px] font-black">
                        <InfinityIcon size={13} /> Unlimited
                      </span>
                    ) : (
                      <span className="text-[12.5px] font-black tabular-nums text-[#8a7f6c]">
                        {left.toLocaleString()} of {limit.toLocaleString()} left
                      </span>
                    )}
                  </div>
                  {!unlimited && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f1eee8]">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{ width: `${pct}%`, background: l.tint }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Link
            to="/pricing"
            onClick={() => setOpen(false)}
            className="mt-4 flex h-10 items-center justify-center rounded-full bg-[#4c9a2a] text-[13.5px] font-black text-white"
          >
            See plans
          </Link>
        </div>
      )}
    </div>
  );
}
