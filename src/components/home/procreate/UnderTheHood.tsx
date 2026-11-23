import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AudioLines, Languages, MessageSquareQuote, Pause, RotateCcw, Zap } from "lucide-react";
import { useReducedMotion, useShown } from "./ag-hooks";
import { FadeText, Typed } from "./ag-motion";
import "./under-the-hood.css";

/* ---------- 1. a sentence that mixes three languages, heard word by word ---------- */

type Lang = "en" | "ar" | "de";
type Word = { text: string; lang: Lang };

const HEARD: Word[] = [
  { text: "Uzyra,", lang: "en" },
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
          className="uz-hood-group"
        >
          {group.words.map((word, wordIndex) => (
            <span key={`${word.text}-${wordIndex}`}>
              {wordIndex > 0 ? " " : ""}
              <span className="uz-hood-w" data-partial={(partialLast && word.last) || undefined}>
                {word.text}
              </span>
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

function LiveTranscript() {
  const { ref, shown, reduced } = useShown<HTMLDivElement>(0.75);
  const [heard, setHeard] = useState(0);
  const [replied, setReplied] = useState(0);
  const [run, setRun] = useState(0);
  const timer = useRef<number | null>(null);

  const play = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    if (reduced) {
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
  }, [reduced]);

  useEffect(() => {
    if (shown) play();
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [shown, run, play]);

  const current = heard > 0 ? HEARD[Math.min(heard, HEARD.length) - 1].lang : null;
  const finishing = heard >= HEARD.length;

  return (
    <div ref={ref} className="uz-hood-card uz-hood-demo">
      <div className="uz-hood-demo-top">
        <p className="uz-hood-note">
          <span className="uz-hood-tag">Demo</span>A scripted example, not a recording
        </p>
        <div className="uz-hood-langs" aria-hidden="true">
          {LANGS.map((l) => (
            <span key={l.id} lang={l.id} data-on={current === l.id || undefined}>
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <p className="uz-ag-sr">
        You say: {HEARD_TEXT} Uzyra replies: {REPLY_TEXT}
      </p>

      <div aria-hidden="true" className="uz-hood-demo-cols">
        <div>
          <p className="uz-hood-label">What Uzyra hears, as you speak</p>
          <p className="uz-hood-said">
            <Heard words={HEARD.slice(0, heard)} partialLast={!finishing} />
          </p>
        </div>
        <div className="uz-hood-reply">
          <p className="uz-hood-label">Uzyra's reply, already on its way</p>
          <p className="uz-hood-said">
            <Heard words={REPLY.slice(0, replied)} partialLast={false} />
          </p>
        </div>
      </div>

      <div className="uz-hood-demo-foot">
        <p>
          A dashed word is still being heard and can change. Uzyra starts to answer before the
          question is over, and Arabic, English and German can sit in one sentence.
        </p>
        <button type="button" className="uz-hood-replay" onClick={() => setRun((n) => n + 1)}>
          <RotateCcw size={16} aria-hidden="true" /> Replay
        </button>
      </div>
    </div>
  );
}

/* ---------- 2. one turn: the stages overlap instead of queueing ---------- */

type Bar = { from: number; to: number; tone: "you" | "step" | "speaks" };
type Lane = { label: string; bars: Bar[] };

const OVERLAP: Lane[] = [
  { label: "You speak", bars: [{ from: 0, to: 38, tone: "you" }] },
  { label: "Uzyra listens", bars: [{ from: 1, to: 40, tone: "step" }] },
  { label: "Decides your turn is over", bars: [{ from: 36, to: 46, tone: "step" }] },
  { label: "Thinks of the answer", bars: [{ from: 44, to: 66, tone: "step" }] },
  { label: "Speaks", bars: [{ from: 52, to: 100, tone: "speaks" }] },
];
const QUEUE: Lane[] = [
  { label: "You speak", bars: [{ from: 0, to: 38, tone: "you" }] },
  { label: "Listens, then decides", bars: [{ from: 38, to: 52, tone: "step" }] },
  { label: "Thinks the whole answer", bars: [{ from: 52, to: 80, tone: "step" }] },
  { label: "Then speaks", bars: [{ from: 80, to: 100, tone: "speaks" }] },
];

function LaneRows({ lanes, first }: { lanes: Lane[]; first: number }) {
  return (
    <ul className="uz-hood-lanes">
      {lanes.map((lane, i) => (
        <li key={lane.label}>
          <span className="uz-hood-lane-label">{lane.label}</span>
          <span aria-hidden="true" className="uz-hood-track">
            {lane.bars.map((bar) => (
              <span
                key={`${bar.from}-${bar.to}`}
                className="uz-hood-bar"
                data-tone={bar.tone}
                data-lane={first + i}
                style={{ insetInlineStart: `${bar.from}%`, width: `${bar.to - bar.from}%` }}
              />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The bars draw themselves with the scroll: each grows from its start as the card rises from the
 * bottom of the screen to its upper third, one lane a little after the one above it.
 */
function TurnTimeline() {
  const card = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const bars = [...el.querySelectorAll<HTMLElement>(".uz-hood-bar")];
    const lanes = OVERLAP.length + QUEUE.length;
    if (reduced) {
      bars.forEach((bar) => (bar.style.transform = ""));
      return;
    }
    let raf = 0;
    const draw = () => {
      raf = 0;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (vh * 0.9 - top) / (vh * 0.6)));
      bars.forEach((bar) => {
        const lane = Number(bar.dataset.lane);
        const lp = Math.min(1, Math.max(0, (p - (lane / lanes) * 0.45) / 0.55));
        const eased = 1 - (1 - lp) ** 3;
        bar.style.transform = `scaleX(${eased.toFixed(4)})`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.addEventListener("scroll", onScroll, { passive: true });
          window.addEventListener("resize", onScroll);
          onScroll();
        } else {
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
        }
      },
      { rootMargin: "200px 0px" },
    );
    draw();
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);
  return (
    <div ref={card} className="uz-hood-card uz-hood-turn">
      <div className="uz-hood-turn-head">
        <h3 className="uz-hood-h3">One turn of conversation</h3>
        <p className="uz-hood-note">Illustration of the idea, not to scale</p>
      </div>
      <p className="uz-hood-label uz-hood-strong">Uzyra: the steps overlap</p>
      <LaneRows lanes={OVERLAP} first={0} />
      <p className="uz-hood-label">A voice assistant that waits for each step</p>
      <LaneRows lanes={QUEUE} first={OVERLAP.length} />
      <FadeText
        className="uz-hood-body"
        text="Words are recognised while you talk, the decision that you have finished is made on a short pause, and the first words of the answer go to the voice as soon as they exist. The gap you feel is the gap between the two last bars."
      />
    </div>
  );
}

/* ---------- 3. what is built in ---------- */

function Spec({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="uz-hood-spec">
      <span aria-hidden="true" className="uz-hood-icon">
        {icon}
      </span>
      <h3 className="uz-hood-h3">{title}</h3>
      <FadeText className="uz-hood-body" text={text} />
    </li>
  );
}

/** The measured number counts up from zero the first time it comes into view. */
function Measured() {
  const { ref, shown, reduced } = useShown<HTMLLIElement>(0.85);
  const [value, setValue] = useState(75);
  const counted = useRef(false);
  useEffect(() => {
    if (reduced) {
      setValue(75);
      return;
    }
    if (counted.current) return;
    if (!shown) {
      setValue(0);
      return;
    }
    counted.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setValue(Math.round(75 * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, reduced]);
  return (
    <li
      ref={ref}
      className="uz-hood-spec uz-hood-measured"
      aria-label="Measured: about 75 milliseconds to first sound from the voice engine"
    >
      <p className="uz-hood-label">Measured</p>
      <p className="uz-hood-number" aria-hidden="true">
        ≈<span data-count>{value}</span>
        <small>ms</small>
      </p>
      <p className="uz-hood-body">
        Median time for the voice engine alone to produce its first sound, in Arabic and German, on
        11 October 2026 (Europe). It is not the delay you hear end to end.
      </p>
    </li>
  );
}

function SpecGrid() {
  return (
    <ul className="uz-hood-specs">
      <Spec
        icon={<AudioLines />}
        title="Hears words as you say them"
        text="Speech is recognised in a continuous stream, so Uzyra does not wait for you to stop before she starts to understand."
      />
      <Spec
        icon={<Pause />}
        title="A pause is not the end"
        text="She tells a thinking pause from a finished sentence, so she does not cut in while you search for the word."
      />
      <Spec
        icon={<Zap />}
        title="Starts speaking early, stops when you do"
        text="The answer is sent to the voice word by word, and it is cancelled the moment you talk over her."
      />
      <Spec
        icon={<Languages />}
        title="Arabic, English and German together"
        text="Built for learners who mix languages in one sentence, and who ask for a switch in the middle of a lesson."
      />
      <Spec
        icon={<MessageSquareQuote />}
        title="Explains in Jordanian Arabic"
        text="Short spoken explanations with the foreign word set apart, so you can tap it and keep it as a flashcard."
      />
      <Measured />
    </ul>
  );
}

/**
 * Home page band: how the voice works, with one measured number, stated with its limits. Same
 * motion language as the feature section: a typed heading, letter-by-letter descriptions, bars
 * that draw with the scroll. Black, white and greys only.
 */
export function UnderTheHood() {
  return (
    <section className="uz-hood" dir="ltr" lang="en" aria-labelledby="hood-heading">
      <header className="uz-hood-head">
        <p className="uz-hood-eyebrow">Under the hood</p>
        <Typed id="hood-heading" className="uz-hood-title" text="Fast enough to talk to." />
        <FadeText
          className="uz-hood-lead"
          text="Uzyra does not wait for you to finish, then think, then speak. Listening, deciding and speaking overlap, so a reply can begin while she is still shaping the end of it."
        />
      </header>
      <div className="uz-hood-stack">
        <LiveTranscript />
        <TurnTimeline />
        <SpecGrid />
      </div>
    </section>
  );
}
