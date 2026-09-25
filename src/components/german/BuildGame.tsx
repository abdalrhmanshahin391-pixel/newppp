import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Undo2, Volume2, X } from "lucide-react";
import { buildRound, prefetchGerman, shuffle, speakGerman, type BuildRound, type DeItem } from "@/lib/de-lab";
import { useDeRecord } from "@/lib/use-de-lab";

export type BuildLevel = "mix" | "sentence" | "word";

const ACCENT = "#7a5cc4";

function makeRounds(items: DeItem[], level: BuildLevel): BuildRound[] {
  const rounds = items
    .map((item) => buildRound(item, level))
    .filter((r): r is BuildRound => !!r);
  return shuffle(rounds);
}


/**
 * "Build it" — tap the pieces back into the right order: the words of a
 * sentence, or the syllables of a single word.
 */
export function BuildGame({
  items,
  level,
  onExit,
}: {
  items: DeItem[];
  level: BuildLevel;
  onExit: () => void;
}) {
  const [rounds, setRounds] = useState<BuildRound[]>(() => makeRounds(items, level));
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [state, setState] = useState<"playing" | "right" | "wrong">("playing");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const record = useDeRecord();

  const round = rounds[index];
  const pool = useMemo(() => (round ? shuffle(round.tokens.map((t, i) => ({ t, i }))) : []), [round]);

  useEffect(() => {
    prefetchGerman(rounds.slice(0, 12).map((r) => r.answer));
  }, [rounds]);

  useEffect(() => {
    setPlaced([]);
    setState("playing");
  }, [index]);

  if (!round) {
    return (
      <div className="rounded-[26px] border border-black/[0.07] bg-white p-8 text-center">
        <p className="text-[16px] font-black">Nothing to build here yet.</p>
        <p className="mt-2 text-[14px] font-semibold text-[#6b645b]">
          Pick a sub-subject with sentences, or words long enough to split into syllables.
        </p>
        <button
          onClick={onExit}
          className="mt-5 rounded-full px-5 py-2.5 text-[14px] font-extrabold text-white"
          style={{ background: ACCENT }}
        >
          Back to subjects
        </button>
      </div>
    );
  }

  const glue = round.level === "sentence" ? " " : "";
  const attempt = placed.map((i) => round.tokens[i]).join(glue);
  const complete = placed.length === round.tokens.length;

  const finish = (list: number[]) => {
    const built = list.map((i) => round.tokens[i]).join(glue);
    const ok = built.toLowerCase() === round.answer.toLowerCase();
    setState(ok ? "right" : "wrong");
    if (ok) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      void speakGerman(round.prompt);
    } else {
      setStreak(0);
    }
    record.mutate({ mode: "build", rows: [{ itemId: round.id, correct: ok }] });
  };

  const place = (i: number) => {
    if (state !== "playing") return;
    const next = [...placed, i];
    setPlaced(next);
    if (next.length === round.tokens.length) finish(next);
  };

  const next = () => {
    if (index + 1 < rounds.length) setIndex(index + 1);
    else {
      setRounds(makeRounds(items, level));
      setIndex(0);
    }
  };

  return (
    <div className="rounded-[26px] border border-black/[0.07] bg-white p-5 md:p-7">
      {/* top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.16em] text-[#b3aa9c]">
          <span>
            {index + 1} / {rounds.length}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[11px]"
            style={{ background: "#efe9fb", color: ACCENT }}
          >
            {round.level === "sentence" ? "Word order" : "Syllables"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#f3ece0] px-3 py-1 text-[12px] font-extrabold text-[#5a4a2e]">
            {score} right · streak {streak}
          </span>
          <button
            onClick={onExit}
            className="rounded-full border border-black/[0.08] px-3 py-1 text-[12px] font-extrabold text-[#6b645b] hover:bg-[#f7f2e8]"
          >
            End
          </button>
        </div>
      </div>

      {/* progress */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#f0e9dc]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${((index + (state === "playing" ? 0 : 1)) / rounds.length) * 100}%`, background: ACCENT }}
        />
      </div>

      {/* prompt */}
      <div className="mt-6 text-center">
        <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#b3aa9c]">
          {round.level === "sentence" ? "Put the words in order" : "Put the syllables in order"}
        </p>
        <p className="mt-2 text-[20px] font-black leading-snug md:text-[24px]">
          {round.english ?? (round.level === "word" ? "Rebuild the word" : "Rebuild the sentence")}
        </p>
        {round.article && (
          <p className="mt-1 text-[14px] font-extrabold text-[#8a8175]">{round.article} …</p>
        )}
        <button
          onClick={() => void speakGerman(round.prompt)}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-black/[0.08] px-4 py-1.5 text-[13px] font-extrabold text-[#6b645b] hover:bg-[#f7f2e8]"
        >
          <Volume2 size={15} /> Hear it
        </button>
      </div>

      {/* answer line */}
      <div
        className="mt-6 min-h-[86px] rounded-[22px] border-2 border-dashed p-3 transition-colors"
        style={{
          borderColor: state === "right" ? "#2f9e63" : state === "wrong" ? "#d94a4a" : "#e3dacb",
          background: state === "right" ? "#eaf7f0" : state === "wrong" ? "#fdecec" : "#fcf8f1",
        }}
      >
        {placed.length === 0 ? (
          <p className="grid h-[62px] place-items-center text-[14px] font-bold text-[#b3aa9c]">
            Tap the pieces below in the right order
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {placed.map((tokenIndex, slot) => (
              <button
                key={`${tokenIndex}-${slot}`}
                onClick={() => state === "playing" && setPlaced(placed.filter((_, s) => s !== slot))}
                className="rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-[18px] font-black shadow-[0_8px_20px_-14px_rgba(0,0,0,0.5)]"
              >
                {round.tokens[tokenIndex]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* pool */}
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        {pool.map(({ t, i }) => {
          const used = placed.includes(i);
          return (
            <button
              key={`${t}-${i}`}
              disabled={used || state !== "playing"}
              onClick={() => place(i)}
              className="rounded-2xl px-5 py-3.5 text-[19px] font-black transition-all disabled:opacity-25"
              style={{
                background: used ? "#f0e9dc" : "#efe9fb",
                color: ACCENT,
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* actions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {state === "playing" ? (
          <>
            <button
              onClick={() => setPlaced(placed.slice(0, -1))}
              disabled={!placed.length}
              className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] px-4 py-2.5 text-[14px] font-extrabold text-[#6b645b] disabled:opacity-40"
            >
              <Undo2 size={15} /> Undo
            </button>
            <button
              onClick={() => setPlaced([])}
              disabled={!placed.length}
              className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] px-4 py-2.5 text-[14px] font-extrabold text-[#6b645b] disabled:opacity-40"
            >
              <RotateCcw size={15} /> Clear
            </button>
            {complete && (
              <button
                onClick={() => finish(placed)}
                className="rounded-full px-6 py-2.5 text-[14px] font-extrabold text-white"
                style={{ background: ACCENT }}
              >
                Check
              </button>
            )}
          </>
        ) : (
          <div className="w-full text-center">
            <p
              className="inline-flex items-center gap-2 text-[16px] font-black"
              style={{ color: state === "right" ? "#2f9e63" : "#d94a4a" }}
            >
              {state === "right" ? <Check size={18} /> : <X size={18} />}
              {state === "right" ? "Perfect" : `It's “${round.answer}”`}
            </p>
            {state === "wrong" && (
              <p className="mt-1 text-[13.5px] font-bold text-[#8a8175]">You built “{attempt}”</p>
            )}
            <div className="mt-4 flex justify-center gap-2.5">
              {state === "wrong" && (
                <button
                  onClick={() => {
                    setPlaced([]);
                    setState("playing");
                  }}
                  className="rounded-full border border-black/[0.08] px-5 py-2.5 text-[14px] font-extrabold text-[#6b645b]"
                >
                  Try again
                </button>
              )}
              <button
                onClick={next}
                className="rounded-full px-6 py-2.5 text-[14px] font-extrabold text-white"
                style={{ background: ACCENT }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
