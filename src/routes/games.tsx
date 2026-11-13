import { createFileRoute } from "@tanstack/react-router";
import { GamesPage } from "@/components/games/GamesPage";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Games — Uzyra" },
      {
        name: "description",
        content:
          "Learning games on Uzyra: Wordcraft, a word-path game for new English words, and Pairs, a matching game made from your own flashcards.",
      },
    ],
  }),
  component: GamesPage,
});
