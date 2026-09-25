import { createFileRoute, redirect } from "@tanstack/react-router";

/** The summaries tool now lives inside the study flow at /study/pdf. */
export const Route = createFileRoute("/summaries/")({
  beforeLoad: () => {
    throw redirect({ to: "/study/pdf" });
  },
});
