import { createFileRoute } from "@tanstack/react-router";
import { SectionPage } from "@/components/learn/SectionPage";
import { RequireAuth } from "@/components/study/RequireAuth";

export const Route = createFileRoute("/learn/german")({
  head: () => ({
    meta: [
      { title: "German — RitaJet" },
      {
        name: "description",
        content:
          "German study tools on RitaJet: der/die/das article games, pronunciation practice and sentence building from one shared word shelf.",
      },
      { property: "og:title", content: "German — RitaJet" },
      {
        property: "og:description",
        content: "Articles, pronunciation and sentence building from one shared word shelf.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth what="the German tools">
      <SectionPage id="german" />
    </RequireAuth>
  ),
});
