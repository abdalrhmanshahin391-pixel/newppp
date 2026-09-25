import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, Volume2, X, Zap } from "lucide-react";
import { ARTICLES, ARTICLE_COLORS, prefetchGerman, ruleFor, shuffle, speakGerman, type Article, type DeItem } from "@/lib/de-lab";
import { playCorrect, playWrong } from "@/lib/german-match-audio";
import { useDeFlag, useDeRecord } from "@/lib/use-de-lab";
import { DeResults, type ResultRow } from "@/components/german/DeResults";

export type ArticleMode = "tap" | "clock" | "endings";

const ACCENT = "#2f6fd0";

export function ArticleGame({
  items,
  mode,
  onClose,
}: {
  items: DeItem[];
  mode: ArticleMode;
  onClose: () => void;
}) {
  const playable = useMemo(() => items.filter((i) => i.article), [items]);
  const [queue, setQueue] = useState<DeItem[]>(() => shuffle(playable));
  const [results, setResults] = useState<Record<string, ResultRow>>({});
  const [pick, setPick] = useState<Article | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [seconds, setSeconds] = useState(60);
  const [done, setDone] = useState(false);
  const flag = useDeFlag();
  const record = useDeRecord();
  const saved = useRef(false);

  const current = queue[0];
  const total = playable.length;
  const answered = Object.keys(results).length;

  useEffect(() => {
    prefetchGerman(playable.slice(0, 20).map((i) => `${i.article} ${i.german}`));
  }, [playable]);

  useEffect(() => {
    if (mode !== "clock" || done) return;
    const t = setInterval(() => setSeconds((s) => (s <= 1 ? (setDone(true), 0) : s - 1)), 1000);
    return () => clearInterval(t);
  }, [mode, done]);

  useEffect(() => {
    if (!done || saved.current) return;
    saved.current = true;
    const rows = Object.values(results);
    if (rows.length) {
      void record.mutateAsync({
        mode: `article-${mode}`,
        rows: rows.map((r) => ({ itemId: r.item.id, correct: r.correct, score: r.correct ? 100 : 0 })),
      });
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (choice: Article) => {
    if (!current || pick) return;
    const right = current.article === choice;
    setPick(choice);
    if (right) {
      playCorrect();
      setStreak((s) => {
        const n = s + 1;
        setBest((b) => Math.max(b, n));
        return n;
      });
    } else {
      playWrong();
      setStreak(0);
    }
    void speakGerman(`${current.article} ${current.german}`);
    setResults((r) => ({
      ...r,
      [current.id]: { item: current, correct: right && !(r[current.id] && !r[current.id].correct), score: right ? 100 : 0 },
    }));

    const delay = mode === "endings" ? 1500 : right ? 650 : 1200;
    window.setTimeout(() => {
      setPick(null);
      setQueue((q) => {
        const [head, ...rest] = q;
        const next = right ? rest : [...rest, head]; // missed nouns come back
        if (!next.length) setDone(true);
        return next;
      });
    }, delay);
  };

  if (done || !current) {
    return (
      <DeResults
        rows={Object.values(results)}
        accent={ACCENT}
        onClose={onClose}
        onRetryMissed={() => {
          const missed = Object.values(results).filter((r) => !r.correct).map((r) => r.item);
          if (!missed.length) return onClose();
          saved.current = false;
          setResults({});
          setQueue(shuffle(missed));
          setSeconds(60);
          setDone(false);
        }}
      />
    );
  }

  const hint = mode === "endings" ? ruleFor(current.german) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fbf5e9] p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <button onClick={() => setDone(true)} className="rounded-full bg-white p-2.5 text-[#6b645b] shadow-sm">
          <X size={18} />
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${total ? (answered / total) * 100 : 0}%`, background: ACCENT }}
          />
        </div>
        {mode === "clock" ? (
          <span className="rounded-full bg-white px-3 py-1.5 text-[14px] font-black tabular-nums text-[#23201d] shadow-sm">
            {seconds}s
          </span>
        ) : (
          <span className="rounded-full bg-white px-3 py-1.5 text-[13px] font-black text-[#23201d] shadow-sm">
            {answered}/{total}
          </span>
        )}
        {streak > 1 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fdebc9] px-3 py-1.5 text-[13px] font-black text-[#8a5b12]">
            <Zap size={13} /> {streak}
          </span>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center">
        <div
          key={current.id + String(pick)}
          className="w-full rounded-[32px] bg-white px-6 py-12 text-center shadow-[0_24px_60px_-30px_rgba(0,0,0,0.28)] transition"
          style={{
            outline: pick ? `4px solid ${pick === current.article ? "#2f9e63" : "#d94a4a"}` : "none",
          }}
        >
          <div className="flex items-center justify-center gap-3">
            <span className="font-display text-[clamp(2rem,7vw,3.6rem)] font-black leading-none tracking-tight text-[#23201d]">
              {pick && (
                <span style={{ color: ARTICLE_COLORS[current.article as Article].bg }}>
                  {current.article}{" "}
                </span>
              )}
              {current.german}
            </span>
            <button
              onClick={() => void speakGerman(`${current.article} ${current.german}`)}
              className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f3ece0] text-[#5a4a2e]"
              aria-label="Hear it"
            >
              <Volume2 size={19} />
            </button>
          </div>
          {current.english && <p className="mt-3 text-[16px] font-semibold text-[#6b645b]">{current.english}</p>}
          {pick && current.plural && (
            <p className="mt-2 text-[14px] font-bold text-[#8b8378]">plural · {current.plural}</p>
          )}
          {pick && hint && (
            <p className="mx-auto mt-4 max-w-md rounded-2xl bg-[#f6f1e6] px-4 py-3 text-[14px] font-bold text-[#5a4a2e]">
              {hint.rule}
            </p>
          )}
          <button
            onClick={() => void flag.mutateAsync({ itemId: current.id, on: !current.flagged })}
            className="mt-6 inline-flex items-center gap-2 text-[13px] font-extrabold"
            style={{ color: current.flagged ? "#d94a4a" : "#b8b0a4" }}
          >
            <Flag size={14} fill={current.flagged ? "#d94a4a" : "none"} /> Red flag
          </button>
        </div>

        <div className="mt-8 grid w-full grid-cols-3 gap-3">
          {ARTICLES.map((a) => {
            const c = ARTICLE_COLORS[a];
            const chosen = pick === a;
            const reveal = pick && current.article === a;
            return (
              <button
                key={a}
                onClick={() => answer(a)}
                disabled={!!pick}
                className="rounded-[26px] py-6 font-display text-[clamp(1.4rem,4vw,2rem)] font-black text-white transition active:scale-[0.97] disabled:cursor-default"
                style={{
                  background: c.bg,
                  opacity: pick && !chosen && !reveal ? 0.35 : 1,
                  boxShadow: reveal ? "0 0 0 4px #2f9e63" : chosen ? "0 0 0 4px #d94a4a" : "0 10px 24px -14px rgba(0,0,0,0.5)",
                }}
              >
                {a}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[13px] font-bold text-[#8b8378]">
          der = blue · die = red · das = green — misses come back until you get them right.
        </p>
      </div>
    </div>
  );
}
