import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export type BuildStep = {
  key: string;
  label: string;
  /** rough weight — used for the estimate and the bar */
  weight: number;
};

type Props = {
  steps: BuildStep[];
  /** keys of the finished steps, in order */
  done: string[];
  /** key of the step running right now */
  current: string | null;
  /** free-text detail, e.g. "Reading page 4 of 12…" */
  detail?: string;
  /** estimated total seconds for the whole build */
  estimateSeconds: number;
  /** restart the clock whenever this changes */
  runId: number;
};

function clock(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Plain-language estimate from the length of the lecture text. */
export function estimateBuildSeconds(textLength: number, hasPdf: boolean) {
  const base = hasPdf ? 25 : 10;
  const perPass = 18 + Math.min(70, textLength / 900);
  return Math.round(base + perPass * 3);
}

export function BuildProgress({
  steps,
  done,
  current,
  detail,
  estimateSeconds,
  runId,
}: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [runId]);

  const total = steps.reduce((a, s) => a + s.weight, 0) || 1;
  const doneWeight = steps.filter((s) => done.includes(s.key)).reduce((a, s) => a + s.weight, 0);
  const currentWeight = current ? (steps.find((s) => s.key === current)?.weight ?? 0) * 0.4 : 0;
  const pct = Math.min(97, Math.round(((doneWeight + currentWeight) / total) * 100));

  const over = elapsed > estimateSeconds;
  const left = Math.max(0, estimateSeconds - elapsed);

  return (
    <div className="rounded-3xl border border-black/[0.08] bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#6b6357]">
            Building your lecture
          </p>
          <p className="font-display text-[26px] font-black leading-none text-[#231f1a]">
            {clock(elapsed)}
          </p>
        </div>
        <p className="text-[13px] font-bold text-[#6b6357]">
          {over ? "Almost there — a long lecture takes longer." : `About ${clock(left)} left`}
        </p>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#f0ebe1]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: "#58a700" }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((s) => {
          const isDone = done.includes(s.key);
          const isNow = current === s.key;
          return (
            <li key={s.key} className="flex items-center gap-3 text-[14px]">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
                style={{
                  background: isDone ? "#e6f3dd" : isNow ? "#f1ecfb" : "#f5f1e8",
                  color: isDone ? "#3f7a29" : isNow ? "#4a3877" : "#a49a8b",
                }}
              >
                {isDone ? <Check size={14} /> : isNow ? <Loader2 size={14} className="animate-spin" /> : null}
              </span>
              <span
                className={isDone || isNow ? "font-bold text-[#231f1a]" : "text-[#a49a8b]"}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>

      {detail && <p className="mt-3 text-[13px] text-[#6b6357]">{detail}</p>}
      <p className="mt-2 text-[12px] text-[#a49a8b]">
        You can leave this page open — longer lectures simply take a bit more time.
      </p>
    </div>
  );
}
