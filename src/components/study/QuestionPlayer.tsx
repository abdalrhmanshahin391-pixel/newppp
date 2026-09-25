import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import type { StudyQuestion } from "@/lib/use-study-questions";

const MUTE_KEY = "rita_study_muted";

let ctx: AudioContext | null = null;
function blip(kind: "right" | "wrong" | "done", muted: boolean) {
  if (muted || typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new AC();
    void ctx.resume();
    const now = ctx.currentTime;
    const notes = kind === "done" ? [523.25, 659.25, 783.99] : kind === "right" ? [660, 880] : [220];
    notes.forEach((f, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const t = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  } catch {
    /* sound is a nicety */
  }
}

function shuffled<T>(list: T[]) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function QuestionPlayer({
  open,
  title,
  questions,
  shuffle = false,
  onClose,
}: {
  open: boolean;
  title: string;
  questions: StudyQuestion[];
  shuffle?: boolean;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<StudyQuestion[]>([]);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
  }, []);

  const restart = useCallback(() => {
    setQueue(shuffle ? shuffled(questions) : [...questions]);
    setPos(0);
    setPicked(null);
    setScore(0);
  }, [questions, shuffle]);

  useEffect(() => {
    if (open) restart();
  }, [open, restart]);

  const current = queue[pos];
  const done = open && queue.length > 0 && pos >= queue.length;
  const progress = useMemo(
    () => (queue.length ? Math.round((Math.min(pos, queue.length) / queue.length) * 100) : 0),
    [pos, queue.length],
  );

  if (!open) return null;

  const choose = (letter: string, correct: boolean) => {
    if (picked) return;
    setPicked(letter);
    if (correct) setScore((s) => s + 1);
    blip(correct ? "right" : "wrong", muted);
  };

  const next = () => {
    setPicked(null);
    setPos((p) => {
      const n = p + 1;
      if (n >= queue.length) blip("done", muted);
      return n;
    });
  };

  const toggleMute = () => {
    setMuted((m) => {
      const n = !m;
      try {
        window.localStorage.setItem(MUTE_KEY, n ? "1" : "0");
      } catch {
        /* ignore */
      }
      return n;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fbf5e9]">
      <header className="flex items-center gap-3 border-b border-black/5 px-4 py-3 md:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
            Question round
          </p>
          <p className="truncate text-[15px] font-black text-[#23201d]">{title}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[12px] font-extrabold text-[#6d675e]">
          {Math.min(pos + (done ? 0 : 1), queue.length)} / {queue.length}
        </span>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="grid h-9 w-9 place-items-center rounded-xl text-[#a29a8d] transition-colors hover:bg-black/[0.05]"
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-xl text-[#a29a8d] transition-colors hover:bg-black/[0.05]"
        >
          <X size={18} />
        </button>
      </header>

      <div className="h-1.5 w-full bg-black/[0.06]">
        <div
          className="h-full rounded-r-full bg-[var(--rita-green,#2f6f4e)] transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          {queue.length === 0 && (
            <p className="mt-20 text-center text-[15px] font-bold text-[#a29a8d]">
              No questions here yet.
            </p>
          )}

          {done && queue.length > 0 && (
            <div className="mt-10 rounded-3xl border border-black/[0.06] bg-white p-8 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
                Round finished
              </p>
              <p className="mt-3 text-[46px] font-black leading-none text-[#23201d]">
                {score}
                <span className="text-[20px] text-[#a29a8d]">/{queue.length}</span>
              </p>
              <p className="mt-2 text-[13.5px] font-semibold text-[#a29a8d]">
                {score === queue.length
                  ? "Perfect round. Rita is impressed."
                  : "Every miss is a topic worth another look."}
              </p>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={restart}
                  className="rita-pill flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-[13.5px] font-extrabold"
                >
                  <RotateCcw size={16} /> Go again
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-6 text-[13.5px] font-extrabold text-[#23201d] hover:bg-black/[0.03]"
                >
                  Back to my subjects
                </button>
              </div>
            </div>
          )}

          {!done && current && (
            <div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_18px_40px_-32px_rgba(0,0,0,0.5)] md:p-8">
              <p className="text-[18px] font-black leading-snug text-[#23201d] md:text-[21px]">
                {current.stem}
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {current.options.map((o) => {
                  const revealed = picked !== null;
                  const isPicked = picked === o.letter;
                  const good = revealed && o.is_correct;
                  const bad = revealed && isPicked && !o.is_correct;
                  return (
                    <button
                      key={o.letter}
                      type="button"
                      disabled={revealed}
                      onClick={() => choose(o.letter, o.is_correct)}
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                        good
                          ? "border-[#6ab887] bg-[#eaf6ee]"
                          : bad
                            ? "border-[#d1795e] bg-[#fbeae4]"
                            : "border-black/10 bg-white hover:-translate-y-0.5 hover:border-black/20"
                      }`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.5px] font-black ${
                          good
                            ? "bg-[#6ab887] text-white"
                            : bad
                              ? "bg-[#d1795e] text-white"
                              : "bg-[#f2ece0] text-[#6d675e]"
                        }`}
                      >
                        {good ? <Check size={15} strokeWidth={3} /> : o.letter}
                      </span>
                      <span className="pt-0.5 text-[14.5px] font-semibold leading-snug text-[#23201d]">
                        {o.body}
                      </span>
                    </button>
                  );
                })}
              </div>

              {picked !== null && (
                <div className="mt-6 rounded-2xl border border-black/[0.06] bg-[#fbf5e9] p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
                    Why
                  </p>
                  <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[#3c3730]">
                    {current.correct_explanation || "No explanation was saved for this one."}
                  </p>
                  {current.options
                    .filter((o) => !o.is_correct && o.wrong_reason)
                    .map((o) => (
                      <p key={o.letter} className="mt-2 text-[13px] font-medium text-[#6d675e]">
                        <span className="font-black">{o.letter}.</span> {o.wrong_reason}
                      </p>
                    ))}
                  {current.reference_note && (
                    <p className="mt-3 border-t border-black/[0.06] pt-3 text-[12px] font-semibold text-[#a29a8d]">
                      {current.reference_note}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    className="rita-pill mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13.5px] font-extrabold"
                  >
                    {pos + 1 >= queue.length ? "See my score" : "Next question"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
