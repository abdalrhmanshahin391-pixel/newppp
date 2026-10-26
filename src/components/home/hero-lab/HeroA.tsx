import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { StartLearningLink } from "@/components/StartLearningLink";
import { TapAnswer, TapStage, type ChipSpot } from "./TapStage";
import { useTapWord } from "./useTapWord";

export const DISPLAY: CSSProperties = {
  fontFamily: "'Outfit','Inter Tight',var(--font-grotesk),sans-serif",
};

const SPOTS: ChipSpot[] = [
  { left: "2%", top: "12%", rot: -4 },
  { left: "10%", top: "72%", rot: 3 },
  { right: "6%", top: "10%", rot: 4 },
  { right: "6%", top: "70%", rot: -3 },
];

/** Concept A, "Atelier" (Procreate): the work is the picture. One huge orb, one headline, one action. */
export function HeroA() {
  const tap = useTapWord();
  return (
    <section className="relative isolate overflow-hidden">
      <div
        className="mx-auto grid w-full max-w-[1320px] items-center gap-2 px-5 pb-8 pt-[104px] md:px-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8 lg:pt-[88px]"
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

        <div className="relative flex flex-col lg:-mr-10">
          <div className="relative h-[330px] w-full sm:h-[400px] lg:h-[min(600px,calc(100dvh-230px))]">
            <TapStage
              tap={tap}
              spots={SPOTS}
              orbClass="w-[300px] sm:w-[380px] lg:w-[min(560px,46vw)]"
              rings={[360, 560, 760, 980]}
            />
          </div>
          <TapAnswer tap={tap} className="min-h-[150px] sm:min-h-[84px] lg:min-h-[88px]" />
        </div>
      </div>
    </section>
  );
}
