import { createFileRoute, redirect } from "@tanstack/react-router";

/** The guide now lives at /tutorial; keep the old link working. */
export const Route = createFileRoute("/tour")({
  beforeLoad: () => {
    throw redirect({ to: "/tutorial" });
  },
});
