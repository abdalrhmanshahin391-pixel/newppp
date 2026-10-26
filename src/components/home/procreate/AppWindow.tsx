import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { BookOpen, Check, Languages, Lock, Mic, RotateCcw } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

const ink = { color: "var(--pp-ink)" } as const;
const muted = { color: "var(--pp-muted)" } as const;

function prefersCalm() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Sample lessons of the A1 path. The first two are finished, the third is the one in progress. */
const LESSONS = [
  "Hello & Goodbye",
  "Me & You",
  "Thank you & Please",
  "Yes, No & Great idea!",
  "I'm busy",
];
const CURRENT = 2;
const DONE = 2;

const WORDS: { en: string; ar: string }[] = [
  { en: "Thank you", ar: "شكرًا" },
  { en: "Please", ar: "من فضلك" },
  { en: "You're welcome", ar: "عفوًا" },
];

/** Steps of the scripted story: 1 path fills, 2 current lesson, 3 words, 4 Rita listens. */
const LAST_STEP = 4;
const STEP_AT = [0, 250, 1150, 2000, 2900];

const NAV = [
  { label: "Lessons", Icon: BookOpen, on: true },
  { label: "My words", Icon: Languages, on: false },
  { label: "Talk to Rita", Icon: Mic, on: false },
];

function PathNode({ index, step }: { index: number; step: number }) {
  const finished = index < DONE && step >= 1;
  const current = index === CURRENT && step >= 2;
  const delay = finished ? `${index * 160}ms` : "0ms";
  return (
    <span
      aria-hidden="true"
      className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-[background-color,border-color,box-shadow] duration-300"
      style={{
        transitionDelay: delay,
        background: finished
          ? "var(--pp-accent)"
          : current
            ? "var(--pp-accent-soft)"
            : "var(--pp-grey)",
        border: `3px solid ${finished || current ? "var(--pp-ink)" : "var(--pp-line)"}`,
        boxShadow: current ? "0 0 0 5px rgba(43,109,240,0.25)" : "none",
        color: finished ? "var(--pp-on-accent)" : "var(--pp-muted)",
      }}
    >
      {index < DONE ? (
        <>
          <Check
            size={20}
            strokeWidth={3}
            className="absolute transition-[opacity,transform] duration-300"
            style={{
              transitionDelay: delay,
              opacity: finished ? 1 : 0,
              transform: finished ? "scale(1)" : "scale(0.4)",
            }}
          />
          <Lock
            size={16}
            className="absolute transition-opacity duration-200"
            style={{ opacity: finished ? 0 : 1 }}
          />
        </>
      ) : index === CURRENT ? (
        <BookOpen size={20} style={{ color: current ? "var(--pp-ink)" : "var(--pp-muted)" }} />
      ) : (
        <Lock size={16} />
      )}
    </span>
  );
}

/**
 * A product window that starts tilted and flattens as it scrolls into view, then tells a short
 * story: the path fills, the lesson in progress shows, two words are saved, Rita listens. Built
 * from real markup with sample content (no screenshots, no counts). Calm motion shows the
 * finished window flat.
 */
