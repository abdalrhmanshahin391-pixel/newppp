import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/study/RequireAuth";
import { PathClipsPage } from "@/components/rita-lessons/clips-page/PathClipsPage";

// A film & GIF stop of the lesson path, on a page of its own.
export const Route = createFileRoute("/path-clips/$itemId")({
  head: () => ({
    meta: [{ title: "أفلام وGIF — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  component: ClipsRoute,
});

function ClipsRoute() {
  const { itemId } = Route.useParams();
  return (
    <RequireAuth what="this practice">
      <PathClipsPage itemId={itemId} />
    </RequireAuth>
  );
}
