import { useEffect, useMemo, useRef, useState } from "react";
import type { MemoryPair } from "@/lib/use-memory-pairs";
import { BOARD_SIZE, seedPool, sfx, shuffle } from "@/lib/memory-game";
import type { RoundStats } from "./ResultCard";
import { RoundHeader } from "./RoundHeader";

type Side = "left" | "right";

/** Six tiles on the left, six partners on the right — tap one from each side. */
export function MatchBoard({
  pairs,
  suddenDeath,
  onFinish,
}: {
  pairs: MemoryPair[];
  suddenDeath: boolean;
  onFinish: (stats: RoundStats) => void;
}) {
  const pool = useMemo(() => seedPool(pairs), [pairs]);
  const [queue, setQueue] = useState<MemoryPair[]>(() => pool.slice(BOARD_SIZE));
  const [active, setActive] = useState<MemoryPair[]>(() => pool.slice(0, BOARD_SIZE));
  const [leftOrder, setLeftOrder] = useState<string[]>(() =>
    shuffle(pool.slice(0, BOARD_SIZE).map((p) => p.id)),
  );
  const [rightOrder, setRightOrder] = useState<string[]>(() =>
    shuffle(pool.slice(0, BOARD_SIZE).map((p) => p.id)),
  );
  const [picked, setPicked] = useState<{ side: Side; id: string } | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [missedIds, setMissedIds] = useState<string[]>([]);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  const remainingCount = active.length + queue.length;

  useEffect(() => {
    if (done.current) return;
    if (remainingCount === 0) {
      done.current = true;
      sfx.finish();
      onFinish({
        correct,
        wrong: misses,
        bestStreak: best,
        ms: Date.now() - startedAt.current,
        missedIds: Array.from(new Set(missedIds)),
      });
    }
  }, [remainingCount, correct, misses, best, missedIds, onFinish]);

  const finishEarly = (extraMiss: number) => {
    done.current = true;
    onFinish({
      correct,
      wrong: misses + extraMiss,
      bestStreak: best,
      ms: Date.now() - startedAt.current,
      missedIds: Array.from(new Set(missedIds)),
    });
  };

  const solve = (id: string) => {
    sfx.correct();
    setLeaving((l) => [...l, id]);
    setCorrect((c) => c + 1);
    setStreak((s) => {
      const next = s + 1;
      setBest((b) => Math.max(b, next));
      return next;
    });
    window.setTimeout(() => {
      setActive((cur) => {
        const without = cur.filter((p) => p.id !== id);
        let refill = without;
        setQueue((q) => {
          if (q.length > 0 && without.length < BOARD_SIZE) {
            const [next, ...rest] = q;
            refill = [...without, next];
            setLeftOrder(shuffle(refill.map((p) => p.id)));
            setRightOrder(shuffle(refill.map((p) => p.id)));
            return rest;
          }
          setLeftOrder(shuffle(without.map((p) => p.id)));
          setRightOrder(shuffle(without.map((p) => p.id)));
          return q;
        });
        return refill;
      });
      setLeaving((l) => l.filter((x) => x !== id));
    }, 340);
  };

  const miss = (a: string, b: string) => {
    sfx.wrong();
    setWrong([a, b]);
    setMisses((m) => m + 1);
    setStreak(0);
    setMissedIds((ids) => [...ids, a]);
    setHints((h) => (h.includes(a) ? h : [...h, a]));
    window.setTimeout(() => setWrong([]), 450);
    if (suddenDeath) window.setTimeout(() => finishEarly(0), 500);
  };

  const tap = (side: Side, id: string) => {
    if (leaving.includes(id) || done.current) return;
    if (!picked) {
      setPicked({ side, id });
      return;
    }
    if (picked.side === side) {
      setPicked({ side, id });
      return;
    }
    const same = picked.id === id;
    setPicked(null);
    if (same) solve(id);
    else miss(picked.side === "left" ? picked.id : id, picked.side === "left" ? id : picked.id);
  };

  const byId = (id: string) => active.find((p) => p.id === id);

  const tile = (side: Side, id: string) => {
    const pair = byId(id);
    if (!pair) return null;
    const isPicked = picked?.side === side && picked.id === id;
    const isWrong = wrong.includes(id);
    const isLeaving = leaving.includes(id);
    const soft = side === "left" ? "#fbe3c8" : "#d6e8f6";
    const ink = side === "left" ? "#7a4b16" : "#1f4c6d";
    return (
      <button
        key={id}
        type="button"
        onClick={() => tap(side, id)}
        className={`min-h-[4.5rem] rounded-2xl border px-4 py-3 text-left transition-all duration-300 ${
          isLeaving ? "scale-90 opacity-0" : "opacity-100"
        } ${isWrong ? "animate-[rita-shake_0.4s_ease]" : ""}`}
        style={{
          background: isWrong ? "#fbe4e4" : isPicked ? soft : "#fff",
          borderColor: isWrong ? "#d1795e" : isPicked ? ink : "rgba(0,0,0,0.07)",
          boxShadow: isPicked ? `0 10px 22px -16px ${ink}` : undefined,
        }}
      >
        <span className="block text-[14px] font-extrabold leading-snug" style={{ color: ink }}>
          {side === "left" ? pair.left : pair.right}
        </span>
        {side === "left" && hints.includes(id) && pair.hint && (
          <span className="mt-1 block text-[11.5px] font-semibold text-[#a29a8d]">{pair.hint}</span>
        )}
      </button>
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <RoundHeader
        remaining={remainingCount}
        streak={streak}
        correct={correct}
        wrong={misses}
        startedAt={startedAt.current}
      />

      <div className="mt-5 grid grid-cols-2 gap-3 md:gap-5">
        <div className="grid gap-3">{leftOrder.map((id) => tile("left", id))}</div>
        <div className="grid gap-3">{rightOrder.map((id) => tile("right", id))}</div>
      </div>
    </div>
  );
}
