import { createFileRoute } from "@tanstack/react-router";
import { RequireSignIn } from "@/components/study/RequireSignIn";
import { RepeatPage } from "@/components/repeat/RepeatPage";

export const Route = createFileRoute("/repeat")({
  head: () => ({
    meta: [
      { title: "Repeat — Uzyra" },
      {
        name: "description",
        content:
          "Repeat: Uzyra says an English sentence and you say it back. Every word you say right turns black, ten cards a round.",
      },
    ],
  }),
  component: () => (
    <RequireSignIn>
      <RepeatPage />
    </RequireSignIn>
  ),
});
