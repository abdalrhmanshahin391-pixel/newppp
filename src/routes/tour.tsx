import { createFileRoute, redirect } from "@tanstack/react-router";

/** The tutorial page was removed; keep the old /tour link working. */
export const Route = createFileRoute("/tour")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
