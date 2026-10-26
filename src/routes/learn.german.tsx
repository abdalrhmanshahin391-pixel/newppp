import { createFileRoute } from "@tanstack/react-router";
import { SectionPage } from "@/components/learn/SectionPage";
import { RequireAuth } from "@/components/study/RequireAuth";

export const Route = createFileRoute("/learn/german")({
  head: () => ({
    meta: [
      { title: "German — Uzyra" },
      {
        name: "description",
        content:
          "German study tools on Uzyra: der/die/das article games, pronunciation practice and sentence building from one shared word shelf.",
      },
      { property: "og:title", content: "German — Uzyra" },
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
