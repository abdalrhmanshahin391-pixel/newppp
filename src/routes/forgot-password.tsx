import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { openAuth } from "@/lib/auth-dialog";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — RitaJet" },
      {
        name: "description",
        content: "Send yourself a password reset link for your RitaJet account.",
      },
      { property: "og:title", content: "Reset your password — RitaJet" },
      { property: "og:description", content: "Get a reset link by email and set a new password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotRedirect,
});

/** Old bookmark → home page with the reset window already open. */
function ForgotRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    openAuth("forgot");
    void navigate({ to: "/", replace: true });
  }, [navigate]);

  return null;
}
