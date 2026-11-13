import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth/AuthPage";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create your Uzyra account" },
      {
        name: "description",
        content:
          "Create a Uzyra account and turn your lectures into flashcards, summaries and quizzes.",
      },
      { property: "og:title", content: "Create your Uzyra account" },
      {
        property: "og:description",
        content: "Turn your lectures into flashcards, summaries and quizzes.",
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
  component: RegisterPage,
});

function RegisterPage() {
  const { next } = Route.useSearch();
  return <AuthPage mode="signup" next={next || undefined} />;
}
