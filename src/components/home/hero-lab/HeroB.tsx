import { Link } from "@tanstack/react-router";
import { StartLearningLink } from "@/components/StartLearningLink";
import { StudyPanel, TalkPanel, WordsPanel } from "@/components/home/procreate/FeatureTrio";
import { DISPLAY } from "./HeroA";
import { TapAnswer, TapStage, type ChipSpot } from "./TapStage";
import { useTapWord } from "./useTapWord";

const SPOTS: ChipSpot[] = [
  { left: "4%", top: "10%", rot: -4 },
  { left: "8%", top: "66%", rot: 3 },
  { right: "5%", top: "8%", rot: 4 },
  { right: "4%", top: "62%", rot: -3 },
];

const LAYERS = [
  { Panel: StudyPanel, title: "Study your own material", x: 36, y: -84, scale: 0.92, o: 0.3 },
  { Panel: WordsPanel, title: "My words", x: 20, y: -56, scale: 0.95, o: 0.5 },
  { Panel: TalkPanel, title: "Talk it through", x: 6, y: -28, scale: 0.975, o: 0.75 },
];

/** Concept B, "Stage" (DaVinci): a front window with Rita, and the rest of the product stacked behind it. */
export function HeroB() {
  const tap = useTapWord();
  return (
    <section className="relative isolate overflow-hidden" style={{ minHeight: "100dvh" }}>
      <div className="mx-auto w-full max-w-[1320px] px-5 pt-[112px] md:px-10 lg:pt-[128px]">
        <div className="relative z-10 max-w-[40rem]">
          <h1
            className="font-medium text-white"
            style={{
              ...DISPLAY,
              fontSize: "clamp(2.5rem, 5.4vw, 5rem)",
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            Say it out loud. Keep it for good.
          </h1>
          <p className="mt-5 max-w-[32rem] text-[18px] leading-[1.5] md:text-[19px]" style={{ color: "var(--pp-muted)" }}>
            A voice teacher for English and German who explains in Arabic. Any word you ask about
            can become a flashcard.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <StartLearningLink className="rita-btn rita-btn-primary">Start learning</StartLearningLink>
            <Link to="/rita" className="rita-btn rita-btn-secondary">
              Talk to Rita
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-12 w-full max-w-[1320px] px-5 md:px-10 lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0 lg:flex lg:justify-end lg:px-10 lg:pr-[4vw]">
        <div className="relative w-full lg:w-[min(58vw,780px)] lg:translate-y-16">
          {LAYERS.map(({ Panel, title, x, y, scale, o }, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 hidden rounded-[28px] px-4 pt-3 lg:block"
              style={{
                height: 420,
                background: "#0b0b0b",
                border: "1px solid rgb(255 255 255 / 0.16)",
                opacity: o,
                transform: `translate(${x}px, ${y}px) scale(${scale})`,
                transformOrigin: "50% 100%",
              }}
            >
              <p className="pb-2 text-[13px] font-semibold text-white">{title}</p>
              <Panel />
            </div>
          ))}
          <div
            className="relative rounded-[28px] p-3 sm:p-4"
            style={{ background: "#050505", border: "1px solid rgb(255 255 255 / 0.28)" }}
          >
            <div className="relative h-[360px] sm:h-[420px]">
              <TapStage tap={tap} spots={SPOTS} orbClass="w-[260px] sm:w-[320px]" rings={[300, 460]} />
            </div>
            <TapAnswer tap={tap} className="min-h-[150px] sm:min-h-[84px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
