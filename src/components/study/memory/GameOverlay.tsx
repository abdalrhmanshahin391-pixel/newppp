import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { MemoryPair } from "@/lib/use-memory-pairs";
import { formatTime, sfx, type GameMode } from "@/lib/memory-game";
import { MatchBoard } from "./MatchBoard";
import { SpeedRound } from "./SpeedRound";
import { RecallRound } from "./RecallRound";
import { SequenceRound } from "./SequenceRound";
import { ResultCard, type RoundStats } from "./ResultCard";

const TIMED_MS = 120_000;

/** Full-screen Memory Lab session: one round, then the result card. */
export function GameOverlay({
  open,
  title,
  mode,
  pairs,
  suddenDeath,
  timed,
  onClose,
  onMissed,
}: {
  open: boolean;
  title: string;
  mode: GameMode;
  pairs: MemoryPair[];
  suddenDeath: boolean;
  timed: boolean;
  onClose: () => void;
  onMissed: (ids: string[]) => void;
}) {
  const [runId, setRunId] = useState(0);
  const [stats, setStats] = useState<RoundStats | null>(null);
  const [drill, setDrill] = useState<string[] | null>(null);
  const [left, setLeft] = useState(TIMED_MS);
  const [timeUp, setTimeUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStats(null);
    setDrill(null);
    setTimeUp(false);
    setLeft(TIMED_MS);
    setRunId((r) => r + 1);
  }, [open, mode]);

  useEffect(() => {
    if (!open || !timed || stats || timeUp) return;
    const t = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1000) {
          window.clearInterval(t);
          sfx.finish();
          setTimeUp(true);
          return 0;
        }
        return v - 1000;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [open, timed, stats, timeUp, runId]);

  const active = useMemo(() => {
    if (!drill) return pairs;
    const set = new Set(drill);
    return pairs.filter((p) => set.has(p.id));
  }, [pairs, drill]);

  if (!open) return null;

  const finish = (s: RoundStats) => {
    setStats(s);
    if (s.missedIds.length > 0) onMissed(s.missedIds);
  };

  const restart = (only?: string[]) => {
    setDrill(only ?? null);
    setStats(null);
    setTimeUp(false);
    setLeft(TIMED_MS);
    setRunId((r) => r + 1);
  };

  const Round =
    mode === "match"
      ? MatchBoard
      : mode === "speed"
        ? SpeedRound
        : mode === "recall"
          ? RecallRound
          : SequenceRound;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf5e9] px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b3aa9c]">
            Memory Lab
          </p>
          <h2 className="truncate font-display text-[20px] font-black tracking-tight text-[#23201d]">
            {title}
          </h2>
        </div>
        {timed && !stats && !timeUp && (
          <span className="rounded-full bg-white px-4 py-2 text-[13px] font-black text-[#23201d]">
            {formatTime(left)}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#a29a8d] hover:text-[#23201d]"
          aria-label="Close session"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-6 pb-10">
        {stats ? (
          <ResultCard
            stats={stats}
            onDrillMistakes={() => restart(stats.missedIds)}
            onAgain={() => restart()}
            onClose={onClose}
          />
        ) : timeUp ? (
          <div className="mx-auto w-full max-w-lg rounded-[28px] bg-white p-8 text-center">
            <h3 className="font-display text-[26px] font-black tracking-tight text-[#23201d]">
              Time is up
            </h3>
            <p className="mt-2 text-[14px] font-semibold text-[#a29a8d]">
              Two minutes gone — go again and beat what you managed.
            </p>
            <button
              type="button"
              onClick={() => restart()}
              className="rita-pill mt-5 h-12 w-full rounded-2xl text-[14px] font-extrabold"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 h-11 w-full rounded-2xl text-[13.5px] font-bold text-[#a29a8d] hover:bg-black/[0.05]"
            >
              Back to the board
            </button>
          </div>
        ) : (
          <Round key={runId} pairs={active} suddenDeath={suddenDeath} onFinish={finish} />
        )}
      </div>
    </div>
  );
}
