import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth/AuthPage";

export const Route = createFileRoute("/start")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Welcome to Uzyra" },
      {
        name: "description",
        content: "Create your Uzyra account or sign in to talk with Uzyra and study your way.",
      },
      { property: "og:title", content: "Welcome to Uzyra" },
      {
        property: "og:description",
        content: "Talk with Uzyra, learn from your own material, improve every day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next:
      typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
        ? s.next
        : undefined,
  }),
  component: StartPage,
});

function StartPage() {
  const { next } = Route.useSearch();
  return <AuthPage mode="welcome" next={next || undefined} />;
}
