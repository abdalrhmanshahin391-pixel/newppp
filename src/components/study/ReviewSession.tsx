import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Flame, Check, Undo2, PauseCircle, Sparkles } from "lucide-react";
import { gradeCard, setCardSuspended, undoLastGrade } from "@/lib/review.functions";
import { scaleText, styleToCss, type FlashCardItem } from "@/lib/use-flashcards";
import type { ReviewRow } from "@/lib/review.functions";
import { useCardFlags } from "@/lib/use-card-flags";
import { FlagButton } from "@/components/study/FlagButton";
import { FlipCard } from "@/components/study/FlipCard";
import { toast } from "sonner";

type Item = { row: ReviewRow; card: FlashCardItem };

/** One face of the review card. */
function ReviewFace({
  text,
  image,
  cardStyle,
  hint,
}: {
  text: string;
  image?: string;
  cardStyle?: FlashCardItem["frontStyle"];
  hint: string;
}) {
  return (
    <div className="grid h-full w-full place-items-center overflow-auto rounded-[32px] border border-black/[0.06] bg-white p-8 text-center shadow-[0_30px_70px_-50px_rgba(35,32,29,0.6)]">
      <div className="w-full">
        {image && (
          <img src={image} alt="" className="mx-auto mb-4 max-h-[28vh] w-auto rounded-2xl object-contain" />
        )}
        <p className={scaleText(text)} style={styleToCss(cardStyle)}>
          {text}
        </p>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#a79c8c]">{hint}</p>
      </div>
    </div>
  );
}

const GRADES = [
  { g: 0, label: "Again", key: "1", hint: "10 min", bg: "#f6ddd5", ink: "#7d3421" },
  { g: 1, label: "Hard", key: "2", hint: "soon", bg: "#fbe3c8", ink: "#7a4b16" },
  { g: 2, label: "Good", key: "3", hint: "on track", bg: "#d6e8f6", ink: "#1f4c6d" },
  { g: 3, label: "Easy", key: "4", hint: "later", bg: "#d8ecdd", ink: "#215237" },
] as const;

function human(days: number) {
  if (days <= 0.02) return "in 10 minutes";
  if (days < 1) return `in ${Math.max(1, Math.round(days * 24))} hours`;
  if (days < 30) return `in ${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
  if (days < 365) return `in ${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? "" : "s"}`;
  return "in over a year";
}

function shortGap(days: number) {
  if (days <= 0.02) return "10 min";
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} h`;
  if (days < 30) return `${Math.round(days)} d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} y`;
}

/** 0..100 strength bar from the card's stability. */
function strengthOf(stability?: number | null) {
  const s = Number(stability ?? 0);
  if (!s) return 0;
  const days = (s / (19 / 81)) * (Math.pow(0.9, -2) - 1);
  return Math.max(0, Math.min(100, Math.round((Math.log(1 + days) / Math.log(121)) * 100)));
}

/**
 * The review: due cards graded Again / Hard / Good / Easy, so every card gets
 * its own schedule — with the memory strength, the real next gap and an undo.
 */
