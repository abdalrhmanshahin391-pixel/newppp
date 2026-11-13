import { createFileRoute } from "@tanstack/react-router";
import { LanguageGate } from "@/components/language/LanguageGate";
import { PairsPage } from "@/components/pairs/PairsPage";

export const Route = createFileRoute("/study/pairs")({
  head: () => ({
    meta: [
      { title: "Pairs — Uzyra" },
      {
        name: "description",
        content:
          "Match each flashcard's front with its back against the clock: choose your subjects and play.",
      },
    ],
  }),
  component: () => (
    <LanguageGate>
      <PairsPage />
    </LanguageGate>
  ),
});
