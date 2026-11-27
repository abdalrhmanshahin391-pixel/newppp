import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth/AuthPage";
import { ResetPanel } from "@/components/auth/AuthPanels";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Uzyra academy" },
      {
        name: "description",
        content: "Choose a new password for your Uzyra academy account.",
      },
      { property: "og:title", content: "Set a new password — Uzyra academy" },
      { property: "og:description", content: "Finish resetting your Uzyra password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  return (
    <AuthFrame back={{ to: "/login" }}>
      <ResetPanel onDone={() => void navigate({ to: "/login" })} />
    </AuthFrame>
  );
}
