import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { StartLearningLink } from "@/components/StartLearningLink";
import { StudyPanel, WordsPanel } from "@/components/home/procreate/FeatureTrio";
import { DISPLAY } from "./HeroA";
import { TapAnswer, TapStage, type ChipSpot } from "./TapStage";
import { useTapWord } from "./useTapWord";

const SPOTS: ChipSpot[] = [
  { left: "3%", top: "10%", rot: -4 },
  { left: "8%", top: "68%", rot: 3 },
  { right: "4%", top: "8%", rot: 4 },
  { right: "3%", top: "66%", rot: -3 },
];

const PATHS = [
  { id: "speak", title: "Speak with Rita", text: "Talk out loud, tap any word for its meaning." },
  { id: "files", title: "Study your own files", text: "Notes and PDFs become cards, summaries and questions." },
  { id: "class", title: "Learn together", text: "Share decks and study inside a classroom." },
] as const;

const TOGETHER = [
  { label: "Shared flashcards", text: "Decks other learners made", to: "/share" },
  { label: "Share a deck", text: "Publish one of your own", to: "/share/new" },
  { label: "Classrooms and groups", text: "Study with your class", to: "/spaces" },
];

/** Concept C, "Path" (Khan): say who you are first; the picture on the right follows the choice. */
export function HeroC() {
  const tap = useTapWord();
  const [path, setPath] = useState<(typeof PATHS)[number]["id"]>("speak");

  function onKey(event: React.KeyboardEvent, index: number) {
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = PATHS[(index + step + PATHS.length) % PATHS.length];
    setPath(next.id);
    document.getElementById(`hero-path-${next.id}`)?.focus();
  }

  return (
    <section className="relative isolate overflow-hidden">
      <div
        className="mx-auto grid w-full max-w-[1320px] items-center gap-10 px-5 pb-10 pt-[104px] md:px-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:pt-[88px]"
        style={{ minHeight: "100dvh" }}
      >
        <div className="relative z-10">
          <h1
            className="font-medium text-white"
            style={{
              ...DISPLAY,
              fontSize: "clamp(2.4rem, 4.6vw, 4.2rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.04em",
              textWrap: "balance",
            }}
          >
            Say it out loud. Keep it for good.
          </h1>
          <p className="mt-5 max-w-[30rem] text-[18px] leading-[1.5]" style={{ color: "var(--pp-muted)" }}>
            A voice teacher for English and German who explains in Arabic. Any word you ask about
            can become a flashcard.
          </p>

          <div role="tablist" aria-label="How do you want to learn?" className="mt-8 flex max-w-[30rem] flex-col gap-2">
            {PATHS.map((item, index) => {
              const on = path === item.id;
              return (
                <button
                  key={item.id}
                  id={`hero-path-${item.id}`}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  aria-controls="hero-path-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setPath(item.id)}
                  onKeyDown={(e) => onKey(e, index)}
                  className="rounded-2xl px-4 py-3 text-start transition-[background-color,border-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  style={{
                    background: on ? "#141414" : "transparent",
                    border: `1px solid ${on ? "rgb(255 255 255 / 0.4)" : "rgb(255 255 255 / 0.12)"}`,
                  }}
                >
                  <span className="block text-[17px] font-semibold" style={{ color: on ? "#fff" : "#d4d4d4" }}>
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[15px] leading-snug" style={{ color: "var(--pp-muted)" }}>
                    {item.text}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <StartLearningLink className="rita-btn rita-btn-primary">Start learning</StartLearningLink>
            <Link to="/rita" className="rita-btn rita-btn-secondary">
              Talk to Rita
            </Link>
          </div>
        </div>

        <div id="hero-path-panel" role="tabpanel" aria-labelledby={`hero-path-${path}`} className="relative flex flex-col">
          {path === "speak" && (
            <div key="speak" className="rh-pop">
              <div className="relative h-[340px] w-full sm:h-[420px] lg:h-[min(520px,calc(100dvh-240px))]">
                <TapStage tap={tap} spots={SPOTS} orbClass="w-[280px] sm:w-[360px] lg:w-[min(440px,36vw)]" rings={[330, 520, 720]} />
              </div>
              <TapAnswer tap={tap} className="min-h-[150px] sm:min-h-[84px]" />
            </div>
          )}
          {path === "files" && (
            <div key="files" className="rh-pop grid gap-4 sm:grid-cols-2 lg:min-h-[420px] lg:content-center">
              <StudyPanel />
              <WordsPanel />
            </div>
          )}
          {path === "class" && (
            <ul key="class" className="rh-pop flex flex-col gap-2 lg:min-h-[420px] lg:justify-center">
              {TOGETHER.map((row) => (
                <li key={row.to}>
                  <Link
                    to={row.to as never}
                    className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition-colors hover:bg-white/[0.06]"
                    style={{ border: "1px solid rgb(255 255 255 / 0.2)" }}
                  >
                    <span>
                      <span className="block text-[18px] font-semibold text-white">{row.label}</span>
                      <span className="block text-[15px]" style={{ color: "var(--pp-muted)" }}>
                        {row.text}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-[20px] text-white">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
