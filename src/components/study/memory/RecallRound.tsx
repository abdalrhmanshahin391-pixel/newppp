import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import type { MemoryPair } from "@/lib/use-memory-pairs";
import { answerMatches, seedPool, sfx } from "@/lib/memory-game";
import type { RoundStats } from "./ResultCard";
import { RoundHeader } from "./RoundHeader";

/** The prompt shows, you type the answer — spelling is checked forgivingly. */
export function RecallRound({
  pairs,
  suddenDeath,
  onFinish,
}: {
  pairs: MemoryPair[];
  suddenDeath: boolean;
  onFinish: (stats: RoundStats) => void;
}) {
  const order = useMemo(() => seedPool(pairs), [pairs]);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<"idle" | "right" | "wrong">("idle");
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [missedIds, setMissedIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());

  const current = order[index];

  useEffect(() => {
    inputRef.current?.focus();
  }, [index]);

  if (!current) return null;

  const next = (c: number, w: number, ids: string[]) => {
    if (index + 1 >= order.length) {
      sfx.finish();
      onFinish({
        correct: c,
        wrong: w,
        bestStreak: best,
        ms: Date.now() - startedAt.current,
        missedIds: Array.from(new Set(ids)),
      });
      return;
    }
    setIndex((i) => i + 1);
    setValue("");
    setVerdict("idle");
  };

  const check = () => {
    if (verdict !== "idle") {
      next(correct, wrong, missedIds);
      return;
    }
    const ok = answerMatches(value, current.right);
    if (ok) {
      sfx.correct();
      const c = correct + 1;
      setCorrect(c);
      setStreak((s) => {
        const n = s + 1;
        setBest((b) => Math.max(b, n));
        return n;
      });
      setVerdict("right");
      window.setTimeout(() => next(c, wrong, missedIds), 700);
    } else {
      sfx.wrong();
      const w = wrong + 1;
      const ids = [...missedIds, current.id];
      setWrong(w);
      setMissedIds(ids);
      setStreak(0);
      setVerdict("wrong");
      if (suddenDeath) {
        window.setTimeout(() => {
          sfx.finish();
          onFinish({
            correct,
            wrong: w,
            bestStreak: best,
            ms: Date.now() - startedAt.current,
            missedIds: Array.from(new Set(ids)),
          });
        }, 900);
      }
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <RoundHeader
        remaining={order.length - index}
        streak={streak}
        correct={correct}
        wrong={wrong}
        startedAt={startedAt.current}
      />

      <div className="mt-5 rounded-[24px] border-2 border-[#121117] bg-white px-6 py-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a9aab]">
          What belongs to
        </p>
        <p className="mt-3 font-display text-[27px] font-black leading-tight tracking-tight text-[#121117]">
          {current.left}
        </p>

        <div className="mx-auto mt-6 flex max-w-md items-center gap-2">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                check();
              }
            }}
            placeholder="Type the answer"
            className="h-12 w-full rounded-lg border-2 px-4 text-[16px] font-medium text-[#121117] outline-none"
            style={{
              borderColor:
                verdict === "right" ? "#2e7d32" : verdict === "wrong" ? "#b3213f" : "#121117",
              background:
                verdict === "right" ? "#d2ecd4" : verdict === "wrong" ? "#f4f4f8" : "#fff",
            }}
          />
          <button
            type="button"
            onClick={check}
            className="rita-pill grid h-12 w-12 shrink-0 place-items-center"
            aria-label="Check answer"
          >
            <CornerDownLeft size={18} />
          </button>
        </div>

        {verdict === "wrong" && (
          <div className="mt-4">
            <p className="text-[13px] font-bold text-[#d9506d]">
              The answer is <span className="text-[#121117]">{current.right}</span>
            </p>
            {current.hint && (
              <p className="mt-1 text-[12.5px] font-semibold text-[#9a9aab]">{current.hint}</p>
            )}
            <button
              type="button"
              onClick={() => next(correct, wrong, missedIds)}
              className="mt-3 h-11 rounded-lg border-2 border-[#121117] bg-white px-5 text-[15px] font-semibold text-[#121117] hover:bg-[#f4f4f8]"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
