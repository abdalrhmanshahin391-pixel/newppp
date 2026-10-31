import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth/AuthPage";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Uzyra study tools" },
      {
        name: "description",
        content: "Sign in to Rita and pick up your flashcards, summaries and quizzes.",
      },
      { property: "og:title", content: "Sign in — Uzyra study tools" },
      { property: "og:description", content: "Sign in to Rita and pick up where you left off." },
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
  component: LoginPage,
});

function LoginPage() {
  const { next } = Route.useSearch();
  return <AuthPage mode="signin" next={next || undefined} />;
}
