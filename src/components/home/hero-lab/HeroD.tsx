import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { StartLearningLink } from "@/components/StartLearningLink";
import { StudyPanel } from "@/components/home/procreate/FeatureTrio";
import { DISPLAY } from "./HeroA";
import { TapAnswer, TapStage, type ChipSpot } from "./TapStage";
import { TAP_WORDS, useTapWord, type TapState } from "./useTapWord";

const SPOTS: ChipSpot[] = [
  { left: "3%", top: "8%", rot: -4 },
  { left: "6%", top: "70%", rot: 3 },
  { right: "3%", top: "6%", rot: 4 },
  { right: "3%", top: "68%", rot: -3 },
];

type Id = "talk" | "words" | "study";

const TAB = 48; // height of a title bar: the part of a back window that stays visible
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

function TalkBody({ tap }: { tap: TapState }) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-[300px] flex-1">
        <TapStage tap={tap} spots={SPOTS} orbClass="w-[230px] sm:w-[280px]" rings={[280, 420]} />
      </div>
      <TapAnswer tap={tap} className="min-h-[150px] sm:min-h-[84px]" />
    </div>
  );
}

function WordsBody({ tap }: { tap: TapState }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-[15px]" style={{ color: "var(--pp-muted)" }}>
        Words you add collect here and turn into flashcards.
      </p>
      <ul className="flex flex-col">
        {TAP_WORDS.map((w, i) => {
          const on = tap.added.has(i);
          return (
            <li
              key={w.term}
              className="flex items-center justify-between gap-3 py-3"
              style={{ borderTop: i ? "1px solid rgb(255 255 255 / 0.12)" : undefined }}
            >
              <div className="min-w-0">
                <p className="text-[18px] font-semibold text-white">{w.term}</p>
                <p dir="rtl" lang="ar" className="text-start text-[15px]" style={{ color: "var(--pp-muted)" }}>
                  {w.meaning}
                </p>
              </div>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => (on ? tap.remove(i) : tap.add(i))}
                className="rita-btn rita-btn-sm shrink-0"
                style={{
                  background: on ? "#ffffff" : "transparent",
                  color: on ? "#000000" : "#ffffff",
                  border: "1px solid rgb(255 255 255 / 0.5)",
                }}
              >
                {on ? "In My words" : "Add"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StudyBody() {
  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <StudyPanel />
      <p className="max-w-[26rem] text-[16px] leading-[1.5]" style={{ color: "var(--pp-muted)" }}>
        Upload lecture notes or a PDF. Get flashcards, summaries and practice questions from what
        you actually have to learn.
      </p>
    </div>
  );
}

/**
 * Concept D, "Folder stack" (Procreate + DaVinci + Khan): one calm headline and one action on the
 * left. On the right the product is a stack of windows; the title bars are the menu, and the one
 * you choose comes to the front. Phones turn the same stack into an accordion.
 */
export function HeroD() {
  const tap = useTapWord();
  const [order, setOrder] = useState<Id[]>(["talk", "words", "study"]); // most recent first
  const front = order[0];

  const windows: { id: Id; title: string; body: ReactNode }[] = [
    { id: "talk", title: "Talk it through", body: <TalkBody tap={tap} /> },
    { id: "words", title: "Keep every word", body: <WordsBody tap={tap} /> },
    { id: "study", title: "Study your own material", body: <StudyBody /> },
  ];

  function choose(id: Id) {
    setOrder((current) => [id, ...current.filter((x) => x !== id)]);
  }

  return (
    <section className="relative isolate overflow-hidden">
      <div
        className="mx-auto grid w-full max-w-[1320px] items-center gap-10 px-5 pb-12 pt-[104px] md:px-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:pt-[88px]"
        style={{ minHeight: "100dvh" }}
      >
        <div className="relative z-10 max-w-[34rem]">
          <h1
            className="font-medium text-white"
            style={{
              ...DISPLAY,
              fontSize: "clamp(2.5rem, 4.9vw, 4.6rem)",
              lineHeight: 1.03,
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            Say it out loud.
            <br />
            <span style={{ color: "var(--pp-muted)" }}>Keep it for good.</span>
          </h1>
          <p className="mt-6 max-w-[30rem] text-[18px] leading-[1.5] md:text-[19px]" style={{ color: "var(--pp-muted)" }}>
            A voice teacher for English and German who explains in Arabic. Any word you ask about
            can become a flashcard.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <StartLearningLink className="rita-btn rita-btn-primary">Start learning</StartLearningLink>
            <Link
              to="/rita"
              className="text-[16px] font-semibold text-white underline decoration-white/30 underline-offset-[6px] transition-colors hover:decoration-white"
            >
              Talk to Rita
            </Link>
          </div>
        </div>

        <div
          className="relative flex flex-col gap-2 lg:block lg:h-[var(--stack-h)]"
          style={{ "--stack-h": `${560 + TAB * 2}px` } as React.CSSProperties}
        >
          {windows.map((w) => {
            const rank = order.indexOf(w.id);
            const open = rank === 0;
            return (
              <section
                key={w.id}
                className="hero-win relative overflow-hidden rounded-[22px] lg:absolute lg:inset-x-0 lg:top-0 lg:h-[560px]"
                style={
                  {
                    "--rank": rank,
                    "--ty": `${(2 - rank) * TAB}px`,
                    "--sx": 1 - rank * 0.035,
                    zIndex: 3 - rank,
                    background: open ? "#050505" : "#0b0b0b",
                    border: `1px solid ${open ? "rgb(255 255 255 / 0.3)" : "rgb(255 255 255 / 0.16)"}`,
                    transitionTimingFunction: EASE,
                  } as React.CSSProperties
                }
              >
                <h2 className="m-0 text-[15px]" style={{ fontWeight: 600, letterSpacing: 0 }}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`hero-win-${w.id}`}
                    onClick={() => choose(w.id)}
                    className="flex w-full items-center justify-between px-5 text-start transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
                    style={{ height: TAB, color: open ? "#ffffff" : "#a3a3a3" }}
                  >
                    <span>{w.title}</span>
                    <span aria-hidden="true" className="text-[18px] leading-none lg:hidden">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                </h2>
                <div
                  id={`hero-win-${w.id}`}
                  role="region"
                  aria-label={w.title}
                  hidden={!open}
                  className="px-5 pb-5 lg:h-[calc(100%-48px)]"
                >
                  {open ? w.body : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
