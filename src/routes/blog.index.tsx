import { createFileRoute } from "@tanstack/react-router";
import { BlogPage } from "@/components/blog/BlogPage";
export const Route = createFileRoute("/blog/")({
  head: () => ({ meta: [{ title: "Blog | Uzyra" }] }),
  component: () => <BlogPage />,
});
