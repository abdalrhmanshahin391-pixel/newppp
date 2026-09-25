import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import type { MemoryPair } from "@/lib/use-memory-pairs";
import { sfx, shuffle } from "@/lib/memory-game";
import type { RoundStats } from "./ResultCard";
import { RoundHeader } from "./RoundHeader";

const CHUNK = 5;

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Put the tiles back into the order they were saved in. */
export function SequenceRound({
  pairs,
  onFinish,
}: {
  pairs: MemoryPair[];
  suddenDeath?: boolean;
  onFinish: (stats: RoundStats) => void;
}) {
  const chunks = useMemo(() => {
    const out: MemoryPair[][] = [];
    for (let i = 0; i < pairs.length; i += CHUNK) out.push(pairs.slice(i, i + CHUNK));
    return out.filter((c) => c.length > 1);
  }, [pairs]);

  const [step, setStep] = useState(0);
  const [items, setItems] = useState<MemoryPair[]>(() => shuffle(chunks[0] ?? []));
  const [checked, setChecked] = useState<boolean[] | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [missedIds, setMissedIds] = useState<string[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const startedAt = useRef(Date.now());

  const target = chunks[step];

  if (!target) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-[24px] bg-white p-8 text-center">
        <p className="text-[14px] font-bold text-[#a29a8d]">
          Sequence needs at least two pairs in a topic. Add a few more and try again.
        </p>
      </div>
    );
  }

  const check = () => {
    const flags = items.map((p, i) => p.id === target[i].id);
    setChecked(flags);
    const good = flags.filter(Boolean).length;
    const bad = flags.length - good;
    const ids = items.filter((p, i) => !flags[i]).map((p) => p.id);
    if (bad === 0) sfx.correct();
    else sfx.wrong();

    window.setTimeout(() => {
      const c = correct + good;
      const w = wrong + bad;
      const allMissed = [...missedIds, ...ids];
      setCorrect(c);
      setWrong(w);
      setMissedIds(allMissed);
      setChecked(null);
      if (step + 1 >= chunks.length) {
        sfx.finish();
        onFinish({
          correct: c,
          wrong: w,
          bestStreak: good,
          ms: Date.now() - startedAt.current,
          missedIds: Array.from(new Set(allMissed)),
        });
      } else {
        setStep((s) => s + 1);
        setItems(shuffle(chunks[step + 1]));
      }
    }, 900);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <RoundHeader
        remaining={chunks.length - step}
        streak={0}
        correct={correct}
        wrong={wrong}
        startedAt={startedAt.current}
        label="sets left"
      />

      <p className="mt-5 text-center text-[12.5px] font-bold uppercase tracking-[0.16em] text-[#b3aa9c]">
        Drag into the right order
      </p>

      <div className="mt-3 grid gap-2.5">
        {items.map((p, i) => {
          const flag = checked?.[i];
          return (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null) setItems((l) => move(l, dragFrom, i));
                setDragFrom(null);
              }}
              className="flex items-center gap-3 rounded-2xl border px-4 py-3"
              style={{
                background: flag === true ? "#d8ecdd" : flag === false ? "#fbe4e4" : "#fff",
                borderColor:
                  flag === true ? "#6ab887" : flag === false ? "#d1795e" : "rgba(0,0,0,0.07)",
              }}
            >
              <GripVertical size={16} className="shrink-0 cursor-grab text-[#ccc4b6]" />
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#fbf5e9] text-[12px] font-black text-[#7a4b16]">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-extrabold text-[#23201d]">
                  {p.left}
                </span>
                <span className="block truncate text-[12.5px] font-semibold text-[#a29a8d]">
                  {p.right}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setItems((l) => move(l, i, i - 1))}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#a29a8d] hover:bg-black/[0.06]"
                aria-label="Move up"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => setItems((l) => move(l, i, i + 1))}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#a29a8d] hover:bg-black/[0.06]"
                aria-label="Move down"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={check}
        disabled={!!checked}
        className="rita-pill mt-5 h-12 w-full rounded-2xl text-[14px] font-extrabold disabled:opacity-50"
      >
        Check order
      </button>
    </div>
  );
}
