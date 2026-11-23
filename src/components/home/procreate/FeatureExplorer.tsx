import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  FileText,
  Gamepad2,
  GraduationCap,
  Headphones,
  Layers,
  Mic,
  Star,
  type LucideIcon,
} from "lucide-react";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { useActiveLanguage } from "@/lib/language-scope";
import { driftOffset, waveOffset, wavePhase } from "./feature-explorer";
import { useOnceInView, useReducedMotion } from "./ag-hooks";
import { Letters, Typed } from "./ag-motion";
import "./feature-explorer.css";

const STATEMENT =
  "Uzyra is a voice tutor and a study space in one. Speak a new language out loud, and learn your own lectures with her.";

/** The circles under the statement: what you can do here, in icons. */
const ICONS: LucideIcon[] = [Mic, FileText, Layers, Gamepad2, Star, Headphones, GraduationCap];

type Feature = {
  id: string;
  title: string;
  text: string;
  to: string;
  label: string;
  /** The picture has controls of its own, so it is a labelled group rather than an image. */
  live?: boolean;
  media: ReactNode;
};

const FEATURES: Feature[] = [
  {
    id: "talk",
    title: "Talk it through",
    text: "Speak English or German out loud and Uzyra answers in Jordanian Arabic, in a sentence or two. Tap any foreign word in her reply to see what it means and how to say it.",
    to: "/rita-conversations",
    label:
      "A learner asks Uzyra how to say something in German, and taps the answer for its meaning",
    live: true,
    media: <TalkScene />,
  },
  {
    id: "words",
    title: "Keep every word",
    text: "The words you ask about collect in your list. Fix or delete them, then turn the list into flashcards in the subject you choose.",
    to: "/rita",
    label: "Saved words turning into flashcards",
    live: true,
    media: <WordsScene />,
  },
  {
    id: "study",
    title: "Study with Uzyra",
    text: "Open a lecture or a book: the page on one side, a step-by-step guide on the other, and Uzyra explaining it out loud. Select any line and ask her about it.",
    to: "/books",
    label: "The study page: a guide to the lesson and Uzyra beside it",
    media: <StudyScene />,
  },
  {
    id: "lessons",
    title: "Lessons",
    text: "Short lessons with one clear goal each, real video clips and quick practice. Earn stars as you reach each goal, and pick up where you stopped.",
    to: "/rita-lessons",
    label: "A lesson path with stars",
    media: <LessonsScene />,
  },
  {
    id: "games",
    title: "Play to remember",
    text: "Wordcraft, Pairs and the German Lab turn the words you are learning into short games: build words, match pairs, and practise articles and pronunciation.",
    to: "/games",
    label: "Word games: letter tiles and matching pairs",
    media: <GamesScene />,
  },
];

/**
 * The statement, typed in once it is in view, over a row of circles that ripples and drifts left
 * with the scroll.
 */
