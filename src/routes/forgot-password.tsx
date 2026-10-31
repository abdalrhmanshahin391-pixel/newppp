import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth/AuthPage";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — Uzyra" },
      {
        name: "description",
        content: "Send yourself a password reset link for your Uzyra account.",
      },
      { property: "og:title", content: "Reset your password — Uzyra" },
      { property: "og:description", content: "Get a reset link by email and set a new password." },
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
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { next } = Route.useSearch();
  return <AuthPage mode="forgot" next={next || undefined} />;
}
