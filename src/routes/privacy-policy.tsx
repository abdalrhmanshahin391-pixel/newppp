import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY_EN } from "@/lib/legal-content";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({ meta: [
    { title: "Privacy Policy — Uzyra" },
    { name: "description", content: "How Uzyra collects, protects and uses account and study data." },
    { property: "og:title", content: "Privacy Policy — Uzyra" },
    { property: "og:description", content: "How Uzyra collects, protects and uses account and study data." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <LegalPage title="Privacy Policy" content={PRIVACY_EN} />,
});