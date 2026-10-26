import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AudioLines, Languages, MessageSquareQuote, Pause, RotateCcw, Zap } from "lucide-react";
import { useReveal } from "@/hooks/useReveal";

const ink = { color: "var(--pp-ink)" } as const;
const muted = { color: "var(--pp-muted)" } as const;
const ringed: CSSProperties = {
  border: "2px solid var(--pp-ink)",
  background: "var(--uz-paper, #ffffff)",
};

function prefersCalm() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ---------- 1. a sentence that mixes three languages, heard word by word ---------- */

type Lang = "en" | "ar" | "de";
type Word = { text: string; lang: Lang };

const HEARD: Word[] = [
  { text: "Rita,", lang: "en" },
  { text: "how", lang: "en" },
  { text: "do", lang: "en" },
  { text: "I", lang: "en" },
  { text: "say", lang: "en" },
  { text: "صباح الخير", lang: "ar" },
  { text: "in", lang: "en" },
  { text: "German?", lang: "de" },
];
const REPLY: Word[] = [
  { text: "Guten", lang: "de" },
  { text: "Morgen.", lang: "de" },
  { text: "يعني", lang: "ar" },
  { text: "صباح الخير", lang: "ar" },
];
const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ar", label: "العربية" },
  { id: "de", label: "Deutsch" },
];
const HEARD_TEXT = HEARD.map((w) => w.text).join(" ");
const REPLY_TEXT = REPLY.map((w) => w.text).join(" ");
/** The reply starts when the learner is two words from the end of the question. */
const REPLY_STARTS_AT = HEARD.length - 2;

