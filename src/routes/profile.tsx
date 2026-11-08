import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve saved profile links after the move into Settings. */
export const Route = createFileRoute("/profile")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { section: "account" }, replace: true });
  },
});
