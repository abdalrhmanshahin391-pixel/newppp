import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { TERMS_EN } from "@/lib/legal-content";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Terms of Use — RitaJet" },
    { name: "description", content: "The terms governing use of RitaJet study tools and paid plans." },
    { property: "og:title", content: "Terms of Use — RitaJet" },
    { property: "og:description", content: "The terms governing use of RitaJet study tools and paid plans." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <LegalPage title="Terms of Use" content={TERMS_EN} />,
});