export function AppWindow() {
  const head = useReveal<HTMLDivElement>();
  const stage = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  const started = useRef(false);
  const [step, setStep] = useState(LAST_STEP);
  const [run, setRun] = useState(0);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const play = useCallback(() => {
    clearTimers();
    if (prefersCalm()) {
      setStep(LAST_STEP);
      return;
    }
    setStep(0);
    STEP_AT.forEach((at, index) => {
      if (index === 0) return;
      timers.current.push(window.setTimeout(() => setStep(index), at));
    });
  }, []);

  // Tilt follows scroll: 0 when the window sits in the middle of the screen. Only transform is written.
  useEffect(() => {
    const el = stage.current;
    const win = frame.current;
    if (!el || !win) return;
    const calm = prefersCalm();
    if (!calm) setStep(0);
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      const start = vh * 0.95;
      const end = vh * 0.25;
      const p = Math.max(0, Math.min(1, (start - top) / (start - end)));
      const eased = 1 - Math.pow(1 - p, 3);
      const wide = window.innerWidth >= 768;
      const tilt = calm ? 0 : (wide ? 24 : 0) * (1 - eased);
      const scale = calm ? 1 : (wide ? 0.9 : 0.96) + (wide ? 0.1 : 0.04) * eased;
      win.style.transform = `rotateX(${tilt.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      if (!calm && p >= 0.85 && !started.current) {
        started.current = true;
        play();
      }
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      clearTimers();
    };
  }, [play]);

  useEffect(() => {
    if (run > 0) play();
  }, [run, play]);

  const progress = step >= 2 ? 60 : 0;

  return (
    <section
      aria-labelledby="window-heading"
      className="mx-auto w-full max-w-[1180px] px-5 pb-20 md:px-10 md:pb-28"
    >
      <div
        ref={head.ref}
        className={`rita-reveal mx-auto max-w-[40rem] text-center ${head.shown ? "rita-reveal-in" : ""}`}
      >
        <h2
          id="window-heading"
          className="text-[34px] font-bold leading-[1.08] md:text-[48px]"
          style={ink}
        >
          Your lessons, your words, and Rita.
        </h2>
        <p className="mt-4 text-[17px] leading-[1.6] md:text-[19px]" style={muted}>
          One place to pick up where you stopped, keep the words you asked about, and talk it
          through out loud.
        </p>
      </div>

      <div
        ref={stage}
        className="mt-12 md:mt-16"
        style={{ perspective: "1600px" } as CSSProperties}
      >
        <p className="sr-only">
          Sample screen. The lessons list shows a path of five A1 lessons. The first two are done,
          the third, Thank you and Please, is in progress. Saved words: Thank you, Please and You're
          welcome. Rita is ready to listen.
        </p>
        <div
          ref={frame}
          aria-hidden="true"
          className="overflow-hidden rounded-[20px] will-change-transform"
          style={{
            border: "2px solid var(--pp-ink)",
            background: "#ffffff",
            transformOrigin: "50% 0%",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ background: "var(--pp-ink)", color: "#ffffff" }}
          >
            <span className="text-[14px] font-bold">Uzyra</span>
            <span className="text-[12.5px] font-medium" style={{ opacity: 0.75 }}>
              Sample screen
            </span>
          </div>

          <div className="grid min-h-[30rem] grid-cols-[minmax(0,1fr)] md:grid-cols-[13.5rem_minmax(0,1fr)]">
            <nav
              className="hidden flex-col gap-1 p-3 md:flex"
              style={{ borderRight: "2px solid var(--pp-line)", background: "var(--pp-grey)" }}
            >
              {NAV.map(({ label, Icon, on }) => (
                <span
                  key={label}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14.5px] font-semibold"
                  style={
                    on
                      ? { background: "#ffffff", border: "2px solid var(--pp-ink)", ...ink }
                      : { border: "2px solid transparent", ...muted }
                  }
                >
                  <Icon size={17} />
                  {label}
                </span>
              ))}
            </nav>

            <div className="grid content-start gap-5 p-4 md:p-6">
              <div
                className="rounded-[14px] p-4"
                style={{
                  border: "2px solid var(--pp-ink)",
                  background: step >= 2 ? "var(--pp-accent-soft)" : "#ffffff",
                  transition: "background-color 300ms var(--pp-ease, ease)",
                }}
              >
                <p className="text-[13.5px] font-semibold" style={muted}>
                  Pick up where you stopped
                </p>
                <p className="mt-1 text-[20px] font-bold leading-tight md:text-[22px]" style={ink}>
                  Thank you &amp; Please
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-2.5 flex-1 overflow-hidden rounded-md"
                    style={{ border: "2px solid var(--pp-ink)", background: "#ffffff" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${progress}%`,
                        background: "var(--pp-accent)",
                        transition: "width 700ms var(--pp-ease, ease)",
                      }}
                    />
                  </div>
                  <span className="text-[13.5px] font-semibold" style={ink}>
                    Lesson 3 of 5
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[13.5px] font-semibold" style={muted}>
                  A1 path (sample lessons)
                </p>
                <ol className="mt-3 grid grid-cols-5 gap-2">
                  {LESSONS.map((title, index) => (
                    <li key={title} className="flex min-w-0 flex-col items-center text-center">
                      <PathNode index={index} step={step} />
                      <span
                        className="mt-2 hidden text-[12.5px] font-semibold leading-snug sm:block"
                        style={ink}
                      >
                        {title}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <p className="text-[13.5px] font-semibold" style={muted}>
                  Words you asked about
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {WORDS.map((word, index) => (
                    <span
                      key={word.en}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[14px] font-semibold"
                      style={{
                        border: "2px solid var(--pp-ink)",
                        background: "#ffffff",
                        opacity: step >= 3 ? 1 : 0,
                        transform: step >= 3 ? "translateY(0)" : "translateY(-10px)",
                        transition: `opacity 250ms var(--pp-ease, ease) ${index * 160}ms, transform 250ms var(--pp-ease, ease) ${index * 160}ms`,
                        ...ink,
                      }}
                    >
                      <span lang="en">{word.en}</span>
                      <span
                        lang="ar"
                        dir="rtl"
                        className="font-bold"
                        style={{ color: "var(--pp-accent-text)" }}
                      >
                        {word.ar}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="mt-1 flex items-center gap-3 rounded-[14px] px-4 py-3"
                style={{ background: "var(--pp-ink)", color: "#ffffff" }}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{ background: "var(--pp-accent)", color: "var(--pp-on-accent)" }}
                >
                  <Mic size={18} />
                </span>
                <span className="text-[14.5px] font-semibold">
                  {step >= 4 ? "Rita is listening" : "Talk to Rita"}
                </span>
                <span className="ms-auto flex h-6 items-center gap-1">
                  {[0, 1, 2, 3, 4].map((bar) => (
                    <span
                      key={bar}
                      className={step >= 4 ? "window-wave" : ""}
                      style={{
                        display: "block",
                        width: 4,
                        height: step >= 4 ? 22 : 6,
                        borderRadius: 2,
                        background: step >= 4 ? "var(--pp-accent)" : "rgba(255,255,255,0.5)",
                        animationDelay: `${bar * 120}ms`,
                        transformOrigin: "50% 50%",
                        transition: "height 200ms var(--pp-ease, ease)",
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <p className="text-[13.5px]" style={muted}>
          Sample lessons and words. Your own path appears when you start.
        </p>
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-semibold"
          style={{
            border: "2px solid var(--pp-ink)",
            background: "#ffffff",
            color: "var(--pp-ink)",
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Replay
        </button>
      </div>
    </section>
  );
}
