import { Flame, RotateCcw, Target, Timer, X } from "lucide-react";
import { accuracyOf, formatTime } from "@/lib/memory-game";

export type RoundStats = {
  correct: number;
  wrong: number;
  bestStreak: number;
  ms: number;
  missedIds: string[];
};

export function ResultCard({
  stats,
  onDrillMistakes,
  onAgain,
  onClose,
}: {
  stats: RoundStats;
  onDrillMistakes: () => void;
  onAgain: () => void;
  onClose: () => void;
}) {
  const acc = accuracyOf(stats.correct, stats.wrong);
  const cells = [
    { icon: <Timer size={16} />, label: "Time", value: formatTime(stats.ms) },
    { icon: <Target size={16} />, label: "Accuracy", value: `${acc}%` },
    { icon: <Flame size={16} />, label: "Best streak", value: `${stats.bestStreak}` },
  ];

  return (
    <div className="mx-auto w-full max-w-lg rounded-[28px] bg-white p-7 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b3aa9c]">Round done</p>
      <h2 className="mt-2 font-display text-[30px] font-black tracking-tight text-[#23201d]">
        {acc === 100 ? "Perfect run" : acc >= 80 ? "Strong round" : "Good work"}
      </h2>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-2xl bg-[#fbf5e9] px-3 py-4">
            <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-white text-[#7a4b16]">
              {c.icon}
            </span>
            <p className="mt-2 text-[19px] font-black leading-none text-[#23201d]">{c.value}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#b3aa9c]">
              {c.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        {stats.missedIds.length > 0 && (
          <button
            type="button"
            onClick={onDrillMistakes}
            className="rita-pill flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-extrabold"
          >
            Drill my mistakes ({stats.missedIds.length})
          </button>
        )}
        <button
          type="button"
          onClick={onAgain}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white text-[14px] font-extrabold text-[#23201d] hover:bg-black/[0.03]"
        >
          <RotateCcw size={16} /> Play again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 items-center justify-center gap-2 rounded-2xl text-[13.5px] font-bold text-[#a29a8d] hover:bg-black/[0.05]"
        >
          <X size={15} /> Back to the board
        </button>
      </div>
    </div>
  );
}