export function ReviewSession({
  open,
  items,
  title,
  onClose,
}: {
  open: boolean;
  items: Item[];
  title?: string;
  onClose: () => void;
}) {
  const grade = useServerFn(gradeCard);
  const undo = useServerFn(undoLastGrade);
  const suspend = useServerFn(setCardSuspended);
  const [queue, setQueue] = useState<Item[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [right, setRight] = useState(0);
  const [again, setAgain] = useState<string[]>([]);
  const [streak, setStreak] = useState<number | null>(null);
  const [todayCards, setTodayCards] = useState(0);
  const [goal, setGoal] = useState(20);
  const [lastNext, setLastNext] = useState<string | null>(null);
  const [save, setSave] = useState<string | null>(null);
  const [tomorrow, setTomorrow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const startedAt = useRef(Date.now());
  const flags = useCardFlags();

  useEffect(() => {
    if (!open) return;
    setQueue(items);
    setPos(0);
    setFlipped(false);
    setRight(0);
    setAgain([]);
    setLastNext(null);
    setSave(null);
    setTomorrow(0);
    setCanUndo(false);
    startedAt.current = Date.now();
  }, [open, items]);

  const current = queue[pos];
  const done = open && !current;

  const progress = useMemo(
    () => (queue.length ? Math.round((pos / queue.length) * 100) : 0),
    [pos, queue.length],
  );

  const answer = useCallback(
    async (g: number) => {
      const card = queue[pos];
      if (!card || busy) return;
      setBusy(true);
      const ms = Math.min(600_000, Date.now() - startedAt.current);
      try {
        const res = await grade({
          data: {
            cardId: card.row.card_id,
            subject: card.row.subject,
            sub: card.row.sub_subject,
            grade: g,
            ms,
            flagged: flags.isFlagged(card.row.card_id),
          },
        });
        setStreak(res.streak);
        setTodayCards(res.today.cards);
        setGoal(res.today.goal);
        setLastNext(human(res.interval_days));
        setCanUndo(true);
        if (res.interval_days >= 1) setTomorrow((n) => (res.interval_days < 2 ? n + 1 : n));
        // A "save moment": remembered after a long sleep.
        if (g >= 2 && res.elapsed_days >= 5) {
          setSave(`${Math.round(res.elapsed_days)} days later — still there.`);
          window.setTimeout(() => setSave(null), 2600);
        }
      } catch {
        /* offline grading still advances the session */
      }
      if (g >= 2) setRight((n) => n + 1);
      if (g === 0) {
        setAgain((a) => [...a, card.row.card_id]);
        setQueue((q) => [...q, card]);
      }
      startedAt.current = Date.now();
      setFlipped(false);
      setPos((p) => p + 1);
      setBusy(false);
    },
    [queue, pos, busy, grade, flags],
  );

  const stepBack = useCallback(async () => {
    if (!canUndo || pos === 0 || busy) return;
    setBusy(true);
    try {
      await undo();
      setPos((p) => Math.max(0, p - 1));
      setFlipped(false);
      setCanUndo(false);
      setLastNext(null);
      toast.success("Last answer undone");
    } catch {
      toast.error("Could not undo that one");
    }
    setBusy(false);
  }, [canUndo, pos, busy, undo]);

  // Keyboard: space reveals, 1-4 grade, u undoes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        else void answer(2);
        return;
      }
      if (e.key.toLowerCase() === "u") {
        void stepBack();
        return;
      }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        void answer(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flipped, answer, stepBack]);

  if (!open) return null;

  const strength = strengthOf(current?.row.stability);
  const isNew = current?.row.state === "new";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fbf5e9]">
      <header className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8a8072]">
            {title ?? "Smart review"}
          </p>
          <p className="truncate text-lg font-black text-[#23201d]">
            {current ? current.row.subject || "Unsorted" : "Session complete"}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {current && (
            <button
              type="button"
              onClick={() => void stepBack()}
              disabled={!canUndo || pos === 0 || busy}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-[#6d6355] disabled:opacity-40"
              title="Undo last answer (U)"
            >
              <Undo2 size={15} /> Undo
            </button>
          )}
          {current && (
            <FlagButton
              flagged={flags.isFlagged(current.row.card_id)}
              busy={flags.busy}
              onToggle={() =>
                void flags.setFlagged({
                  cardId: current.row.card_id,
                  subject: current.row.subject,
                  sub: current.row.sub_subject,
                  on: !flags.isFlagged(current.row.card_id),
                })
              }
            />
          )}
          {streak !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-black text-[#7a4b16]">
              <Flame size={16} /> {streak}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review"
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#23201d]"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="mx-5 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
        <div
          className="h-full rounded-full bg-[var(--rita-green)] transition-all duration-300"
          style={{ width: `${done ? 100 : progress}%` }}
        />
      </div>

      {current ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 p-5">
          {/* Memory strength for this card */}
          <div className="flex w-full max-w-3xl items-center gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a79c8c]">
              {isNew ? "new card" : current.row.leech ? "fighting you" : "memory"}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.07]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${isNew ? 4 : strength}%`,
                  background: current.row.leech ? "#d98b6a" : "var(--rita-green)",
                }}
              />
            </div>
            <span className="text-[11px] font-bold text-[#a79c8c]">
              {isNew
                ? "first look"
                : `holds ${shortGap(Number(current.row.interval_days) || 0)}`}
            </span>
            {current.row.leech && (
              <button
                type="button"
                onClick={async () => {
                  await suspend({ data: { cardId: current.row.card_id, suspended: true } });
                  toast.success("Card paused — rewrite it when you have a minute");
                  setQueue((q) => q.filter((x) => x.row.card_id !== current.row.card_id));
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[#f6ddd5] px-3 py-1 text-[11px] font-black text-[#7d3421]"
              >
                <PauseCircle size={13} /> Pause it
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="w-full max-w-3xl flex-1"
            style={{ maxHeight: "54vh" }}
            aria-label="Flip card"
          >
            <FlipCard
              flipped={flipped}
              className="h-full min-h-[16rem] w-full"
              front={
                <ReviewFace
                  text={current.card.front}
                  image={current.card.frontImage}
                  cardStyle={current.card.frontStyle}
                  hint="tap or press space"
                />
              }
              back={
                <ReviewFace
                  text={current.card.back}
                  image={current.card.backImage}
                  cardStyle={current.card.backStyle}
                  hint="answer"
                />
              }
            />
          </button>

          {save && (
            <p className="rita-pop inline-flex items-center gap-2 rounded-full bg-[#d8ecdd] px-4 py-2 text-sm font-black text-[#215237]">
              <Sparkles size={15} /> {save}
            </p>
          )}

          {flipped ? (
            <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {GRADES.map((g) => (
                <button
                  key={g.g}
                  type="button"
                  disabled={busy}
                  onClick={() => void answer(g.g)}
                  className="rounded-2xl px-3 py-4 text-center transition-transform active:scale-[0.97] disabled:opacity-60"
                  style={{ background: g.bg, color: g.ink }}
                >
                  <span className="block text-[17px] font-black">{g.label}</span>
                  <span className="block text-[11px] font-bold opacity-70">
                    {current.row.previews ? shortGap(current.row.previews[g.g] ?? 0) : g.hint}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="w-full max-w-3xl rounded-full bg-[var(--rita-green)] py-4 text-[17px] font-semibold text-[color:var(--rita-green-ink)]"
            >
              Show answer
            </button>
          )}

          <p className="text-xs font-bold text-[#a79c8c]">
            {pos + 1} of {queue.length}
            {lastNext && ` · last card comes back ${lastNext}`}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-5">
          <div className="w-full max-w-lg rounded-[32px] border border-black/[0.06] bg-white p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--rita-green)] text-[color:var(--rita-green-ink)]">
              <Check size={26} />
            </span>
            <h2 className="mt-4 font-display text-2xl font-black text-[#23201d]">
              {queue.length} cards reviewed
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#6d6355]">
              {right} answered confidently
              {again.length > 0 && ` · ${again.length} still shaky, they come back soon`}
            </p>
            {tomorrow > 0 && (
              <p className="mt-3 text-sm font-bold text-[#6d6355]">
                {tomorrow} of them return tomorrow — that is the schedule doing its job.
              </p>
            )}
            {streak !== null && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#fbe3c8] px-4 py-2 text-sm font-black text-[#7a4b16]">
                <Flame size={16} /> {streak} day streak · {todayCards}/{goal} today
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-[var(--rita-green)] py-3.5 text-[17px] font-semibold text-[color:var(--rita-green-ink)]"
            >
              Back to my subjects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
