import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { REFUND_EN } from "@/lib/legal-content";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({ meta: [
    { title: "Refund Policy — Uzyra" },
    { name: "description", content: "Uzyra cancellation and refund rules for paid digital study plans." },
    { property: "og:title", content: "Refund Policy — Uzyra" },
    { property: "og:description", content: "Uzyra cancellation and refund rules for paid digital study plans." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <LegalPage title="Refund Policy" content={REFUND_EN} />,
});