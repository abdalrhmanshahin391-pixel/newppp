import { createFileRoute } from "@tanstack/react-router";
import { WordcraftPage } from "@/components/wordcraft/WordcraftPage";
import type { Level } from "@/lib/wordcraft/round";

// The level names only: importing them from the game would put the whole game in every page.
const LEVEL_IDS: readonly Level[] = ["easy", "medium", "hard"];

type WordcraftSearch = { d?: Level };

export const Route = createFileRoute("/wordcraft")({
  validateSearch: (search: Record<string, unknown>): WordcraftSearch =>
    LEVEL_IDS.includes(search.d as Level) ? { d: search.d as Level } : {},
  head: () => ({
    meta: [
      { title: "Wordcraft — Uzyra" },
      {
        name: "description",
        content:
          "A word-path game for learning English: choose a difficulty, slide across the letters to find four new words, and learn what they mean.",
      },
    ],
  }),
  component: WordcraftRoute,
});

function WordcraftRoute() {
  const { d } = Route.useSearch();
  return <WordcraftPage level={d} />;
}
