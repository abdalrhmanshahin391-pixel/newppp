import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve checkout, email and bookmarked plan links. */
export const Route = createFileRoute("/my-plan")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { section: "plan" }, replace: true });
  },
});
