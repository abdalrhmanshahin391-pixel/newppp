import { Flag, RotateCcw, Volume2, X } from "lucide-react";
import { ARTICLE_COLORS, speakGerman, type Article, type DeItem } from "@/lib/de-lab";
import { useDeFlag } from "@/lib/use-de-lab";
import { band } from "@/lib/de-score";

export type ResultRow = { item: DeItem; correct: boolean; score: number };

export function DeResults({
  rows,
  accent,
  showScores = false,
  onRetryMissed,
  onClose,
}: {
  rows: ResultRow[];
  accent: string;
  showScores?: boolean;
  onRetryMissed: () => void;
  onClose: () => void;
}) {
  const flag = useDeFlag();
  const missed = rows.filter((r) => !r.correct);
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.score, 0) / rows.length) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf5e9] p-4 md:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[30px] font-black leading-tight text-[#23201d]">
              {missed.length === 0 ? "Perfect round" : `${rows.length - missed.length} / ${rows.length} right`}
            </h2>
            <p className="mt-1 text-[15px] font-semibold text-[#6b645b]">
              {showScores ? `Average pronunciation ${avg}/100` : "Everything you missed is listed below with the correct answer."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full bg-white p-2.5 text-[#6b645b] shadow-sm">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {rows.map(({ item, correct, score }) => {
            const art = (item.article ?? null) as Article | null;
            const c = art ? ARTICLE_COLORS[art] : null;
            const b = band(score);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3"
                style={{ borderLeft: `6px solid ${correct ? "#2f9e63" : "#d94a4a"}` }}
              >
                <button
                  onClick={() => void speakGerman(art ? `${art} ${item.german}` : item.german)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f3ece0] text-[#5a4a2e] transition hover:brightness-95"
                  aria-label="Play German audio"
                >
                  <Volume2 size={17} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-black text-[#23201d]">
                    {art && (
                      <span className="mr-1.5 rounded-md px-1.5 py-0.5 text-[14px] text-white" style={{ background: c!.bg }}>
                        {art}
                      </span>
                    )}
                    {item.german}
                  </div>
                  {item.english && <div className="truncate text-[13px] text-[#6b645b]">{item.english}</div>}
                </div>
                {showScores && (
                  <span className="shrink-0 text-[13px] font-black" style={{ color: b.color }}>
                    {score}
                  </span>
                )}
                <button
                  onClick={() => void flag.mutateAsync({ itemId: item.id, on: !item.flagged })}
                  className="shrink-0 rounded-full p-2 transition"
                  style={{ color: item.flagged ? "#d94a4a" : "#c3bcb1" }}
                  aria-label="Red flag this item"
                >
                  <Flag size={17} fill={item.flagged ? "#d94a4a" : "none"} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          {missed.length > 0 && (
            <button
              onClick={onRetryMissed}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-extrabold text-white"
              style={{ background: accent }}
            >
              <RotateCcw size={16} /> Drill the {missed.length} I missed
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white px-6 py-3 text-[15px] font-extrabold text-[#23201d]"
          >
            Back to subjects
          </button>
        </div>
      </div>
    </div>
  );
}
