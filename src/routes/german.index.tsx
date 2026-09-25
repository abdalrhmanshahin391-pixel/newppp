import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Blocks, Mic, Shapes, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import germanArt from "@/assets/mode-german.jpg";

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
  accent: string;
  soft: string;
  text: string;
  adminOnly?: boolean;
};

const cards: HubCard[] = [
  {
    to: "/german/articles",
    name: "Article Lab",
    tag: "der · die · das",
    icon: <Shapes size={22} />,
    accent: "#2f6fd0",
    soft: "#dceafb",
    text: "Blue, red and green burn the gender into your memory. Tap mode, beat-the-clock and an endings coach that teaches the rule behind the answer.",
  },
  {
    to: "/german/speak",
    name: "Pronunciation Lab",
    tag: "Speak & score",
    icon: <Mic size={22} />,
    accent: "#e0774f",
    soft: "#fbe3d6",
    text: "Hear a native German voice at full or slow speed, record yourself and get a 0–100 score with every word marked green, amber or red.",
  },
  {
    to: "/german/build",
    name: "Build Lab",
    tag: "Order the pieces",
    icon: <Blocks size={22} />,
    accent: "#7a5cc4",
    soft: "#efe9fb",
    text: "Guten Morgen? Tap “Guten” then “Morgen”. Nacht? Tap “Na” then “cht”. Rebuild sentences word by word and words syllable by syllable, with audio when you get it right.",
  },
  {
    to: "/german/add",
    adminOnly: true,
    name: "One Place",
    tag: "Add once · play everywhere",
    icon: <Sparkles size={22} />,
    accent: "#2f9e63",
    soft: "#d9f2e3",
    text: "Write a word or sentence once, give it one home, and it shows up in der/die/das, pronunciation, the build game and your flashcards. Nothing gets scattered again.",
  },
];

function GermanHub() {
  const { isRealAdmin } = useAuth();
  const visible = cards.filter((c) => !c.adminOnly || isRealAdmin);
  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        <div data-tour="german-hero" className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-block rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#1f4c6d]">
              German Lab
            </span>
            <h1
              className="mt-6 font-display font-black leading-[1.08] tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.1rem)" }}
            >
              Stop guessing{" "}
              <span style={{ color: "#2f6fd0" }}>der</span>,{" "}
              <span style={{ color: "#d94a4a" }}>die</span>,{" "}
              <span style={{ color: "#2f9e63" }}>das</span>.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#4a453d]">
              Sort your words and sentences into subjects and sub-subjects, then train them with fast games and
              real pronunciation feedback. Red-flag anything hard and it comes back until it sticks.
            </p>
          </div>
          <img
            src={germanArt}
            alt="der, die and das tiles in blue, red and green"
            width={992}
            height={672}
            className="w-full rounded-[32px] border border-black/[0.06]"
          />
        </div>

        <div data-tour="german-modes" className="mt-12 grid gap-6 md:grid-cols-2">
          {visible.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-[30px] border border-black/[0.07] bg-white p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_50px_-24px_rgba(0,0,0,0.22)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid h-12 w-12 place-items-center rounded-2xl"
                  style={{ background: c.soft, color: c.accent }}
                >
                  {c.icon}
                </span>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: c.accent }}>
                    {c.tag}
                  </div>
                  <h2 className="font-display text-[22px] font-black tracking-tight">{c.name}</h2>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-[#4a453d]">{c.text}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-[14px] font-extrabold">
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
