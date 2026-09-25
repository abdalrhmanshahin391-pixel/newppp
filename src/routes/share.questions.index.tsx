import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/share/questions/")({
  beforeLoad: () => {
    throw redirect({
      to: "/share",
      search: { type: "questions" },
    });
  },
  component: () => null,
});
