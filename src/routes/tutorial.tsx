import { createFileRoute, redirect } from "@tanstack/react-router";

/** The tutorial page was removed; old links and bookmarks go to the home page. */
export const Route = createFileRoute("/tutorial")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
