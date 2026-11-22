import { createFileRoute } from "@tanstack/react-router";
import { ProHome } from "@/components/home/procreate/ProHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Uzyra: Learn. Recall. Pass." },
      {
        name: "description",
        content:
          "Uzyra turns your notes and lecture PDFs into smart flashcards, clean one-page summaries and AI-written practice questions.",
      },
      { property: "og:title", content: "Uzyra: Learn. Recall. Pass." },
      {
        property: "og:description",
        content:
          "Flashcards, PDF summaries and AI practice questions from your own study material.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ritajet.com/" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:image",
        content:
          "https://ritajet.com/__l5e/assets-v1/e715e252-b093-484d-98d9-8e3144845769/home-ipad-restored.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://ritajet.com/__l5e/assets-v1/e715e252-b093-484d-98d9-8e3144845769/home-ipad-restored.webp",
      },
    ],
    links: [
      { rel: "canonical", href: "https://ritajet.com/" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="rita-cream edith-light edith-premium min-h-screen bg-black text-white">
      <ProHome />
    </div>
  );
}
