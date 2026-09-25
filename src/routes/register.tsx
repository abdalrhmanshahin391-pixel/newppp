import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { openAuth } from "@/lib/auth-dialog";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create your Rita account" },
      {
        name: "description",
        content:
          "Create a Rita account and turn your lectures into flashcards, summaries and quizzes.",
      },
      { property: "og:title", content: "Create your Rita account" },
      {
        property: "og:description",
        content: "Turn your lectures into flashcards, summaries and quizzes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterRedirect,
});

/** Old bookmark → home page with the sign-up window already open. */
function RegisterRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    openAuth("signup");
    void navigate({ to: "/", replace: true });
  }, [navigate]);

  return null;
}
