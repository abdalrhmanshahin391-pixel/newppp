import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { accuracyOf, formatTime } from "@/lib/memory-game";

/** Live stats strip shared by every Memory Lab round. */
export function RoundHeader({
  remaining,
  streak,
  correct,
  wrong,
  startedAt,
  label = "left",
}: {
  remaining: number;
  streak: number;
  correct: number;
  wrong: number;
  startedAt: number;
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const flame = streak >= 10 ? 22 : streak >= 5 ? 18 : 15;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Stat value={`${remaining}`} label={label} />
      <Stat value={`${accuracyOf(correct, wrong)}%`} label="accuracy" />
      <Stat value={formatTime(now - startedAt)} label="time" />
      <div
        className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors"
        style={{ background: streak >= 3 ? "#fbe3c8" : "#fff" }}
      >
        <Flame size={flame} color={streak >= 3 ? "#e0762c" : "#ccc4b6"} />
        <span className="text-[13px] font-black text-[#23201d]">{streak}</span>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-full bg-white px-4 py-2">
      <span className="text-[13px] font-black text-[#23201d]">{value}</span>
      <span className="ml-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#b3aa9c]">
        {label}
      </span>
    </div>
  );
}
