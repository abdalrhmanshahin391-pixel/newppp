import { Link } from "@tanstack/react-router";
import { LineChart, Sparkles, Target } from "lucide-react";
import { useStudyOverview, useReviewQueue, type QueueItem } from "@/lib/use-review";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { setStudyPrefs } from "@/lib/review.functions";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const RETENTION_CHOICES = [
  { value: 0.85, label: "Relaxed", hint: "fewer reviews, a bit more forgetting" },
  { value: 0.9, label: "Balanced", hint: "the sweet spot most people want" },
  { value: 0.95, label: "Exam-tight", hint: "more reviews, almost nothing slips" },
] as const;

/**
 * Due today, the daily goal, what is coming this month and how much you are
 * actually holding on to — the reason to open Rita every morning.
 */
export function DailyPanel({
  onReview,
  showReview = true,
}: {
  onReview: (items: QueueItem[]) => void;
  /** Hide the button when the page already offers the same review above. */
  showReview?: boolean;
}) {
  const { user } = useAuth();
  const { data } = useStudyOverview();
  const { queue, dueCount, newToday, isLoading } = useReviewQueue();
  const savePrefs = useServerFn(setStudyPrefs);
  const qc = useQueryClient();
  const [openSettings, setOpenSettings] = useState(false);

  if (!user) return null;

  const goal = data?.goal ?? 20;
  const today = data?.today.cards ?? 0;
  const pct = Math.min(100, Math.round((today / Math.max(1, goal)) * 100));
  const left = Math.max(0, goal - today);
  const due = queue.length || dueCount;
  const forecast = data?.forecast ?? [];
  const peak = Math.max(1, ...forecast.map((f) => f.cards));
  const retention = data?.retention;
  const current = data?.prefs.retention ?? 0.9;

  return (
    <section className="rounded-[20px] bg-[#f4f4f8] p-5">
      <p className="text-[14px] font-semibold text-[#6a697c]">Today</p>

      <p className="mt-2 font-display text-[2.8rem] font-bold leading-none tracking-[-0.03em] text-[#121117]">
        {due}
      </p>
      <p className="text-[15px] font-medium text-[#6a697c]">
        cards due right now{newToday > 0 && ` · ${newToday} new mixed in`}
      </p>

      {showReview && (
        <button
          type="button"
          disabled={isLoading || due === 0}
          onClick={() => onReview(queue)}
          className="mt-4 inline-flex h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-lg border-2 border-[#121117] bg-white text-[15px] font-semibold text-[#121117] transition-colors duration-150 hover:bg-[#e7eefd] active:scale-[0.98] disabled:opacity-50"
        >
          <Sparkles size={16} />
          {due === 0 ? "Nothing due — nice" : "Review everything due"}
        </button>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between text-[14px] font-semibold text-[#4b4a5c]">
          <span>Daily goal</span>
          <span>
            {today}/{goal}
          </span>
        </div>
        <div
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white"
          style={{ border: "1.5px solid #121117" }}
        >
          <div
            className="h-full rounded-full bg-[var(--rita-green)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[13.5px] font-medium text-[#4b4a5c]">
          {left === 0
            ? "Goal met today — nice work."
            : `${left} more card${left === 1 ? "" : "s"} to hit today's goal.`}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        {(data?.week ?? []).map((d) => (
          <span
            key={d.day}
            title={`${d.day}: ${d.cards} cards`}
            className="h-2 flex-1 rounded-full"
            style={{ background: d.goal_met ? "var(--rita-green)" : "#dcdce5" }}
          />
        ))}
      </div>

      {/* What's coming — the forecast that makes the schedule visible */}
      {forecast.length > 0 && (
        <div className="mt-5">
          <p className="text-[14px] font-semibold text-[#4b4a5c]">Next 30 days</p>
          <div className="mt-2 flex h-14 items-end gap-[3px]">
            {forecast.map((f) => (
              <span
                key={f.day}
                title={`${f.day}: ${f.cards} cards`}
                className="flex-1 rounded-t-[3px] bg-[#2b6df0]"
                style={{ height: `${Math.max(3, (f.cards / peak) * 100)}%` }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[13.5px] font-medium text-[#4b4a5c]">
            Busiest day ahead: {peak} card{peak === 1 ? "" : "s"}.
          </p>
        </div>
      )}

      {/* True retention */}
      {retention && retention.total >= 5 && (
        <div className="mt-4 rounded-xl bg-white p-3">
          <p className="font-display text-[1.7rem] font-bold leading-none text-[#121117]">
            {retention.percent}%
          </p>
          <p className="text-[13.5px] font-medium text-[#4b4a5c]">
            of the cards that had gone to sleep came back this month.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpenSettings((v) => !v)}
        className="mt-4 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-[#121117] hover:underline"
      >
        <Target size={15} /> How tight should the schedule be?
      </button>

      {openSettings && (
        <div className="mt-2 grid gap-1.5">
          {RETENTION_CHOICES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={async () => {
                await savePrefs({ data: { retention: r.value } });
                void qc.invalidateQueries({ queryKey: ["study-overview"] });
                void qc.invalidateQueries({ queryKey: ["review-sync"] });
              }}
              className="min-h-12 touch-manipulation rounded-xl px-3 py-2 text-left transition-colors"
              style={{
                background: Math.abs(current - r.value) < 0.001 ? "#e7eefd" : "#ffffff",
              }}
            >
              <span className="block text-[14px] font-bold text-[#121117]">{r.label}</span>
              <span className="block text-[13px] font-medium text-[#6a697c]">{r.hint}</span>
            </button>
          ))}
        </div>
      )}

      <Link
        to="/study/progress"
        className="mt-4 inline-flex items-center gap-2 text-[15px] font-semibold text-[#121117] underline underline-offset-4"
      >
        <LineChart size={15} /> See my progress
      </Link>
    </section>
  );
}
