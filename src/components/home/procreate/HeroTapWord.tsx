import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { StartLearningLink } from "@/components/StartLearningLink";
import { VoiceOrb, type OrbLevels } from "@/components/rita-live/VoiceOrb";
import { wordTapSound } from "@/components/rita-study/tech-sound";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

type Word = {
  term: string;
  lang: "German" | "English";
  meaning: string;
  say: string;
  /** Position inside the stage, in percent, and a small hand-set tilt. */
  at: { left?: string; right?: string; top: string };
  rot: number;
};

// Meanings and pronunciation (in Arabic letters) are what Rita's tap-a-word window gives.
const WORDS: Word[] = [
  {
    term: "Guten Morgen",
    lang: "German",
    meaning: "صباح الخير",
    say: "غوتن مورغن",
    at: { left: "3%", top: "12%" },
    rot: -4,
  },
  {
    term: "Danke",
    lang: "German",
    meaning: "شكراً",
    say: "دانكه",
    at: { left: "13%", top: "70%" },
    rot: 3,
  },
  {
    term: "Wie geht's?",
    lang: "German",
    meaning: "كيف حالك؟",
    say: "في غيتس",
    at: { right: "3%", top: "10%" },
    rot: 4,
  },
  {
    term: "Nice to meet you",
    lang: "English",
    meaning: "فرصة سعيدة",
    say: "نايس تو ميت يو",
    at: { right: "8%", top: "74%" },
    rot: -3,
  },
];

/** First screen: the promise, and Rita's own orb with words you can tap, just like in a call. */
export function HeroTapWord() {
  const [active, setActive] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [speaking, setSpeaking] = useState(false);
  const levels = useRef<OrbLevels>({ input: 0, output: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slot = useRef<HTMLDivElement>(null);

  // While Rita "says" the word, feed the orb a gentle, speech-like level.
  useEffect(() => {
    if (!speaking) {
      levels.current.output = 0;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      levels.current.output = 0.32 + 0.22 * Math.abs(Math.sin(t * 6.1)) + 0.1 * Math.sin(t * 13);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function pick(index: number, chip?: HTMLElement) {
    // The tap itself lets Safari play the sound; the chip gives a small springy pop.
    wordTapSound(index);
    if (chip) {
      chip.classList.remove("rh-chip-pop");
      void chip.offsetWidth;
      chip.classList.add("rh-chip-pop");
    }
    setActive(index);
    setTouched(true);
    setSpeaking(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSpeaking(false), 1900);
    // Bring the answer into view if the stage pushed it below the fold.
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      slot.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" }),
    );
  }

  const word = active === null ? null : WORDS[active];
  const isAdded = active !== null && added.has(active);

  return (
    // The hero's words are English: they read left to right even when the site is in Arabic, so
    // full stops and question marks stay on the right side (the Arabic meaning sets its own).
    <section
      dir="ltr"
      lang="en"
      className="relative mx-auto max-w-[1240px] px-5 pb-6 pt-[96px] md:px-10 md:pt-[104px]"
    >
      <div className="text-center">
        <h1 className="edith-in rh-hero-title" style={delay(60)}>
          Say it out loud.
          <br />
          <span className="rita-accent relative inline-block">
            Keep it for good.
            <svg
              aria-hidden="true"
              viewBox="0 0 400 22"
              preserveAspectRatio="none"
              className="absolute -bottom-[0.14em] left-0 h-[0.2em] w-full"
            >
              <path
                className="rh-draw"
                d="M4 15 C 70 3, 130 20, 200 11 S 330 5, 396 13"
                fill="none"
                stroke="var(--pp-accent)"
                strokeWidth="7"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>
        <p
          className="edith-in rh-hero-lead mx-auto mt-5"
          style={{ ...delay(140), color: "var(--pp-muted)" }}
        >
          Rita is a voice teacher for English and German who explains in Arabic. Every word you ask
          about can become a flashcard.
        </p>
        <div
          className="edith-in rh-hero-cta mt-6 flex flex-wrap items-center justify-center gap-3"
          style={delay(220)}
        >
          <StartLearningLink className="rita-btn rita-btn-primary">
            Start learning
          </StartLearningLink>
          <Link to="/rita" className="rita-btn rita-btn-secondary">
            Talk to Rita
          </Link>
        </div>
      </div>

      <div
        className="edith-in relative mx-auto mt-4 h-[320px] w-full max-w-[840px] overflow-hidden md:mt-2 md:h-[360px]"
        style={delay(340)}
      >
        <div aria-hidden="true" className="rh-rings pointer-events-none absolute inset-0">
          {[250, 390, 550, 730].map((size) => (
            <span
              key={size}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: size,
                height: size,
                transform: "translate(-50%,-50%)",
                border: "1px solid var(--pp-line)",
              }}
            />
          ))}
        </div>

        {/* The wrapper places the orb (the orb itself is position: relative, so it cannot be
            centred with absolute classes of its own; in Arabic it slid to one side). */}
        <div className="rh-hero-orb pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <VoiceOrb
            levelsRef={levels}
            mode={speaking ? "speaking" : "idle"}
            label="Rita's voice"
            className="w-full"
          />
        </div>

        {WORDS.map((item, index) => (
          <button
            key={item.term}
            type="button"
            aria-pressed={active === index}
            aria-label={`${item.term}, ${item.lang}. Tap for the meaning.`}
            onClick={(event) => pick(index, event.currentTarget)}
            className={`rh-chip absolute ${active === index ? "rh-chip-on" : ""}`}
            style={{ ...item.at, "--rot": `${item.rot}deg` } as CSSProperties}
          >
            {item.term}
            {!touched && index === 0 && <span aria-hidden="true" className="rh-ping" />}
          </button>
        ))}
      </div>

      <div
        ref={slot}
        className="mx-auto min-h-[150px] max-w-[760px] md:min-h-[116px]"
        aria-live="polite"
      >
        {word ? (
          <div
            key={active}
            className="rh-pop rh-hero-answer flex flex-col items-center gap-3 px-5 py-4 md:flex-row md:justify-between md:gap-6"
            style={{ background: "#ffffff", border: "1px solid var(--pp-ink)" }}
          >
            <div className="text-center md:text-start">
              <p className="text-[24px] font-bold leading-tight" style={{ color: "var(--pp-ink)" }}>
                {word.term}
              </p>
              <p
                className="text-[12.5px] font-bold uppercase tracking-[0.08em]"
                style={{ color: "var(--pp-muted)" }}
              >
                {word.lang}
              </p>
            </div>
            <div className="text-center" dir="rtl" lang="ar">
              <p className="text-[28px] font-bold leading-tight" style={{ color: "var(--pp-ink)" }}>
                {word.meaning}
              </p>
              <p className="text-[15px]" style={{ color: "var(--pp-muted)" }}>
                النطق: {word.say}
              </p>
            </div>
            <button
              type="button"
              disabled={isAdded}
              onClick={() => setAdded((current) => new Set(current).add(active as number))}
              className="rita-btn rita-btn-primary rita-btn-sm shrink-0"
              style={isAdded ? { opacity: 0.6 } : undefined}
            >
              {isAdded ? "Added to My words ✓" : "+ My words"}
            </button>
          </div>
        ) : (
          <p className="pt-6 text-center text-[16px]" style={{ color: "var(--pp-muted)" }}>
            Tap a word. That is how Rita teaches.
          </p>
        )}
      </div>
    </section>
  );
}
