import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Blocks, Mic, Shapes, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/german/")({
  head: () => ({
    meta: [
      { title: "German Lab — der/die/das + pronunciation | RitaJet" },
      {
        name: "description",
        content:
          "Master German articles with a colour-coded der/die/das game and train your pronunciation with native audio and instant word-by-word scoring.",
      },
      { property: "og:title", content: "German Lab — der/die/das + pronunciation" },
      {
        property: "og:description",
        content: "Colour-coded article games and pronunciation scoring, sorted into your own subjects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GermanHub,
});

type HubCard = {
  to: string;
  name: string;
  tag: string;
  icon: ReactNode;
  text: string;
  adminOnly?: boolean;
};

const cards: HubCard[] = [
  {
    to: "/german/articles",
    name: "Article Lab",
    tag: "der · die · das",
    icon: <Shapes size={22} />,
    text: "Blue, red and green burn the gender into your memory. Tap mode, beat-the-clock and an endings coach that teaches the rule behind the answer.",
  },
  {
    to: "/german/speak",
    name: "Pronunciation Lab",
    tag: "Speak and score",
    icon: <Mic size={22} />,
    text: "Hear a native German voice at full or slow speed, record yourself and get a 0–100 score with every word marked green, amber or red.",
  },
  {
    to: "/german/build",
    name: "Build Lab",
    tag: "Order the pieces",
    icon: <Blocks size={22} />,
    text: "Guten Morgen? Tap “Guten” then “Morgen”. Nacht? Tap “Na” then “cht”. Rebuild sentences word by word and words syllable by syllable, with audio when you get it right.",
  },
  {
    to: "/german/add",
    adminOnly: true,
    name: "One Place",
    tag: "Add once, play everywhere",
    icon: <Sparkles size={22} />,
    text: "Write a word or sentence once, give it one home, and it shows up in der/die/das, pronunciation, the build game and your flashcards. Nothing gets scattered again.",
  },
];

const ARTICLES = [
  { word: "der", color: "#2b6df0" },
  { word: "die", color: "#b3213f" },
  { word: "das", color: "#2e7d32" },
];

function GermanHub() {
  const { isRealAdmin } = useAuth();
  const visible = cards.filter((c) => !c.adminOnly || isRealAdmin);
  return (
    <div className="min-h-screen bg-white text-[#121117]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        <div data-tour="german-hero" className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-[15px] font-semibold text-[#6a697c]">German Lab</p>
            <h1
              className="mt-3 font-display font-bold leading-[1.08] tracking-[-0.03em]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.1rem)" }}
            >
              Stop guessing{" "}
              <span style={{ color: ARTICLES[0].color }}>der</span>,{" "}
              <span style={{ color: ARTICLES[1].color }}>die</span>,{" "}
              <span style={{ color: ARTICLES[2].color }}>das</span>.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#4b4a5c]">
              Sort your words and sentences into subjects and sub-subjects, then train them with fast games and
              real pronunciation feedback. Red-flag anything hard and it comes back until it sticks.
            </p>
          </div>
          <div
            role="img"
            aria-label="der, die and das tiles in blue, red and green"
            className="grid grid-cols-3 gap-3 rounded-[20px] border-2 border-[#121117] bg-[#f4f4f8] p-5 sm:gap-4 sm:p-7"
          >
            {ARTICLES.map((a) => (
              <span
                key={a.word}
                className="grid aspect-[4/5] place-items-center rounded-xl border-2 border-[#121117] bg-white font-display text-[clamp(1.6rem,4vw,2.6rem)] font-bold"
                style={{ color: a.color }}
              >
                {a.word}
              </span>
            ))}
          </div>
        </div>

        <div data-tour="german-modes" className="mt-12 grid gap-6 md:grid-cols-2">
          {visible.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-[20px] border-2 border-[#121117] bg-white p-7 transition-colors hover:bg-[#f4f4f8]"
            >
              <div className="flex items-center gap-3">
                <span className="text-[#121117]">{c.icon}</span>
                <div>
                  <div className="text-[14px] font-semibold text-[#6a697c]">{c.tag}</div>
                  <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{c.name}</h2>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-[#4b4a5c]">{c.text}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold">
                Open {c.name}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
