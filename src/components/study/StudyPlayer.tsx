import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  Shuffle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { FlashCardItem } from "@/lib/use-flashcards";
import { scaleText, styleToCss, type CardStyle } from "@/lib/use-flashcards";
import { useCardFlags } from "@/lib/use-card-flags";
import { FlagButton } from "@/components/study/FlagButton";
import { FlipCard } from "@/components/study/FlipCard";

const MUTE_KEY = "rita_study_muted";

/* ---------------------------- sound ---------------------------- */
let ctx: AudioContext | null = null;
function blip(kind: "flip" | "next" | "done", muted: boolean) {
  if (muted || typeof window === "undefined") return;
  setTimeout(() => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = ctx ?? new AC();
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      const notes = kind === "done" ? [523.25, 659.25, 783.99] : kind === "flip" ? [660] : [440];
      notes.forEach((f, i) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        const t = now + i * 0.09;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(kind === "done" ? 0.09 : 0.05, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        osc.connect(gain).connect(ctx!.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    } catch {
      /* audio is a nicety, never a blocker */
    }
  }, 0);
}

/* ---------------------------- player ---------------------------- */
export function StudyPlayer({
  open,
  title,
  cards,
  onClose,
}: {
  open: boolean;
  title: string;
  cards: FlashCardItem[];
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<FlashCardItem[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [dir, setDir] = useState<1 | -1>(1);
  const [anim, setAnim] = useState(0);
  const [muted, setMuted] = useState(false);
  const [done, setDone] = useState(false);
  const touchX = useRef<number | null>(null);
  const flags = useCardFlags();

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(
    (list: FlashCardItem[]) => {
      setQueue(list);
      setPos(0);
      setFlipped(false);
      setKnown([]);
      setMissed([]);
      setDone(false);
    },
    [],
  );

  useEffect(() => {
    if (open) reset(cards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const card = queue[pos];
  const total = queue.length;

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const step = useCallback(
    (delta: 1 | -1) => {
      setDir(delta);
      setAnim((a) => a + 1);
      setFlipped(false);
      setPos((p) => {
        const next = p + delta;
        if (next < 0) return 0;
        if (next >= total) {
          setDone(true);
          return p;
        }
        return next;
      });
    },
    [total],
  );

  const flip = useCallback(() => {
    setFlipped((f) => {
      blip("flip", muted);
      return !f;
    });
  }, [muted]);

  const grade = useCallback(
    (ok: boolean) => {
      if (!card) return;
      if (ok) setKnown((k) => [...k, card.id]);
      else {
        setMissed((m) => [...m, card.id]);
        // push a copy near the end so weak cards come back
        setQueue((q) => [...q, card]);
      }
      blip("next", muted);
      if (pos + 1 >= queue.length + (ok ? 0 : 1)) {
        // handled by step overflow below
      }
      setDir(1);
      setAnim((a) => a + 1);
      setFlipped(false);
      setPos((p) => {
        const limit = ok ? queue.length : queue.length + 1;
        if (p + 1 >= limit) {
          setDone(true);
          return p;
        }
        return p + 1;
      });
    },
    [card, muted, pos, queue.length],
  );

  useEffect(() => {
    if (done) blip("done", muted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      } else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flip, step, onClose]);

  const progress = useMemo(
    () => (total === 0 ? 0 : Math.round(((pos + (done ? 1 : 0)) / total) * 100)),
    [pos, total, done],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fbf5e9]">
      {/* top bar */}
      <div className="flex items-center gap-3 px-4 pt-4 md:px-8 md:pt-6">
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white text-[#5c554b] transition-all duration-100 hover:bg-black/[0.04] active:scale-95 touch-manipulation select-none"
          aria-label="Close study session"
        >
          <X size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold uppercase tracking-[0.16em] text-[#b3aa9c]">
            {title}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.07]">
            <div
              className="h-full rounded-full bg-[#4c9a2a] transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-[13px] font-black tabular-nums text-[#7a736a]">
          {Math.min(pos + 1, total)} / {total}
        </span>
        {card && (
          <FlagButton
            flagged={flags.isFlagged(card.id)}
            busy={flags.busy}
            label={false}
            onToggle={() =>
              void flags.setFlagged({
                cardId: card.id,
                subject: title,
                sub: "",
                on: !flags.isFlagged(card.id),
              })
            }
          />
        )}
        <button
          type="button"
          onClick={toggleMute}
          className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white text-[#5c554b] transition-all duration-100 hover:bg-black/[0.04] active:scale-95 touch-manipulation select-none"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        <button
          type="button"
          onClick={() => {
            reset([...queue].sort(() => Math.random() - 0.5));
            setAnim((a) => a + 1);
          }}
          className="hidden h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-[13px] font-extrabold text-[#5c554b] transition-all duration-100 hover:bg-black/[0.04] active:scale-95 touch-manipulation select-none sm:flex"
        >
          <Shuffle size={15} /> Shuffle
        </button>
      </div>

      {/* card stage */}
      <div className="flex flex-1 items-center justify-center px-4 py-6 md:px-8">
        {done || !card ? (
          <div className="w-full max-w-lg animate-[rita-pop_.35s_ease-out] rounded-[28px] border border-black/[0.06] bg-white p-8 text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
              Session finished
            </p>
            <p className="mt-3 font-display text-[44px] font-black leading-none text-[#23201d]">
              {known.length}
              <span className="text-[20px] text-[#a29a8d]"> / {total} known</span>
            </p>
            <p className="mt-2 text-[14px] font-semibold text-[#7a736a]">
              {missed.length === 0
                ? "Clean run — every card landed."
                : `${missed.length} card${missed.length === 1 ? "" : "s"} need another look.`}
            </p>
            <div className="mt-7 flex flex-col gap-2.5">
              {missed.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const ids = new Set(missed);
                    reset(cards.filter((c) => ids.has(c.id)));
                  }}
                  className="rita-pill h-12 rounded-2xl text-[14px] font-extrabold"
                >
                  Study the ones I missed
                </button>
              )}
              <button
                type="button"
                onClick={() => reset(cards)}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white text-[14px] font-extrabold text-[#23201d] transition-colors hover:bg-black/[0.03]"
              >
                <RotateCcw size={16} /> Start again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-2xl text-[13.5px] font-bold text-[#a29a8d] transition-colors hover:bg-black/[0.04]"
              >
                Back to my subjects
              </button>
            </div>
          </div>
        ) : (
          <div
            key={anim}
            className="w-full max-w-3xl"
            style={{
              animation: `${dir === 1 ? "rita-slide-in-right" : "rita-slide-in-left"} .32s cubic-bezier(.22,.9,.3,1)`,
            }}
            onTouchStart={(e) => {
              touchX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const start = touchX.current;
              const end = e.changedTouches[0]?.clientX ?? null;
              touchX.current = null;
              if (start == null || end == null) return;
              const dx = end - start;
              if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
            }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={flip}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  flip();
                }
              }}
              className="group block w-full cursor-pointer select-none touch-manipulation focus:outline-none"
              aria-label="Flip card"
            >
              <FlipCard
                flipped={flipped}
                className="h-[52vh] min-h-[320px] w-full"
                front={
                  <Face
                    side="Question"
                    text={card.front}
                    image={card.frontImage}
                    style={card.frontStyle}
                    className=""
                  />
                }
                back={
                  <Face
                    side="Answer"
                    text={card.back}
                    image={card.backImage}
                    style={card.backStyle}
                    className=""
                  />
                }
              />
            </div>

            <p className="mt-4 text-center text-[12.5px] font-bold text-[#b3aa9c]">
              Tap the card or press Space to flip · ← → to move
            </p>
          </div>
        )}
      </div>

      {/* bottom controls */}
      {!done && card && (
        <div className="flex items-center justify-center gap-3 px-4 pb-8 md:pb-10">
          <button
            type="button"
            onClick={() => step(-1)}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-black/10 bg-white text-[#5c554b] transition-all duration-100 hover:bg-black/[0.04] active:scale-95 touch-manipulation select-none"
            aria-label="Previous card"
          >
            <ArrowLeft size={18} />
          </button>

          {flipped ? (
            <>
              <button
                type="button"
                onClick={() => grade(false)}
                className="flex h-12 items-center gap-2 rounded-2xl bg-[#d1795e] px-6 text-[14px] font-extrabold text-white transition-all duration-100 hover:opacity-90 active:scale-95 touch-manipulation select-none"
              >
                <RotateCcw size={16} /> Again
              </button>
              <button
                type="button"
                onClick={() => grade(true)}
                className="rita-pill flex h-12 items-center gap-2 rounded-2xl px-7 text-[14px] font-extrabold transition-all duration-100 active:scale-95 touch-manipulation select-none"
              >
                <Check size={17} /> Got it
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={flip}
              className="rita-pill flex h-12 items-center gap-2 rounded-2xl px-8 text-[14px] font-extrabold transition-all duration-100 active:scale-95 touch-manipulation select-none"
            >
              Show answer
            </button>
          )}

          <button
            type="button"
            onClick={() => step(1)}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-black/10 bg-white text-[#5c554b] transition-all duration-100 hover:bg-black/[0.04] active:scale-95 touch-manipulation select-none"
            aria-label="Next card"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function Face({
  side,
  text,
  image,
  style,
  className,
}: {
  side: string;
  text: string;
  image?: string;
  style?: CardStyle;
  className: string;
}) {
  return (
    <div
      className={`h-full w-full flex flex-col items-center justify-center gap-4 rounded-[28px] border border-black/[0.06] bg-white px-8 py-10 text-center shadow-[0_20px_50px_-30px_rgba(35,32,29,0.45)] select-none ${className}`}
    >
      <span className="absolute left-6 top-5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#c8c0b2]">
        {side}
      </span>
      {image && (
        <img
          src={image}
          alt=""
          className="max-h-[58%] w-auto max-w-full rounded-2xl object-contain pointer-events-none"
        />
      )}
      <p
        className={`max-w-[46rem] whitespace-pre-wrap px-2 text-[#23201d] select-none ${style ? "" : scaleText(text)}`}
        style={styleToCss(style)}
      >
        {text}
      </p>
    </div>
  );
}
