import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  FileText,
  Gamepad2,
  GraduationCap,
  Headphones,
  Languages,
  Layers,
  MessageCircle,
  Mic,
  PenLine,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { driftOffset, LETTERS, splitLetters, waveOffset, wavePhase } from "./feature-explorer";
import "./feature-explorer.css";

const STATEMENT =
  "Uzyra is a voice tutor and a study space in one. Speak a new language out loud, and learn your own lectures with her.";

/** The circles under the statement: what you can do here, in icons. */
const ICONS: LucideIcon[] = [
  Mic,
  MessageCircle,
  FileText,
  BookOpen,
  Layers,
  PenLine,
  Gamepad2,
  Star,
  Languages,
  Headphones,
  GraduationCap,
  Sparkles,
];

type Feature = {
  id: string;
  title: string;
  text: string;
  to: string;
  label: string;
  media: ReactNode;
};

const FEATURES: Feature[] = [
  {
    id: "talk",
    title: "Talk to Uzyra",
    text: "Speak Jordanian Arabic or English and Uzyra answers out loud, in a sentence or two. She corrects the mistakes that matter, plays any role you ask for, and keeps the conversation going.",
    to: "/rita-conversations",
    label: "Uzyra answering a learner out loud",
    media: <TalkScene />,
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
    id: "lectures",
    title: "Your lectures, ready to study",
    text: "Upload a lecture and get a summary, flashcards and practice questions with explanations. Review them whenever you like, on your own or with your class.",
    to: "/learn",
    label: "A lecture turned into a summary, flashcards and questions",
    media: <LectureScene />,
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

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Runs `onEnter` once, when the element's top reaches `share` of the way down the screen. */
function useOnceInView<T extends Element>(share: number, onEnter: () => void) {
  const ref = useRef<T>(null);
  const done = useRef(onEnter);
  done.current = onEnter;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        done.current();
      },
      { rootMargin: `0px 0px -${Math.round((1 - share) * 100)}% 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [share]);
  return ref;
}

/**
 * The statement, typed in once it is in view, over a row of circles that ripples and drifts left
 * with the scroll.
 */
function Statement({ reduced }: { reduced: boolean }) {
  const section = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [typing, setTyping] = useState(false);
  const text = useOnceInView<HTMLDivElement>(0.8, () => setTyping(true));

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

  const chars = [...STATEMENT];
  return (
    <section ref={section} className="uz-fx-statement" aria-labelledby="uz-fx-statement">
      <ul ref={list} className="uz-fx-circles" aria-hidden="true">
        {[...ICONS, ...ICONS].map((Icon, i) => (
          <li key={i} className="uz-fx-circle">
            <Icon strokeWidth={1.4} />
          </li>
        ))}
      </ul>
      <div ref={text} className="uz-fx-wrap">
        <h2
          id="uz-fx-statement"
          className="uz-fx-said"
          data-typing={typing || reduced ? "on" : undefined}
          style={{ "--type": `${LETTERS.type}s` } as CSSProperties}
        >
          <span className="uz-fx-sr">{STATEMENT}</span>
          <span aria-hidden="true">
            {chars.map((ch, i) => (
              <span
                key={i}
                className={i === chars.length - 1 ? "uz-fx-ch uz-fx-last" : "uz-fx-ch"}
                style={{ "--i": i } as CSSProperties}
              >
                {ch}
              </span>
            ))}
          </span>
        </h2>
      </div>
    </section>
  );
}

/** A description whose letters fade in, one after another, when its title comes into view. */
function Letters({ text, shown }: { text: string; shown: boolean }) {
  return (
    <p className="uz-fx-text" data-shown={shown ? "on" : undefined}>
      <span className="uz-fx-sr">{text}</span>
      <span aria-hidden="true">
        {splitLetters(text).map(({ word, letters }, w) => (
          <span key={w}>
            <span className="uz-fx-word">
              {letters.map(({ char, index }) => (
                <span
                  key={index}
                  className="uz-fx-letter"
                  style={{ transitionDelay: `${(index * LETTERS.stagger).toFixed(3)}s` }}
                >
                  {char}
                </span>
              ))}
            </span>{" "}
          </span>
        ))}
      </span>
    </p>
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
        <Letters text={feature.text} shown={shown || reduced} />
      </div>
      <div className="uz-fx-media" role="img" aria-label={feature.label}>
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

function TalkScene() {
  const levels = useRef({ input: 0, output: 0 });
  const host = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  // Uzyra "speaks" while the picture is on screen: a soft, made-up voice level for the cube.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
  }, []);
  return (
    <div ref={host} className="uz-fx-scene uz-fx-talk">
      <p className="uz-fx-bubble uz-fx-me" dir="rtl" lang="ar">
        كيف بقول بدي الفاتورة بالإنجليزي؟
      </p>
      <div className="uz-fx-talk-cube">
        <RitaCube levelsRef={levels} mode="speaking" label="" active={live} />
      </div>
      <p className="uz-fx-bubble uz-fx-her">“Can I have the bill, please?”</p>
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

function LectureScene() {
  return (
    <div className="uz-fx-scene uz-fx-soft">
      <div className="uz-fx-window uz-fx-panel">
        <p className="uz-fx-file">
          <FileText strokeWidth={1.5} />
          Lecture 4 · History taking.pdf
        </p>
        <div className="uz-fx-outputs">
          <span>
            <b>Summary</b>1 page
          </span>
          <span>
            <b>Flashcards</b>24 cards
          </span>
          <span>
            <b>Questions</b>18 with answers
          </span>
        </div>
        <div className="uz-fx-card">
          <p className="uz-fx-card-q">What does LMP stand for?</p>
          <p className="uz-fx-card-a">Last menstrual period: the first day of the last period.</p>
        </div>
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
