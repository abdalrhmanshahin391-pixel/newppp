import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/study/RequireAuth";

export const Route = createFileRoute("/study")({
  component: () => (
    <RequireAuth what="your flashcards and study work">
      <Outlet />
    </RequireAuth>
  ),
});
