import { createFileRoute } from "@tanstack/react-router";
import { WordcraftPage } from "@/components/wordcraft/WordcraftPage";

type WordcraftSearch = { p?: string; view?: "review" };

export const Route = createFileRoute("/wordcraft")({
  validateSearch: (search: Record<string, unknown>): WordcraftSearch => {
    const out: WordcraftSearch = {};
    if (typeof search.p === "string" && /^[a-z]+-\d{1,3}$/.test(search.p)) out.p = search.p;
    if (search.view === "review") out.view = "review";
    return out;
  },
  head: () => ({
    meta: [
      { title: "Wordcraft — Uzyra" },
      {
        name: "description",
        content:
          "A word-path game for learning English: slide across the letters, find the hidden words, and learn their meanings.",
      },
    ],
  }),
  component: WordcraftRoute,
});

function WordcraftRoute() {
  const { p, view } = Route.useSearch();
  return <WordcraftPage puzzleId={p} view={view} />;
}