function Statement({ reduced }: { reduced: boolean }) {
  const section = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const sectionEl = section.current;
    const listEl = list.current;
    if (!sectionEl || !listEl) return;
    const items = [...listEl.querySelectorAll<HTMLElement>("li")];
    let centres: number[] = [];
    let width = window.innerWidth;
    const measure = () => {
      width = window.innerWidth;
      // Centres along the row itself, so the drift does not move the ripple with it.
      centres = items.map((item) => item.offsetLeft + item.offsetWidth / 2);
    };
    const place = (phase: number) => {
      items.forEach((item, i) => {
        item.style.transform = `translate3d(0, ${waveOffset(centres[i] ?? 0, phase, width).toFixed(2)}px, 0)`;
      });
    };
    const drift = () => {
      if (reduced) {
        listEl.style.transform = "";
        return;
      }
      const r = sectionEl.getBoundingClientRect();
      listEl.style.transform = `translate3d(${driftOffset(r.top, r.height, window.innerHeight).toFixed(1)}px, 0, 0)`;
    };
    measure();
    place(0);
    drift();
    if (reduced) {
      const onResize = () => {
        measure();
        place(0);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    // The ripple runs once the section is well in view, and only while it is on screen.
    let started = false;
    let visible = false;
    let raf = 0;
    let clock = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = 0;
      clock += Math.min(0.05, (now - last) / 1000);
      last = now;
      place(wavePhase(clock, width));
      if (started && visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (raf || !started || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const begin = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        started = true;
        begin.disconnect();
        wake();
      },
      { rootMargin: "0px 0px -45% 0px" },
    );
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    begin.observe(sectionEl);
    seen.observe(sectionEl);
    const onScroll = () => drift();
    const onResize = () => {
      measure();
      drift();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", wake);
    sectionEl.dataset.wave = "on";
    return () => {
      cancelAnimationFrame(raf);
      begin.disconnect();
      seen.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", wake);
      delete sectionEl.dataset.wave;
    };
  }, [reduced]);

  return (
    <section ref={section} className="uz-fx-statement" aria-labelledby="uz-fx-statement">
      <ul ref={list} className="uz-fx-circles" aria-hidden="true">
        {[...ICONS, ...ICONS, ...ICONS].map((Icon, i) => (
          <li key={i} className="uz-fx-circle">
            <Icon strokeWidth={1.4} />
          </li>
        ))}
      </ul>
      <div className="uz-fx-wrap">
        <Typed id="uz-fx-statement" className="uz-fx-said" text={STATEMENT} />
      </div>
    </section>
  );
}

function Row({ feature, reduced }: { feature: Feature; reduced: boolean }) {
  const [shown, setShown] = useState(false);
  const title = useOnceInView<HTMLHeadingElement>(0.85, () => setShown(true));
  return (
    <article className="uz-fx-row" data-feature={feature.id}>
      <div className="uz-fx-copy">
        <h3 ref={title} className="uz-fx-title">
          <Link to={feature.to}>{feature.title}</Link>
        </h3>
        <Letters className="uz-fx-text" text={feature.text} shown={shown || reduced} />
      </div>
      <div className="uz-fx-media" role={feature.live ? "group" : "img"} aria-label={feature.label}>
        {feature.media}
      </div>
    </article>
  );
}

/**
 * Under the intro card: a typed statement of what Uzyra is, then one row per feature (the title
 * and a short description on one side, a picture of it on the other), ending with a way in.
 * The layout and motion follow the reference landing page's feature section; the code, words and
 * pictures are our own. Reduced motion shows everything at once and keeps it still.
 */
export function FeatureExplorer() {
  const reduced = useReducedMotion();
  return (
    <div className="uz-fx" dir="ltr" lang="en">
      <Statement reduced={reduced} />
      <section className="uz-fx-features" aria-label="What you can do with Uzyra">
        <div className="uz-fx-list">
          {FEATURES.map((feature) => (
            <Row key={feature.id} feature={feature} reduced={reduced} />
          ))}
        </div>
        <div className="uz-fx-cta">
          <Link to="/learn" className="uz-fx-button">
            Start learning
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
 * The pictures. Each is drawn from the product's own look, in black and white; the study one is a
 * real screenshot of the study page (sample lesson, no learner data).
 * ------------------------------------------------------------------------------------------- */

/** Steps of a scene, one after another, once it is well in view; all at once with reduced motion. */
function useSteps(times: number[]) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [go, setGo] = useState(false);
  const timers = useRef<number[]>([]);
  const host = useOnceInView<HTMLDivElement>(0.75, () => setGo(true));
  const stop = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => {
    if (reduced) {
      setStep(times.length);
      return;
    }
    if (!go) return;
    timers.current = times.map((ms, i) => window.setTimeout(() => setStep(i + 1), ms));
    return stop;
    // The times are constants of each scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, reduced]);
  // A tap takes over from the timed steps.
  const choose = (next: number) => {
    stop();
    setStep(next);
  };
  return { host, step, setStep: choose };
}

/**
 * The learner asks in Arabic, Uzyra answers with the German sentence, and the German is a word you
 * can tap: it opens its meaning and how to say it (it opens by itself the first time).
 */
function TalkScene() {
  const levels = useRef({ input: 0, output: 0 });
  const { host, step, setStep } = useSteps([300, 1300, 2700]);
  const [live, setLive] = useState(false);
  // Uzyra "speaks" while her line is on screen: a soft, made-up voice level for the cube.
  useEffect(() => {
    const el = host.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const syllable = Math.max(0, Math.sin(t * 7.3)) * (0.55 + 0.45 * Math.sin(t * 1.9));
      levels.current.output = t % 6 < 3.6 ? syllable : 0;
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      raf = 0;
      setLive(entry.isIntersecting);
      if (entry.isIntersecting) raf = requestAnimationFrame(tick);
      else levels.current.output = 0;
    });
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [host]);
  const open = step >= 3;
  return (
    <div ref={host} className="uz-fx-scene uz-fx-talk" data-step={step}>
      <p className="uz-fx-bubble uz-fx-me" dir="rtl" lang="ar" data-in={step >= 1 || undefined}>
        كيف أحكي بدي ماي بالألماني؟
      </p>
      <div className="uz-fx-talk-cube">
        <RitaCube levelsRef={levels} mode="speaking" label="" active={live} />
      </div>
      <div className="uz-fx-her-wrap" data-in={step >= 2 || undefined}>
        <p className="uz-fx-bubble uz-fx-her" dir="rtl" lang="ar">
          بنقول{" "}
          <button
            type="button"
            className="uz-fx-word-chip"
            dir="ltr"
            lang="de"
            aria-expanded={open}
            aria-controls="uz-fx-meaning"
            onClick={() => setStep(open ? 2 : 3)}
          >
            Ich möchte Wasser
          </button>
        </p>
        <div id="uz-fx-meaning" className="uz-fx-meaning" data-open={open || undefined}>
          <p className="uz-fx-meaning-term" lang="de">
            Ich möchte Wasser
          </p>
          <p dir="rtl" lang="ar">
            بدي ماي
          </p>
          <p className="uz-fx-meaning-say" dir="rtl" lang="ar">
            بتنلفظ: إِش مُوشته ڤاسَر
          </p>
        </div>
      </div>
    </div>
  );
}

// Saved words in the learner's language (English while none is chosen).
const SAVED_WORDS: Record<"de" | "en", [string, string][]> = {
  de: [
    ["Guten Morgen", "صباح الخير"],
    ["leihen", "يستعير"],
    ["das Haus", "البيت"],
  ],
  en: [
    ["Good morning", "صباح الخير"],
    ["borrow", "يستعير"],
    ["the house", "البيت"],
  ],
};

/**
 * The list of saved words fills in, then the button turns it into a fanned stack of flashcards.
 * The button goes back and forth between the two.
 */
function WordsScene() {
  const code = useActiveLanguage();
  const words = SAVED_WORDS[code === "de" ? "de" : "en"];
  const { host, step, setStep } = useSteps([200, 2900, 3150]);
  const cards = step >= 3;
  return (
    <div ref={host} className="uz-fx-scene uz-fx-soft">
      <div className="uz-fx-window uz-fx-panel uz-fx-words" data-step={step}>
        <p className="uz-fx-eyebrow">My words · {words.length}</p>
        <div className="uz-fx-deck">
          <ul className="uz-fx-wordlist" data-hidden={cards || undefined}>
            {words.map(([term, meaning], i) => (
              <li key={term} style={{ transitionDelay: cards ? "0s" : `${i * 0.12}s` }}>
                <span>{term}</span>
                <span dir="rtl" lang="ar">
                  {meaning}
                </span>
              </li>
            ))}
          </ul>
          <div className="uz-fx-stack" data-shown={cards || undefined}>
            {/* Last in the markup sits on top, so the first word is the front card. */}
            {[...words].reverse().map(([term, meaning], i) => (
              <div
                key={term}
                className="uz-fx-flash"
                style={{ "--n": words.length - 1 - i } as CSSProperties}
              >
                <b>{term}</b>
                <span dir="rtl" lang="ar">
                  {meaning}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="uz-fx-turn"
          data-press={step === 2 || undefined}
          onClick={() => setStep(cards ? 1 : 3)}
        >
          {cards ? "Back to the list" : `Turn ${words.length} words into flashcards`}
        </button>
      </div>
    </div>
  );
}

function StudyScene() {
  return (
    <div className="uz-fx-scene uz-fx-soft">
      <div className="uz-fx-window uz-fx-shot">
        <img
          src="/home/features/study.webp"
          alt=""
          width={1600}
          height={1142}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

const LESSONS = [
  { title: "Greetings", stars: 3, state: "done" },
  { title: "Ordering food", stars: 2, state: "done" },
  { title: "Daily routine", stars: 0, state: "now" },
  { title: "Job interviews", stars: 0, state: "next" },
] as const;

function LessonsScene() {
  return (
    <div className="uz-fx-scene uz-fx-soft">
      <div className="uz-fx-window uz-fx-panel">
        <p className="uz-fx-eyebrow">English · Speaking path</p>
        <ol className="uz-fx-path">
          {LESSONS.map((lesson) => (
            <li key={lesson.title} data-state={lesson.state}>
              <span className="uz-fx-node" />
              <span className="uz-fx-lesson">{lesson.title}</span>
              <span className="uz-fx-stars">
                {[0, 1, 2].map((s) => (
                  <Star key={s} data-on={s < lesson.stars || undefined} strokeWidth={1.5} />
                ))}
              </span>
            </li>
          ))}
        </ol>
        <p className="uz-fx-goal">Goal: say what you do every morning</p>
      </div>
    </div>
  );
}

const TILES = ["S", "P", "E", "A", "K"];
const PAIRS = [
  ["das Haus", "house"],
  ["das Buch", "book"],
  ["das Wasser", "water"],
];

function GamesScene() {
  return (
    <div className="uz-fx-scene uz-fx-soft">
      <div className="uz-fx-window uz-fx-panel">
        <p className="uz-fx-eyebrow">Wordcraft</p>
        <div className="uz-fx-tiles">
          {TILES.map((t, i) => (
            <span key={i} data-empty={i === 3 || undefined}>
              {i === 3 ? "" : t}
            </span>
          ))}
        </div>
        <p className="uz-fx-eyebrow">Pairs</p>
        <div className="uz-fx-pairs">
          {PAIRS.flat().map((word, i) => (
            <span key={i} data-matched={i < 2 || undefined}>
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
