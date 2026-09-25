import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/courses")({
  component: CoursesLayout,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, follow" }],
  }),
});

function CoursesLayout() {
  return <Outlet />;
}