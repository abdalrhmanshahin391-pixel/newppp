import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old Uzyra links open the current learning hub. */
export const Route = createFileRoute("/rita")({
  beforeLoad: () => {
    throw redirect({ to: "/learn", hash: "rita", replace: true });
  },
});
