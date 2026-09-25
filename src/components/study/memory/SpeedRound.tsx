import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MemoryPair } from "@/lib/use-memory-pairs";
import { seedPool, sfx, shuffle } from "@/lib/memory-game";
import type { RoundStats } from "./ResultCard";
import { RoundHeader } from "./RoundHeader";

const LIMIT_MS = 8000;

/** One prompt, four answers, eight seconds each. */
export function SpeedRound({
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
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [missedIds, setMissedIds] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [left, setLeft] = useState(LIMIT_MS);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  const current = order[index];

  const options = useMemo(() => {
    if (!current) return [];
    const others = shuffle(order.filter((p) => p.id !== current.id)).slice(0, 3);
    return shuffle([current, ...others]);
  }, [current, order]);

  const finish = useCallback(
    (c: number, w: number, ids: string[]) => {
      done.current = true;
      sfx.finish();
      onFinish({
        correct: c,
        wrong: w,
        bestStreak: Math.max(best, streak),
        ms: Date.now() - startedAt.current,
        missedIds: Array.from(new Set(ids)),
      });
    },
    [best, streak, onFinish],
  );

  const advance = useCallback(
    (ok: boolean) => {
      const nextCorrect = correct + (ok ? 1 : 0);
      const nextWrong = wrong + (ok ? 0 : 1);
      const nextMissed = ok ? missedIds : [...missedIds, current?.id ?? ""];
      setCorrect(nextCorrect);
      setWrong(nextWrong);
      setMissedIds(nextMissed);
      if (ok) {
        setStreak((s) => {
          const n = s + 1;
          setBest((b) => Math.max(b, n));
          return n;
        });
      } else {
        setStreak(0);
      }
      window.setTimeout(() => {
        setChosen(null);
        setLeft(LIMIT_MS);
        if ((!ok && suddenDeath) || index + 1 >= order.length) {
          finish(nextCorrect, nextWrong, nextMissed);
        } else {
          setIndex((i) => i + 1);
        }
      }, 520);
    },
    [correct, wrong, missedIds, current, index, order.length, suddenDeath, finish],
  );

  useEffect(() => {
    if (chosen || done.current) return;
    const t = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 200) {
          window.clearInterval(t);
          sfx.wrong();
          setChosen("timeout");
          advance(false);
          return 0;
        }
        return v - 100;
      });
    }, 100);
    return () => window.clearInterval(t);
  }, [chosen, index, advance]);

  if (!current) return null;

  const pick = (id: string) => {
    if (chosen) return;
    setChosen(id);
    const ok = id === current.id;
    if (ok) sfx.correct();
    else sfx.wrong();
    advance(ok);
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

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full transition-[width] duration-100 ease-linear"
          style={{ width: `${(left / LIMIT_MS) * 100}%`, background: "#f0a95c" }}
        />
      </div>

      <div className="mt-5 rounded-[24px] bg-white px-6 py-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b3aa9c]">Which one?</p>
        <p className="mt-3 font-display text-[26px] font-black leading-tight tracking-tight text-[#23201d]">
          {current.left}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const isRight = chosen && o.id === current.id;
          const isWrongPick = chosen === o.id && o.id !== current.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => pick(o.id)}
              className={`min-h-[4rem] rounded-2xl border px-4 py-3 text-left text-[14px] font-extrabold transition-all ${
                isWrongPick ? "animate-[rita-shake_0.4s_ease]" : ""
              }`}
              style={{
                background: isRight ? "#d8ecdd" : isWrongPick ? "#fbe4e4" : "#fff",
                borderColor: isRight ? "#6ab887" : isWrongPick ? "#d1795e" : "rgba(0,0,0,0.07)",
                color: "#23201d",
              }}
            >
              {o.right}
            </button>
          );
        })}
      </div>
    </div>
  );
}