/** Consecutive words of one language share a span, so Arabic keeps its own reading direction. */
function Heard({ words, partialLast }: { words: Word[]; partialLast: boolean }) {
  const groups: { lang: Lang; words: { text: string; last: boolean }[] }[] = [];
  words.forEach((word, index) => {
    const last = index === words.length - 1;
    const group = groups[groups.length - 1];
    if (group && group.lang === word.lang) group.words.push({ text: word.text, last });
    else groups.push({ lang: word.lang, words: [{ text: word.text, last }] });
  });
  return (
    <>
      {groups.map((group, groupIndex) => (
        <span
          key={`${group.lang}-${groupIndex}`}
          dir={group.lang === "ar" ? "rtl" : "ltr"}
          lang={group.lang}
          className="inline-block"
          style={{ marginRight: "0.4em" }}
        >
          {group.words.map((word, wordIndex) => {
            const partial = partialLast && word.last;
            return (
              <span key={`${word.text}-${wordIndex}`}>
                {wordIndex > 0 ? " " : ""}
                <span
                  style={{
                    borderBottom: partial ? "2px dashed var(--pp-accent)" : "2px solid transparent",
                    color: partial ? "var(--pp-muted)" : "var(--pp-ink)",
                  }}
                >
                  {word.text}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}

function LiveTranscript() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const [heard, setHeard] = useState(0);
  const [replied, setReplied] = useState(0);
  const [run, setRun] = useState(0);
  const timer = useRef<number | null>(null);

  const play = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    if (prefersCalm()) {
      setHeard(HEARD.length);
      setReplied(REPLY.length);
      return;
    }
    setHeard(0);
    setReplied(0);
    let tick = 0;
    timer.current = window.setInterval(() => {
      tick += 1;
      setHeard(Math.min(HEARD.length, tick));
      setReplied(Math.max(0, Math.min(REPLY.length, tick - REPLY_STARTS_AT)));
      if (tick >= HEARD.length + REPLY.length + 1 && timer.current) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    }, 340);
  }, []);

  useEffect(() => {
    if (shown) play();
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [shown, run, play]);

  const current = heard > 0 ? HEARD[Math.min(heard, HEARD.length) - 1].lang : null;
  const finishing = heard >= HEARD.length;

  return (
    <div
      ref={ref}
      className={`rita-reveal rounded-[20px] p-5 md:p-7 ${shown ? "rita-reveal-in" : ""}`}
      style={ringed}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-md px-2 py-0.5 text-[13px] font-semibold"
            style={{ background: "var(--pp-ink)", color: "var(--uz-on-ink, #ffffff)" }}
          >
            Demo
          </span>
          <span className="text-[14px] font-medium" style={muted}>
            A scripted example, not a recording
          </span>
        </div>
        <div className="flex items-center gap-2" aria-hidden="true">
          {LANGS.map((l) => (
            <span
              key={l.id}
              lang={l.id}
              className="rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-colors"
              style={{
                border: "2px solid var(--pp-ink)",
                background: current === l.id ? "var(--pp-accent)" : "var(--uz-paper, #ffffff)",
                color: current === l.id ? "var(--pp-on-accent)" : "var(--pp-ink)",
              }}
            >
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <p className="sr-only">
        You say: {HEARD_TEXT} Rita replies: {REPLY_TEXT}
      </p>

      <div aria-hidden="true" className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="min-h-[7.5rem]">
          <p className="text-[14px] font-semibold" style={muted}>
            What Rita hears, as you speak
          </p>
          <p className="mt-2 text-[22px] font-semibold leading-[1.5] md:text-[26px]" style={ink}>
            <Heard words={HEARD.slice(0, heard)} partialLast={!finishing} />
          </p>
        </div>
        <div
          className="min-h-[7.5rem] md:border-s-2 md:ps-5"
          style={{ borderColor: "var(--pp-line)" }}
        >
          <p className="text-[14px] font-semibold" style={muted}>
            Rita's reply, already on its way
          </p>
          <p className="mt-2 text-[22px] font-semibold leading-[1.5] md:text-[26px]" style={ink}>
            <Heard words={REPLY.slice(0, replied)} partialLast={false} />
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[44rem] text-[15px] leading-[1.55]" style={muted}>
          A dashed word is still being heard and can change. Rita starts to answer before the
          question is over, and Arabic, English and German can sit in one sentence.
        </p>
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-semibold"
          style={{
            border: "2px solid var(--pp-ink)",
            background: "var(--uz-paper, #ffffff)",
            color: "var(--pp-ink)",
          }}
        >
          <RotateCcw size={15} aria-hidden="true" /> Replay
        </button>
      </div>
    </div>
  );
}

/* ---------- 2. one turn: the stages overlap instead of queueing ---------- */

type Bar = { from: number; to: number; tone: "ink" | "accent" | "soft" };
type Lane = { label: string; bars: Bar[] };

const OVERLAP: Lane[] = [
  { label: "You speak", bars: [{ from: 0, to: 38, tone: "ink" }] },
  { label: "Rita listens", bars: [{ from: 1, to: 40, tone: "soft" }] },
  { label: "Decides your turn is over", bars: [{ from: 36, to: 46, tone: "soft" }] },
  { label: "Thinks of the answer", bars: [{ from: 44, to: 66, tone: "soft" }] },
  { label: "Speaks", bars: [{ from: 52, to: 100, tone: "accent" }] },
];
const QUEUE: Lane[] = [
  { label: "You speak", bars: [{ from: 0, to: 38, tone: "ink" }] },
  { label: "Listens, then decides", bars: [{ from: 38, to: 52, tone: "soft" }] },
  { label: "Thinks the whole answer", bars: [{ from: 52, to: 80, tone: "soft" }] },
  { label: "Then speaks", bars: [{ from: 80, to: 100, tone: "accent" }] },
];

function toneStyle(tone: Bar["tone"]): CSSProperties {
  if (tone === "ink") return { background: "var(--pp-ink)" };
  if (tone === "accent")
    return { background: "var(--pp-accent)", border: "2px solid var(--pp-ink)" };
  return { background: "var(--pp-accent-soft)", border: "2px solid var(--pp-ink)" };
}

function LaneRows({ lanes, shown }: { lanes: Lane[]; shown: boolean }) {
  return (
    <ul className="grid gap-2.5">
      {lanes.map((lane, laneIndex) => (
        <li
          key={lane.label}
          className="grid items-center gap-1 md:grid-cols-[13.5rem_1fr] md:gap-4"
        >
          <span className="text-[14.5px] font-semibold" style={ink}>
            {lane.label}
          </span>
          <span
            aria-hidden="true"
            className="relative block h-7 rounded-md"
            style={{ background: "var(--pp-grey)" }}
          >
            {lane.bars.map((bar) => (
              <span
                key={`${bar.from}-${bar.to}`}
                className="hood-bar absolute inset-y-0 rounded-md"
                style={{
                  insetInlineStart: `${bar.from}%`,
                  width: shown ? `${bar.to - bar.from}%` : "0%",
                  transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
                  transitionDelay: `${laneIndex * 110}ms`,
                  ...toneStyle(bar.tone),
                }}
              />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TurnTimeline() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`rita-reveal rounded-[20px] p-5 md:p-7 ${shown ? "rita-reveal-in" : ""}`}
      style={ringed}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[22px] font-bold tracking-[-0.02em]" style={ink}>
          One turn of conversation
        </h3>
        <p className="text-[14px] font-medium" style={muted}>
          Illustration of the idea, not to scale
        </p>
      </div>

      <p className="mt-5 text-[15px] font-semibold" style={ink}>
        Rita: the steps overlap
      </p>
      <div className="mt-3">
        <LaneRows lanes={OVERLAP} shown={shown} />
      </div>

      <p className="mt-7 text-[15px] font-semibold" style={muted}>
        A voice assistant that waits for each step
      </p>
      <div className="mt-3">
        <LaneRows lanes={QUEUE} shown={shown} />
      </div>

      <p className="mt-6 max-w-[46rem] text-[15px] leading-[1.6]" style={muted}>
        Words are recognised while you talk, the decision that you have finished is made on a short
        pause, and the first words of the answer go to the voice as soon as they exist. The gap you
        feel is the gap between the two last bars.
      </p>
    </div>
  );
}

/* ---------- 3. what is built in ---------- */

function Spec({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="rounded-2xl p-5" style={{ background: "var(--pp-grey)" }}>
      <span aria-hidden="true" style={ink}>
        {icon}
      </span>
      <h3 className="mt-3 text-[18px] font-bold leading-snug" style={ink}>
        {title}
      </h3>
      <p className="mt-2 text-[15.5px] leading-[1.6]" style={muted}>
        {children}
      </p>
    </li>
  );
}

function SpecGrid() {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      <Spec icon={<AudioLines size={22} />} title="Hears words as you say them">
        Speech is recognised in a continuous stream, so Rita does not wait for you to stop before
        she starts to understand.
      </Spec>
      <Spec icon={<Pause size={22} />} title="A pause is not the end">
        She tells a thinking pause from a finished sentence, so she does not cut in while you search
        for the word.
      </Spec>
      <Spec icon={<Zap size={22} />} title="Starts speaking early, stops when you do">
        The answer is sent to the voice word by word, and it is cancelled the moment you talk over
        her.
      </Spec>
      <Spec icon={<Languages size={22} />} title="Arabic, English and German together">
        Built for learners who mix languages in one sentence, and who ask for a switch in the middle
        of a lesson.
      </Spec>
      <Spec icon={<MessageSquareQuote size={22} />} title="Explains in Jordanian Arabic">
        Short spoken explanations with the foreign word set apart, so you can tap it and keep it as
        a flashcard.
      </Spec>
      <li
        className="rounded-2xl p-5"
        style={{ background: "var(--pp-ink)", color: "var(--uz-on-ink, #ffffff)" }}
        aria-label="Measured: about 75 milliseconds to first sound from the voice engine"
      >
        <p
          className="text-[14px] font-semibold"
          style={{ color: "var(--uz-on-ink-muted, rgba(255,255,255,0.72))" }}
        >
          Measured
        </p>
        <p
          className="mt-2 font-bold leading-none tracking-[-0.03em]"
          style={{ fontSize: "clamp(2.6rem, 5vw, 3.4rem)", fontVariantNumeric: "tabular-nums" }}
        >
          ≈75<span className="ms-1 text-[20px] font-semibold">ms</span>
        </p>
        <p
          className="mt-3 text-[14.5px] leading-[1.55]"
          style={{ color: "var(--uz-on-ink-muted, rgba(255,255,255,0.8))" }}
        >
          Median time for the voice engine alone to produce its first sound, in Arabic and German,
          on 11 October 2026 (Europe). It is not the delay you hear end to end.
        </p>
      </li>
    </ul>
  );
}

/** Home page band: how the voice works, with one measured number, stated with its limits. */
export function UnderTheHood() {
  const head = useReveal<HTMLElement>();
  return (
    <section
      aria-labelledby="hood-heading"
      className="mx-auto w-full max-w-[1180px] px-5 pb-20 md:px-8 md:pb-28"
    >
      <header
        ref={head.ref}
        className={`rita-reveal mx-auto max-w-[780px] text-center ${head.shown ? "rita-reveal-in" : ""}`}
      >
        <p className="text-[16px] font-semibold" style={muted}>
          Under the hood
        </p>
        <h2
          id="hood-heading"
          className="mt-3 font-bold leading-[1.04] tracking-[-0.035em]"
          style={{ fontSize: "clamp(2.2rem, 5.4vw, 4rem)", ...ink }}
        >
          Fast enough to <span className="rita-accent">talk to.</span>
        </h2>
        <p
          className="mx-auto mt-5 max-w-[640px] text-[18px] leading-[1.6] md:text-[20px]"
          style={muted}
        >
          Rita does not wait for you to finish, then think, then speak. Listening, deciding and
          speaking overlap, so a reply can begin while she is still shaping the end of it.
        </p>
      </header>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-5 md:mt-16">
        <LiveTranscript />
        <TurnTimeline />
        <SpecGrid />
      </div>
    </section>
  );
}
