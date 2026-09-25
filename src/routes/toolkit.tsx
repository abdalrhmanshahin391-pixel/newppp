import { createFileRoute, redirect } from "@tanstack/react-router";

/** The toolkit now lives inside the Special offers page. */
export const Route = createFileRoute("/toolkit")({
  beforeLoad: () => {
    throw redirect({ to: "/offers" });
  },
  component: () => null,
});
