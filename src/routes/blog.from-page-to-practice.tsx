import { createFileRoute } from "@tanstack/react-router";
import { BlogPage } from "@/components/blog/BlogPage";
export const Route = createFileRoute("/blog/from-page-to-practice")({
  head: () => ({ meta: [{ title: "From a page in a book to a phrase you can use | Uzyra" }] }),
  component: () => <BlogPage article />,
});
