import { createFileRoute } from "@tanstack/react-router";
import { StudyLayout, StudyHeading } from "@/components/study/StudyLayout";
import { ComingNext } from "@/components/study/ComingNext";

export const Route = createFileRoute("/study/summaries")({
  head: () => ({
    meta: [
      { title: "Summaries — RitaJet study workspace" },
      { name: "description", content: "Turn a long lecture PDF into a clean one-page summary you can print." },
      { property: "og:title", content: "Summaries — RitaJet study workspace" },
      { property: "og:description", content: "One-page PDF summaries built from your own lectures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SummariesPage,
});

function SummariesPage() {
  return (
    <StudyLayout rail={[{ label: "New summary", to: "/study/summaries" }, { label: "My summaries", to: "/study/summaries" }]}>
      <StudyHeading eyebrow="Summaries" title="One page, the whole chapter" />
      <ComingNext
        what="summaries"
        lines={[
          "Upload a lecture PDF or paste your notes.",
          "Rita writes a structured one-pager in your course wording.",
          "Save it, print it, or send it into a flashcard subject.",
        ]}
      />
    </StudyLayout>
  );
}
