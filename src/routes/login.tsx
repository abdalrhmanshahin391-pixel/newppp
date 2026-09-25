import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { openAuth } from "@/lib/auth-dialog";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — RitaJet study tools" },
      {
        name: "description",
        content: "Sign in to Rita and pick up your flashcards, summaries and quizzes.",
      },
      { property: "og:title", content: "Sign in — RitaJet study tools" },
      { property: "og:description", content: "Sign in to Rita and pick up where you left off." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next:
      typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
        ? s.next
        : "",
  }),
  component: LoginRedirect,
});

/**
 * Signing in is a window now, not a page. This route only exists so old links
 * and bookmarks keep working: it drops you on the home page with the sign-in
 * window already open.
 */
function LoginRedirect() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();

  useEffect(() => {
    openAuth("signin", next || undefined);
    void navigate({ to: "/", replace: true });
  }, [navigate, next]);

  return null;
}
